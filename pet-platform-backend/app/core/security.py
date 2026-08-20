# pyrefly: ignore [missing-import]

from datetime import datetime, timedelta, timezone

import hashlib
import jwt
from pwdlib import PasswordHash

from app.core.config import settings

password_hash = PasswordHash.recommended()



def hash_token(token: str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def get_refresh_token_expiration() -> datetime:
    return datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hash_password: str,
    ) -> bool:

    return password_hash.verify(plain_password,hash_password)


def create_access_token(
    user_id: int,
    role: str = "customer",
)-> str:

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload= {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": expire
    }       

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm= settings.JWT_ALGORITHM
    )


def create_refresh_token(user_id: int) -> tuple[str,datetime]:

    expire = get_refresh_token_expiration()

    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    import uuid
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "jti": str(uuid.uuid4())
        }
    
    token  = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm= settings.JWT_ALGORITHM
    )

    return token,expire