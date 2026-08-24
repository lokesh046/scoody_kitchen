import os
import jwt
import uuid
from datetime import datetime, timezone, timedelta

MCP_CALL_TOKEN_SECRET = os.getenv("MCP_CALL_TOKEN_SECRET", "default_fallback_secret_for_mcp_token_verification_1234567")

def mint_mcp_call_token(user_id: int, expires_in_seconds: int = 60) -> str:
    """Mint a short-lived, single-use JWT for MCP tool invocation containing the authorized user ID."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(seconds=expires_in_seconds),
        "iss": "chatbot-service"
    }
    return jwt.encode(payload, MCP_CALL_TOKEN_SECRET, algorithm="HS256")
