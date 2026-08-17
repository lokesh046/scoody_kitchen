import os
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer(auto_error=False)


def get_current_chat_user(
    auth: HTTPAuthorizationCredentials | None = Security(security),
) -> int:
    """FastAPI Dependency: Authoritatively decodes & verifies JWT signature. Raises 401 on missing/invalid token."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Authorization Bearer token.",
        )

    token = auth.credentials.strip()
    secret_key = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789")

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


def require_admin_role(
    auth: HTTPAuthorizationCredentials | None = Security(security),
) -> dict:
    """FastAPI Dependency: Enforces strict Admin Role Authentication & Cryptographic Signature Verification."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Admin bearer token required.",
        )

    token = auth.credentials.strip()
    secret_key = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789")

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
