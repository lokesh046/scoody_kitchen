# pyrefly: ignore [missing-import]

from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hash_password: str,
    ) -> bool:

    return password_hash.verify(plain_password,hash_password)


def create_access_token(
    user_id: int
)-> str:

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload= {
        "sub": str(user_id),
        "type": "access",
        "exp": expire
    }       

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm= settings.JWT_ALGORITHM
    )


def create_refresh_token(user_id: int) -> str:

    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire
        }
    
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm= settings.JWT_ALGORITHM
    )