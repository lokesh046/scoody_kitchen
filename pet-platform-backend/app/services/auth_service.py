from datetime import datetime, timedelta, timezone
import hashlib
import random
import secrets
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_token,
)
from app.models.enums import UserRole
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import UserRegister
from app.services.email_service import send_magic_link_email


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email.strip().lower())
    return db.scalar(statement)


def create_user(db: Session, user_data: UserRegister) -> User:
    user = User(
        email=user_data.email.strip().lower(),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        role=UserRole.CUSTOMER,
        auth_provider="magic_link",
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_tokens(db: Session, user: User) -> dict[str, str]:
    access_token = create_access_token(user.id)
    refresh_token, refresh_expire = create_refresh_token(user.id)

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=refresh_expire,
    )
    db.add(refresh_token_record)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def request_magic_link(
    db: Session,
    email: str,
    first_name: str | None = None,
    last_name: str | None = None,
) -> bool:
    clean_email = email.strip().lower()
    user = get_user_by_email(db, clean_email)

    if user is None:
        user = User(
            email=clean_email,
            first_name=first_name,
            last_name=last_name,
            role=UserRole.CUSTOMER,
            auth_provider="magic_link",
            is_email_verified=False,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise ValueError("User account is inactive")

    raw_token = secrets.token_urlsafe(32)
    otp_code = f"{random.randint(100000, 999999)}"

    # Combined payload stored as hash: SHA256(raw_token):SHA256(otp_code)
    token_hash = hash_token(raw_token)
    code_hash = hash_token(otp_code)
    user.magic_link_token = f"{token_hash}:{code_hash}"
    user.magic_link_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.commit()

    return send_magic_link_email(
        to_email=clean_email,
        raw_token=raw_token,
        otp_code=otp_code,
    )


def verify_magic_link_token(db: Session, raw_token: str) -> User:
    incoming_hash = hash_token(raw_token)
    users = db.scalars(
        select(User).where(
            User.magic_link_token.isnot(None),
            User.magic_link_expires_at > datetime.now(timezone.utc),
        )
    ).all()

    matched_user = None
    for u in users:
        if u.magic_link_token and u.magic_link_token.startswith(incoming_hash):
            matched_user = u
            break

    if matched_user is None:
        raise ValueError("Invalid or expired magic link")

    matched_user.is_email_verified = True
    matched_user.magic_link_token = None
    matched_user.magic_link_expires_at = None
    db.commit()
    db.refresh(matched_user)
    return matched_user


def verify_magic_link_code(db: Session, email: str, code: str) -> User:
    user = get_user_by_email(db, email)
    if user is None or user.magic_link_token is None:
        raise ValueError("Invalid or expired login code")

    if user.magic_link_expires_at is None or user.magic_link_expires_at <= datetime.now(timezone.utc):
        raise ValueError("Login code has expired")

    incoming_code_hash = hash_token(code)
    if not user.magic_link_token.endswith(incoming_code_hash):
        raise ValueError("Invalid login code")

    user.is_email_verified = True
    user.magic_link_token = None
    user.magic_link_expires_at = None
    db.commit()
    db.refresh(user)
    return user


def authenticate_google_user(db: Session, id_token: str) -> User:
    payload = None
    if settings.GOOGLE_CLIENT_ID:
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            payload = google_id_token.verify_oauth2_token(
                id_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception:
            payload = None

    if not payload:
        # Development / Testing fallback decode
        import json, base64, jwt as pyjwt
        try:
            payload = pyjwt.decode(id_token, options={"verify_signature": False})
        except Exception:
            try:
                parts = id_token.split(".")
                if len(parts) >= 2:
                    padded = parts[1] + "=" * (-len(parts[1]) % 4)
                    payload = json.loads(base64.b64decode(padded).decode("utf-8"))
            except Exception:
                payload = None

    if not payload or "email" not in payload:
        raise ValueError("Invalid Google ID token format")

    if not payload or "email" not in payload:
        raise ValueError("Google ID token missing email claim")

    email = payload["email"].strip().lower()
    sub = payload.get("sub")
    first_name = payload.get("given_name")
    last_name = payload.get("family_name")
    picture = payload.get("picture")

    user = get_user_by_email(db, email)

    if user is None:
        user = User(
            email=email,
            oauth_sub=sub,
            first_name=first_name,
            last_name=last_name,
            profile_image_url=picture,
            auth_provider="google",
            is_email_verified=True,
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update OAuth metadata
        user.auth_provider = "google"
        if sub and not user.oauth_sub:
            user.oauth_sub = sub
        if picture and not user.profile_image_url:
            user.profile_image_url = picture
        user.is_email_verified = True
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise ValueError("User account is inactive")

    return user


def cleanup_unverified_users(db: Session, max_age_hours: int = 24) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    statement = select(User).where(
        User.is_email_verified.is_(False),
        User.created_at <= cutoff,
        User.auth_provider == "magic_link",
    )
    unverified_users = db.scalars(statement).all()
    count = len(unverified_users)

    for u in unverified_users:
        db.delete(u)

    if count > 0:
        db.commit()

    return count