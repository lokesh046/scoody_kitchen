"""MSG91 SMS client -- backup OTP delivery when WhatsApp is unavailable.

Uses MSG91's Flow API with the DLT-approved "Login_OTP" template, whose body
is "##otp## is your Hearth & One verification code ... Valid for 10 minutes."
The sender header (SYNVIT) is bound to that template inside MSG91.
"""

import logging

import httpx

from app.core.config import settings
from app.services.whatsapp import normalize_phone_to_whatsapp_format

logger = logging.getLogger(__name__)

MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow"


class SmsSendError(Exception):
    """Raised when MSG91 rejects or fails to accept the SMS."""


def sms_configured() -> bool:
    return bool(settings.MSG91_AUTH_KEY and settings.MSG91_TEMPLATE_ID)


async def send_sms_otp(phone_number: str, code: str) -> None:
    if not sms_configured():
        raise SmsSendError("MSG91 SMS is not configured on this server.")

    mobile = normalize_phone_to_whatsapp_format(phone_number)
    payload = {
        "template_id": settings.MSG91_TEMPLATE_ID,
        "short_url": "0",
        "recipients": [{"mobiles": mobile, "otp": code}],
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                MSG91_FLOW_URL,
                json=payload,
                headers={"authkey": settings.MSG91_AUTH_KEY, "accept": "application/json"},
            )
        body = {}
        try:
            body = response.json()
        except ValueError:
            pass
        if response.status_code >= 400 or body.get("type") == "error":
            # The code is only in the request, never the response, so the body is safe to log.
            logger.error("MSG91 send failed for %s: status=%s body=%s", mobile, response.status_code, response.text)
            raise SmsSendError(f"MSG91 returned {response.status_code}")
        # MSG91 accepted the request: log its request id so the delivery report can be found in the MSG91 dashboard.
        logger.info("MSG91 accepted OTP SMS for %s: %s", mobile, response.text)
    except httpx.HTTPError as exc:
        logger.error("MSG91 network error for %s: %s", mobile, exc)
        raise SmsSendError("Network error contacting MSG91") from exc
