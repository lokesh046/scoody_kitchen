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
from app.models.magic_link_token import MagicLinkToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import UserRegister, UserUpdate
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


def create_tokens(db: Session, user: User, *, cancels_deletion: bool = True) -> dict[str, str]:
    # Signing in during the grace period of an account deletion cancels it (a token refresh does not).
    if cancels_deletion and user.deletion_scheduled_for is not None:
        from app.services.account_deletion_service import cancel_pending_deletion
        cancel_pending_deletion(db, user)

    user_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token = create_access_token(user.id, role=user_role_str)
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

    magic_token = MagicLinkToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        code_hash=hash_token(otp_code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(magic_token)
    db.commit()

    return send_magic_link_email(
        to_email=clean_email,
        raw_token=raw_token,
        otp_code=otp_code,
    )


def verify_magic_link_token(db: Session, raw_token: str) -> User:
    incoming_hash = hash_token(raw_token)
    statement = select(MagicLinkToken).where(
        MagicLinkToken.token_hash == incoming_hash,
        MagicLinkToken.used.is_(False),
        MagicLinkToken.expires_at > datetime.now(timezone.utc),
    )
    token_record = db.scalar(statement)

    if token_record is None:
        raise ValueError("Invalid or expired magic link")

    token_record.used = True
    user = db.get(User, token_record.user_id)
    if user is None or not user.is_active:
        raise ValueError("User account is inactive or not found")

    user.is_email_verified = True
    db.commit()
    db.refresh(user)
    return user


def verify_magic_link_code(db: Session, email: str, code: str) -> User:
    user = get_user_by_email(db, email)
    if user is None:
        raise ValueError("Invalid or expired login code")

    statement = (
        select(MagicLinkToken)
        .where(
            MagicLinkToken.user_id == user.id,
            MagicLinkToken.used.is_(False),
            MagicLinkToken.expires_at > datetime.now(timezone.utc),
        )
        .order_by(MagicLinkToken.created_at.desc())
    )
    token_record = db.scalar(statement)

    if token_record is None:
        raise ValueError("Invalid or expired login code")

    if token_record.failed_attempts >= 5:
        token_record.used = True
        db.commit()
        raise ValueError("Too many failed attempts. Login code has been invalidated.")

    incoming_code_hash = hash_token(code)
    if token_record.code_hash != incoming_code_hash:
        token_record.failed_attempts += 1
        if token_record.failed_attempts >= 5:
            token_record.used = True
            db.commit()
            raise ValueError("Too many failed attempts. Login code has been invalidated.")
        db.commit()
        raise ValueError("Invalid login code")

    token_record.used = True
    user.is_email_verified = True
    db.commit()
    db.refresh(user)
    return user


def authenticate_google_user(db: Session, id_token: str) -> User:
    # Build list of accepted client IDs
    accepted_client_ids = []
    if settings.GOOGLE_CLIENT_ID:
        accepted_client_ids.append(settings.GOOGLE_CLIENT_ID)
    if settings.GOOGLE_CLIENT_IDS:
        accepted_client_ids.extend(settings.GOOGLE_CLIENT_IDS)

    if not accepted_client_ids:
        raise ValueError("Google OAuth is not configured on the server")

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        payload = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            accepted_client_ids,
        )
    except Exception as exc:
        raise ValueError(f"Invalid Google ID token signature or claims: {exc}")

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


_APPLE_ISSUER = "https://appleid.apple.com"
_apple_jwks_client = None


def _get_apple_jwks_client():
    """Apple's public signing keys, fetched once and cached by PyJWT."""
    global _apple_jwks_client
    if _apple_jwks_client is None:
        import jwt
        _apple_jwks_client = jwt.PyJWKClient(f"{_APPLE_ISSUER}/auth/keys", cache_keys=True, lifespan=3600)
    return _apple_jwks_client


def authenticate_apple_user(
    db: Session,
    identity_token: str,
    first_name: str | None = None,
    last_name: str | None = None,
    nonce: str | None = None,
) -> User:
    """Signs in (or signs up) a person who used "Sign in with Apple" in the iOS app."""
    import hashlib
    import jwt

    if not settings.APPLE_CLIENT_IDS:
        raise ValueError("Sign in with Apple is not configured on the server")

    try:
        signing_key = _get_apple_jwks_client().get_signing_key_from_jwt(identity_token)
        payload = jwt.decode(
            identity_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_IDS,
            issuer=_APPLE_ISSUER,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except Exception as exc:
        raise ValueError(f"Invalid Apple identity token: {exc}")

    token_nonce = payload.get("nonce")
    if token_nonce:
        if not nonce or token_nonce not in (nonce, hashlib.sha256(nonce.encode()).hexdigest()):
            raise ValueError("Apple sign-in could not be verified (nonce mismatch). Please try again.")

    sub = payload["sub"]
    email = (payload.get("email") or "").strip().lower() or None
    email_verified = str(payload.get("email_verified", "false")).lower() == "true"

    # 1. Returning Apple user: Apple's stable id is the best key (the email can be a private relay address).
    user = db.scalar(select(User).where(User.oauth_sub == sub, User.auth_provider == "apple"))

    # 2. Same person already registered by email: link only if Apple vouches for the address.
    if user is None and email and email_verified:
        user = get_user_by_email(db, email)
        if user is not None and not user.oauth_sub:
            user.oauth_sub = sub

    if user is None:
        if not email:
            raise ValueError(
                "Apple did not share an email address. In iPhone Settings > Apple ID > Sign in with Apple, "
                "remove Hearth & One and try again, or use another sign-in method."
            )
        if get_user_by_email(db, email) is not None:
            raise ValueError("An account with this email already exists. Sign in with your original method.")
        user = User(
            email=email,
            oauth_sub=sub,
            first_name=(first_name or None),
            last_name=(last_name or None),
            auth_provider="apple",
            is_email_verified=True,
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        db.add(user)
    else:
        if first_name and not user.first_name:
            user.first_name = first_name
        if last_name and not user.last_name:
            user.last_name = last_name

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


def update_user_profile(db: Session, user: User, update_data: UserUpdate) -> User:
    if update_data.first_name is not None:
        user.first_name = update_data.first_name.strip()
    if update_data.last_name is not None:
        user.last_name = update_data.last_name.strip()
    if update_data.phone is not None:
        user.phone = update_data.phone.strip()
    if update_data.profile_image_url is not None:
        user.profile_image_url = update_data.profile_image_url.strip()

    db.commit()
    db.refresh(user)
    return user