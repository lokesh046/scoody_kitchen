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
            
    now = datetime.now(timezone.utc)
    raw_room = getattr(consultation, "meeting_room_id", None) or f"consultation-{consultation.id}"
    room_name = raw_room if raw_room.startswith("scooby-") else f"scooby-{raw_room}"
    user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or f"User #{user.id}"

    # --- 1. Self-Hosted Jitsi (HS256) ---
    if settings.JITSI_APP_SECRET:
        try:
            app_id = settings.JITSI_APP_ID or "scooby_kitchen"
            domain = settings.JITSI_DOMAIN or "scoobykitchen.duckdns.org"

            payload = {
                "aud": "jitsi",
                "iss": app_id,
                "sub": domain,
                "room": "*",
                "iat": int(now.timestamp()),
                "nbf": int((now - timedelta(minutes=1)).timestamp()),
                "exp": int((now + timedelta(minutes=consultation.duration_minutes + 60)).timestamp()),
                "context": {
                    "features": {
                        "livestreaming": False,
                        "recording": False,
                        "transcription": False,
                        "outbound-call": False
                    },
                    "user": {
                        "id": str(user.id),
                        "name": user_name,
                        "email": user.email,
                        "avatar": getattr(user, "profile_image_url", None) or "",
                        "moderator": True
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
                "nbf": int((now - timedelta(minutes=1)).timestamp()),
                "exp": int((now + timedelta(minutes=consultation.duration_minutes + 15)).timestamp()),
                "context": {
                    "features": {
                        "livestreaming": True,
                        "recording": True,
                        "transcription": True,
                        "outbound-call": False
                    },
                    "user": {
                        "id": str(user.id),
                        "name": user_name,
                        "email": user.email,
                        "avatar": getattr(user, "profile_image_url", None) or "",
                        "moderator": True
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
