from fastapi import Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session

import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select


from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

from typing import Callable

from app.models.enums import UserRole



def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )

    # Check if token is blacklisted in Redis (revoked on logout)
    from app.core.security import hash_token
    from app.core.cache import cache
    token_hash = hash_token(token)
    if cache.get(f"blacklist:access:{token_hash}"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms= [settings.JWT_ALGORITHM]
        )

        user_id = payload.get("sub")
        token_type = payload.get("type")

        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid token")


        if token_type != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
            detail = " Invalid access token")

    except InvalidTokenError:
        raise HTTPException(
            status_code= status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid Token"
        )


    user  = db.get(User,int(user_id))

    if user is None:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail = "User not Found"
        )   

    if not user.is_active:
        raise HTTPException(
            status_code= status.HTTP_403_FORBIDDEN,
            detail = "User account is inactive"
        )


    return user     
    
def require_role(required_role: UserRole) -> Callable:
    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_checker


def require_roles(*required_roles: UserRole) -> Callable:
    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_checker


require_admin = require_role(UserRole.ADMIN)
require_doctor = require_roles(UserRole.DOCTOR, UserRole.ADMIN)



def verify_internal_service(x_internal_api_key: str = Header(...)) -> None:
    """Authenticates a trusted internal caller (e.g. pet-platform-mcp-server) using short-lived JWTs."""
    secret_key = settings.INTERNAL_SERVICE_API_KEY
    if not secret_key:
        # Fail closed: an unconfigured key must never silently grant access.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal service authentication is not configured.",
        )

    try:
        payload = jwt.decode(
            x_internal_api_key,
            secret_key,
            algorithms=["HS256"],
        )
        if payload.get("iss") not in ("pet-platform-mcp-server", "chatbot-service"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid internal service issuer.",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal service credential has expired.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service credential signature.",
        )