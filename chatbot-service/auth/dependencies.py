import os
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "admin_secret_key_999")

security = HTTPBearer(auto_error=False)


def require_admin_role(
    auth: HTTPAuthorizationCredentials | None = Security(security),
) -> dict:
    """FastAPI Dependency: Enforces strict Admin Role Authentication & Authorization on protected routes."""
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Admin bearer token or API key required.",
        )

    token = auth.credentials

    # 1. Direct Admin API Key Check
    if token == ADMIN_API_KEY:
        return {"user_id": 1, "role": "admin"}

    # 2. JWT Token Decoding & Admin Role Verification
    try:
        from jose import jwt
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        role = payload.get("role", payload.get("user_role"))
        is_admin = payload.get("is_admin", False)

        if role == "admin" or is_admin is True:
            return {"user_id": payload.get("sub"), "role": "admin"}
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: Admin privileges required to access this RAG management endpoint.",
            )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin authentication token.",
        )
