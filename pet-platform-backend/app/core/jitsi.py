import jwt
import logging
from datetime import datetime, timezone, timedelta
from app.core.config import settings

logger = logging.getLogger("app.jitsi")

def generate_jaas_token(consultation, user) -> tuple[str | None, str | None]:
    """
    Generates a signed Jitsi JWT token for moderator/participant authentication.
    Supports:
      1. Self-hosted Jitsi with HS256 token authentication (via JITSI_APP_SECRET and JITSI_APP_ID)
      2. 8x8 Jitsi as a Service (JaaS) with RS256 token authentication
    Returns (token, app_id) if configured, otherwise (None, None).
    """
    # Check if the acting user is a doctor or admin (moderators)
    is_doctor_or_admin = False
    if hasattr(user, "role"):
        role_str = user.role.value if hasattr(user.role, "value") else str(user.role).lower()
        if role_str in ["doctor", "admin"]:
            is_doctor_or_admin = True
            
    # 1. Enforce Consultation Status
    raw_status = consultation.status.value if hasattr(consultation.status, "value") else str(consultation.status)
    status_str = raw_status.upper()
    if status_str in ["CANCELLED", "COMPLETED"]:
        logger.warning(f"Denied Jitsi token: Consultation #{consultation.id} status is {status_str}.")
        return None, None

    # 2. Enforce Strict Server-Time Window
    now = datetime.now(timezone.utc)
    sched_dt = consultation.scheduled_at
    if sched_dt.tzinfo is None:
        sched_dt = sched_dt.replace(tzinfo=timezone.utc)
    else:
        sched_dt = sched_dt.astimezone(timezone.utc)

    duration_mins = consultation.duration_minutes or 30
    early_window = timedelta(minutes=15)
    grace_period = timedelta(minutes=15)

    earliest_join_dt = sched_dt - early_window
    latest_join_dt = sched_dt + timedelta(minutes=duration_mins) + grace_period

    if now < earliest_join_dt or now > latest_join_dt:
        logger.info(
            f"Denied Jitsi token: Outside allowed window for Consultation #{consultation.id} "
            f"(scheduled_at: {sched_dt.isoformat()}, now: {now.isoformat()})."
        )
        return None, None

    # 3. Cryptographically Bind Room & Exact Expiration
    raw_room = getattr(consultation, "meeting_room_id", None) or f"consultation-{consultation.id}"
    room_name = raw_room if raw_room.startswith("scooby-") else f"scooby-{raw_room}"
    user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or f"User #{user.id}"

    # --- 1. Self-Hosted Jitsi (HS256) ---
    if settings.JITSI_APP_SECRET:
        try:
            app_id = settings.JITSI_APP_ID or "scooby_kitchen"
            domain = settings.JITSI_DOMAIN or "meet.lokeshm.me"

            payload = {
                "aud": "jitsi",
                "iss": app_id,
                "sub": domain,
                "room": room_name,  # Bound to this specific consultation room only (no "*")
                "iat": int(now.timestamp()),
                "nbf": int(earliest_join_dt.timestamp()),
                "exp": int(latest_join_dt.timestamp()),  # Strictly expires at the end of the slot + grace
                "context": {
                    "features": {
                        "livestreaming": is_doctor_or_admin,
                        "recording": is_doctor_or_admin,
                        "transcription": is_doctor_or_admin,
                        "outbound-call": False
                    },
                    "user": {
                        "id": str(user.id),
                        "name": user_name,
                        "email": user.email,
                        "avatar": getattr(user, "profile_image_url", None) or "",
                        "moderator": is_doctor_or_admin  # True for Doctor/Admin, False for Customer
                    }
                }
            }
            token = jwt.encode(payload, settings.JITSI_APP_SECRET, algorithm="HS256")
            return token, app_id
        except Exception as e:
            logger.error(f"Failed to generate self-hosted Jitsi JWT token: {e}", exc_info=True)
            return None, None

    # --- 2. 8x8 JaaS Jitsi (RS256) ---
    if settings.JAAS_APP_ID and settings.JAAS_API_KEY_ID and settings.JAAS_PRIVATE_KEY:
        try:
            app_id = settings.JAAS_APP_ID
            key_id = settings.JAAS_API_KEY_ID
            private_key = settings.JAAS_PRIVATE_KEY
            
            if "\\n" in private_key:
                private_key = private_key.replace("\\n", "\n")
                
            payload = {
                "aud": "jitsi",
                "iss": "chat",
                "sub": app_id,
                "room": room_name,
                "iat": int(now.timestamp()),
                "nbf": int(earliest_join_dt.timestamp()),
                "exp": int(latest_join_dt.timestamp()),
                "context": {
                    "features": {
                        "livestreaming": is_doctor_or_admin,
                        "recording": is_doctor_or_admin,
                        "transcription": is_doctor_or_admin,
                        "outbound-call": False
                    },
                    "user": {
                        "id": str(user.id),
                        "name": user_name,
                        "email": user.email,
                        "avatar": getattr(user, "profile_image_url", None) or "",
                        "moderator": is_doctor_or_admin  # True for Doctor/Admin, False for Customer
                    }
                }
            }
            headers = {
                "alg": "RS256",
                "typ": "JWT",
                "kid": key_id
            }
            token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
            return token, app_id
        except Exception as e:
            logger.error(f"Failed to generate JaaS JWT token: {e}", exc_info=True)
            return None, None

    return None, None
