"""WhatsApp Cloud API (Meta) client -- currently just OTP delivery.

Kept as its own module, separate from the OTP generation/storage/verification
logic in app/api/auth.py, so an SMS fallback provider (e.g. MSG91) can sit
alongside this one later without touching the OTP flow itself -- callers only
need a function that sends a code to a phone number and returns whether it
worked.
"""

import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

WHATSAPP_API_BASE = "https://graph.facebook.com"


def normalize_phone_to_whatsapp_format(phone_number: str) -> str:
    """Convert an E.164-ish phone number ("+919876543210" or "9876543210")
    to the digits-only, country-code-prefixed format Meta's API expects
    ("919876543210"). Defaults bare 10-digit numbers to India (+91), since
    that's this app's primary market; anything already carrying a country
    code is passed through unchanged.
    """
    digits = re.sub(r"\D", "", phone_number)
    if len(digits) == 10:
        return f"91{digits}"
    return digits


class WhatsAppSendError(Exception):
    """Raised when the Meta API rejects or fails to deliver the message.
    Carries no sensitive detail in its message -- callers should log the
    original exception themselves for diagnostics, not surface this one's
    text to the end user."""


async def send_whatsapp_otp(phone_number: str, code: str) -> None:
    """Send the approved "hearthandone_otp" authentication template to
    phone_number with the given code. Raises WhatsAppSendError on any
    failure; never returns a partial-success state -- callers should treat
    "no exception" as "accepted for delivery by Meta", not "delivered".
    """
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        raise WhatsAppSendError("WhatsApp Cloud API is not configured on this server.")

    to_number = normalize_phone_to_whatsapp_format(phone_number)
    url = (
        f"{WHATSAPP_API_BASE}/{settings.WHATSAPP_API_VERSION}"
        f"/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": settings.WHATSAPP_TEMPLATE_NAME,
            "language": {"code": settings.WHATSAPP_TEMPLATE_LANG},
            "components": [
                {"type": "body", "parameters": [{"type": "text", "text": code}]},
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": code}],
                },
            ],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            )
        if response.status_code >= 400:
            # Full response (error code, message, Meta's trace id) is useful
            # for debugging template/number config issues -- logged
            # server-side only, never returned to the client, and the code
            # itself is never in this payload so it's safe to log whole.
            logger.error(
                "WhatsApp send failed for %s: status=%s body=%s",
                to_number,
                response.status_code,
                response.text,
            )
            raise WhatsAppSendError(f"Meta API returned {response.status_code}")
    except httpx.HTTPError as exc:
        logger.error("WhatsApp send network error for %s: %s", to_number, exc)
        raise WhatsAppSendError("Network error contacting WhatsApp Cloud API") from exc
