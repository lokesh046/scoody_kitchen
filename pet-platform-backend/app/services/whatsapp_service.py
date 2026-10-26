"""
WhatsApp Business Platform (Meta Cloud API) webhook handling.

This only covers the RECEIVING side — confirming webhook subscriptions and
parsing delivery-status updates for messages this app has sent. There is no
corresponding "send a WhatsApp message" function yet; that requires an
approved WhatsApp Business Account, a registered sender number, and an
approved message template, none of which exist yet. Build that first, track
each outgoing message's `wamid` (WhatsApp message id) against the phone
verification attempt it belongs to, then extend `process_status_update`
below to trigger an SMS fallback when a tracked message comes back "failed"
or never reaches "delivered" within a timeout.
"""

import hashlib
import hmac
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def verify_webhook_challenge(mode: str | None, token: str | None, challenge: str | None) -> str:
    """
    Handles Meta's one-time GET handshake when a webhook URL is first saved
    in the App Dashboard (or re-verified). Meta requires `hub.mode` to be
    exactly "subscribe" and `hub.verify_token` to match the secret you
    configured, then expects the `hub.challenge` value echoed back verbatim
    as the entire response body. Raises ValueError on any mismatch so the
    route layer can turn that into a 403.
    """
    if not settings.WHATSAPP_VERIFY_TOKEN:
        raise ValueError("WHATSAPP_VERIFY_TOKEN is not configured")
    if mode != "subscribe" or token != settings.WHATSAPP_VERIFY_TOKEN or not challenge:
        raise ValueError("Webhook verification failed: mode/token/challenge mismatch")
    return challenge


def verify_webhook_signature(payload_bytes: bytes, signature_header: str | None) -> bool:
    """
    Meta signs every webhook POST body with HMAC-SHA256 using your app
    secret, sent as `X-Hub-Signature-256: sha256=<hex digest>`. Validating
    this is what proves a request actually came from Meta rather than
    anyone who finds the URL — Meta's own IP ranges change periodically
    (per their docs), so signature checking is the recommended approach
    over IP allowlisting.
    """
    if not settings.WHATSAPP_APP_SECRET:
        logger.warning("WHATSAPP_APP_SECRET not configured — skipping webhook signature check")
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)


def process_whatsapp_webhook(payload_json: dict) -> dict:
    """
    Parses a verified webhook payload. Handles the two shapes that matter
    for OTP delivery: inbound `messages` (a user texted the business number
    directly — not expected for a pure OTP sender, but logged) and outbound
    `statuses` (the delivery-status lifecycle of a message we sent: sent ->
    delivered -> read, or failed). Every other webhook field documented by
    Meta (template quality, account alerts, etc.) is ignored here — add a
    branch for one only once there's an actual use for it.
    """
    processed_statuses = []

    for entry in payload_json.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "messages":
                continue

            value = change.get("value", {})

            for status_update in value.get("statuses", []):
                wamid = status_update.get("id")
                status = status_update.get("status")  # sent | delivered | read | failed
                recipient = status_update.get("recipient_id")
                errors = status_update.get("errors")

                if status == "failed":
                    logger.warning(
                        f"WhatsApp message {wamid} to {recipient} FAILED: {errors}. "
                        "TODO once a WhatsApp send flow exists: look up the pending "
                        "phone-verification attempt by wamid and trigger SMS fallback here."
                    )
                else:
                    logger.info(f"WhatsApp message {wamid} to {recipient} status: {status}")

                processed_statuses.append({"wamid": wamid, "status": status, "recipient": recipient})

            for inbound_message in value.get("messages", []):
                logger.info(
                    f"Inbound WhatsApp message from {inbound_message.get('from')}: "
                    f"{inbound_message.get('text', {}).get('body', '<non-text message>')}"
                )

    return {"processed": len(processed_statuses), "statuses": processed_statuses}
