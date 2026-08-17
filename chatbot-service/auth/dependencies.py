import os
from fastapi import HTTPException, status, Request

def get_current_chat_user(request: Request) -> int:
    """FastAPI Dependency: Authoritatively decodes & verifies JWT signature from HttpOnly cookies."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )

    # Check if token is blacklisted in Redis (revoked on logout)
    import hashlib
    from memory.redis_memory import session_memory
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    if session_memory.is_token_blacklisted(token_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
        )

    secret_key = os.getenv("JWT_SECRET_KEY")

    try:
        import jwt
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        sub = payload.get("sub") or payload.get("user_id")
        if sub is not None:
            return int(sub)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject payload.",
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token signature.",
        )


def require_admin_role(request: Request) -> dict:
    """FastAPI Dependency: Enforces strict Admin Role Authentication & Cryptographic Signature Verification via HttpOnly cookies."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication cookie. Admin privileges required.",
        )

    # Check if token is blacklisted in Redis (revoked on logout)
    import hashlib
    from memory.redis_memory import session_memory
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    if session_memory.is_token_blacklisted(token_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
        )

    secret_key = os.getenv("JWT_SECRET_KEY")

    try:
        import jwt
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        role = payload.get("role", payload.get("user_role"))
        is_admin = payload.get("is_admin", False)

        if role == "admin" or is_admin is True:
            return {"user_id": payload.get("sub"), "role": "admin"}
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: Admin privileges required to access this endpoint.",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or forged admin authentication token signature.",
        )
