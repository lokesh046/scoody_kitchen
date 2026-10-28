from datetime import datetime, timezone
import hashlib
import hmac
import json
import secrets
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status, File, UploadFile
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_token
from app.dependencies.auth import get_current_user
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    GoogleOAuthRequest,
    MagicLinkRequest,
    MagicLinkVerifyCode,
    MagicLinkVerifyToken,
    RefreshTokenRequest,
    TokenResponse,
    UserRegister,
    UserResponse,
    UserUpdate,
    FirebaseVerifyPhonePayload,
    OTPRequest,
    WhatsAppVerifyOTP,
)
from app.services.auth_service import (
    authenticate_google_user,
    create_tokens,
    create_user,
    get_user_by_email,
    request_magic_link,
    verify_magic_link_code,
    verify_magic_link_token,
    update_user_profile,
)
from app.services.whatsapp import normalize_phone_to_whatsapp_format, send_whatsapp_otp, WhatsAppSendError

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_auth_cookies(response: Response, tokens: dict) -> None:
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )


from app.core.limiter import limiter, rate_limit_redis_client


@router.post(
    "/register",
    status_code=status.HTTP_200_OK,
)
@limiter.limit("5/minute")
def register(
    request: Request,
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    try:
        request_magic_link(
            db=db,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
        )
        return {
            "message": "If the email is valid, a magic link has been sent to your inbox."
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

@router.post(
    "/magic-link",
    status_code=status.HTTP_200_OK,
)
@limiter.limit("5/minute")
def request_login_magic_link(
    request: Request,
    magic_data: MagicLinkRequest,
    db: Session = Depends(get_db),
):
    try:
        request_magic_link(
            db=db,
            email=magic_data.email,
            first_name=magic_data.first_name,
            last_name=magic_data.last_name,
        )
        return {
            "message": "If the email is valid, a login magic link has been sent to your inbox."
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/magic-link/verify",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
def verify_magic_link_via_url(
    request: Request,
    response: Response,
    token: str = Query(..., max_length=2048),
    db: Session = Depends(get_db),
):
    try:
        user = verify_magic_link_token(db, token)
        tokens = create_tokens(db, user)
        _set_auth_cookies(response, tokens)
        return tokens
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/magic-link/verify-token",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
def verify_magic_link_via_post(
    request: Request,
    response: Response,
    verify_data: MagicLinkVerifyToken,
    db: Session = Depends(get_db),
):
    try:
        user = verify_magic_link_token(db, verify_data.token)
        tokens = create_tokens(db, user)
        _set_auth_cookies(response, tokens)
        return tokens
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/magic-link/verify-code",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
def verify_magic_link_via_code(
    request: Request,
    response: Response,
    verify_data: MagicLinkVerifyCode,
    db: Session = Depends(get_db),
):
    try:
        user = verify_magic_link_code(db, verify_data.email, verify_data.code)
        tokens = create_tokens(db, user)
        _set_auth_cookies(response, tokens)
        return tokens
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
def authenticate_with_google(
    request: Request,
    response: Response,
    google_data: GoogleOAuthRequest,
    db: Session = Depends(get_db),
):
    try:
        user = authenticate_google_user(db, google_data.id_token)
        tokens = create_tokens(db, user)
        _set_auth_cookies(response, tokens)
        return tokens
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    refresh_token: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Blacklist Access Token (from Cookie or Bearer Header)
    access_token = request.cookies.get("access_token")
    if not access_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            access_token = auth_header.split(" ")[1]

    if access_token:
        try:
            payload = jwt.decode(
                access_token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            exp = payload.get("exp")
            if exp:
                remaining_time = exp - int(datetime.now(timezone.utc).timestamp())
                if remaining_time > 0:
                    from app.core.cache import cache
                    acc_hash = hash_token(access_token)
                    cache.set(f"blacklist:access:{acc_hash}", "revoked", ttl_seconds=int(remaining_time))
        except Exception:
            pass

    # 2. Revoke Refresh Token in Database
    actual_token = refresh_token or request.cookies.get("refresh_token")

    if actual_token:
        token_hash = hash_token(actual_token)
        statement = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
            RefreshToken.user_id == current_user.id,
        )
        stored_token = db.scalar(statement)
        if stored_token:
            stored_token.revoked = True
            db.commit()
    else:
        # Revoke all active refresh tokens for this user on logout
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == current_user.id, RefreshToken.revoked.is_(False))
            .values(revoked=True)
        )
        db.commit()

    # 3. Clear Cookies
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "User Logged Out Successfully"}


@router.post(
    "/refresh",
    response_model=TokenResponse,
)
@limiter.limit("60/minute")
def refresh_token_endpoint(
    response: Response,
    request: Request,
    body: RefreshTokenRequest | None = None,
    refresh_token: str | None = None,
    db: Session = Depends(get_db),
):
    token_val = (
        (body.refresh_token if body and body.refresh_token else None)
        or refresh_token
        or request.cookies.get("refresh_token")
    )

    if not token_val:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is required",
        )

    try:
        payload = jwt.decode(
            token_val,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    token_hash = hash_token(token_val)

    statement = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked.is_(False),
    )

    stored_token = db.scalar(statement)

    if stored_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    if stored_token.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    user = db.get(User, int(user_id))

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user",
        )

    stored_token.revoked = True
    tokens = create_tokens(db, user)
    _set_auth_cookies(response, tokens)
    return TokenResponse(
        **tokens,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_user_profile(db, current_user, update_data)


@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    from app.services.storage_service import get_storage_provider, validate_image_file
    
    file_bytes = await file.read()
    validate_image_file(file, file_bytes)
    
    provider = get_storage_provider()
    avatar_url = provider.upload_image(
        file_bytes=file_bytes,
        original_filename=file.filename or "avatar.jpg",
        content_type=file.content_type or "image/jpeg",
    )
    
    return {"url": avatar_url}


@router.post(
    "/firebase/verify-phone",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
def verify_firebase_phone(
    request: Request,
    payload: FirebaseVerifyPhonePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        from firebase_admin import auth as firebase_auth
        decoded_token = firebase_auth.verify_id_token(payload.id_token)
        phone_number = decoded_token.get("phone_number")

        if not phone_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Firebase ID Token: phone number missing.",
            )
        
        # Update user profile verification status
        current_user.phone = phone_number
        current_user.is_phone_verified = True
        db.commit()
        db.refresh(current_user)
        
        return current_user
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Firebase phone verification failed: {str(e)}",
        )


COOLDOWN_SECONDS = 30
MAX_PER_PHONE_PER_HOUR = 3
MAX_PER_IP_PER_HOUR = 10

def get_client_ip(request: Request) -> str:
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post(
    "/request-otp",
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
def request_otp(
    request: Request,
    payload: OTPRequest,
):
    """
    Pre-check rate-limiting gate for Firebase Phone Auth OTP requests.

    Since Firebase itself doesn't expose a server-side send hook to rate-limit
    requests directly, this pre-check verifies cooldown and hourly limits via Redis
    before letting the client trigger the Firebase SDK send operation.
    """
    # OTP cooldown/count keys are rate-limit state, not cache — they must
    # survive cache eviction under memory pressure, or a stampede that
    # evicts them would let the phone/IP limits reset early. Uses the
    # dedicated rate-limiter Redis client (same instance app/core/limiter.py
    # uses for slowapi) instead of the shared cache client.
    redis_client = rate_limit_redis_client

    phone_number = payload.phone_number
    ip_address = get_client_ip(request)

    cooldown_key = f"otp_cooldown:{phone_number}"
    phone_count_key = f"otp_count:{phone_number}"
    ip_count_key = f"otp_ip_count:{ip_address}"

    # Read values & TTLs in a pipeline
    pipe_read = redis_client.pipeline()
    pipe_read.ttl(cooldown_key)
    pipe_read.get(phone_count_key)
    pipe_read.ttl(phone_count_key)
    pipe_read.get(ip_count_key)
    pipe_read.ttl(ip_count_key)

    cooldown_ttl, phone_count, phone_ttl, ip_count, ip_ttl = pipe_read.execute()

    # Check Cooldown Limit
    if cooldown_ttl > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {cooldown_ttl} seconds before requesting another code",
        )

    # Check Phone Hourly Limit
    if phone_count is not None and int(phone_count) >= MAX_PER_PHONE_PER_HOUR:
        wait_minutes = max(1, phone_ttl // 60) if phone_ttl > 0 else 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many attempts for this number. Try again in {wait_minutes} minutes.",
        )

    # Check IP Hourly Limit
    if ip_count is not None and int(ip_count) >= MAX_PER_IP_PER_HOUR:
        wait_minutes = max(1, ip_ttl // 60) if ip_ttl > 0 else 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many attempts for this IP address. Try again in {wait_minutes} minutes.",
        )

    # All checks passed: set cooldown and increment hourly counters
    pipe_write = redis_client.pipeline()
    # 1. Set Cooldown Key
    pipe_write.set(cooldown_key, "1", ex=COOLDOWN_SECONDS)
    # 2. Increment Phone Counter
    pipe_write.incr(phone_count_key)
    # If key was newly created, set TTL to 1 hour (3600 seconds)
    if phone_count is None:
        pipe_write.expire(phone_count_key, 3600)
    # 3. Increment IP Counter
    pipe_write.incr(ip_count_key)
    # If key was newly created, set TTL to 1 hour (3600 seconds)
    if ip_count is None:
        pipe_write.expire(ip_count_key, 3600)

    pipe_write.execute()

    # Calculate attempts remaining
    current_count = int(phone_count) if phone_count is not None else 0
    attempts_remaining = max(0, MAX_PER_PHONE_PER_HOUR - (current_count + 1))

    return {"allowed": True, "attempts_remaining": attempts_remaining}


# --- WhatsApp OTP phone verification -------------------------------------
# Primary phone-verification channel: unlike the Firebase flow above (where
# the SDK sends the SMS client-side and the backend only rate-limits +
# verifies a token afterwards), this is fully server-owned -- the backend
# generates the code, hashes and stores it, sends it via Meta's Cloud API,
# and verifies the submission itself. Same purpose as verify_firebase_phone
# (confirm current_user's phone), not a signup path: both endpoints below
# require an authenticated user.

WHATSAPP_OTP_COOLDOWN_SECONDS = 60
WHATSAPP_OTP_MAX_PER_PHONE_PER_HOUR = 5
WHATSAPP_OTP_MAX_PER_IP_PER_HOUR = 10
WHATSAPP_OTP_MAX_ATTEMPTS = 5


def _hash_whatsapp_otp(code: str) -> str:
    if not settings.WHATSAPP_OTP_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WhatsApp verification is not configured on this server.",
        )
    return hmac.new(
        settings.WHATSAPP_OTP_SECRET.encode("utf-8"),
        code.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


@router.post("/whatsapp/send-otp", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def send_whatsapp_otp_endpoint(
    request: Request,
    payload: OTPRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a 6-digit code, store its hash in Redis, and send it to
    current_user's phone via WhatsApp. Never returns the code itself."""
    redis_client = rate_limit_redis_client
    phone_number = payload.phone_number
    ip_address = get_client_ip(request)

    cooldown_key = f"wa_otp_cooldown:{phone_number}"
    phone_count_key = f"wa_otp_count:{phone_number}"
    ip_count_key = f"wa_otp_ip_count:{ip_address}"
    otp_record_key = f"wa_otp:{phone_number}"

    pipe_read = redis_client.pipeline()
    pipe_read.ttl(cooldown_key)
    pipe_read.get(phone_count_key)
    pipe_read.ttl(phone_count_key)
    pipe_read.get(ip_count_key)
    pipe_read.ttl(ip_count_key)
    cooldown_ttl, phone_count, phone_ttl, ip_count, ip_ttl = pipe_read.execute()

    if cooldown_ttl > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {cooldown_ttl} seconds before requesting another code",
        )
    if phone_count is not None and int(phone_count) >= WHATSAPP_OTP_MAX_PER_PHONE_PER_HOUR:
        wait_minutes = max(1, phone_ttl // 60) if phone_ttl > 0 else 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many attempts for this number. Try again in {wait_minutes} minutes.",
        )
    if ip_count is not None and int(ip_count) >= WHATSAPP_OTP_MAX_PER_IP_PER_HOUR:
        wait_minutes = max(1, ip_ttl // 60) if ip_ttl > 0 else 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many attempts for this IP address. Try again in {wait_minutes} minutes.",
        )

    code = f"{secrets.randbelow(900000) + 100000}"
    code_hash = _hash_whatsapp_otp(code)

    try:
        await send_whatsapp_otp(phone_number, code)
    except WhatsAppSendError:
        # Full error already logged server-side inside send_whatsapp_otp.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't send the verification code. Please try again in a moment.",
        )

    # Sending a new OTP replaces any previous one for this number -- SET
    # overwrites the key outright rather than merging, so a stale record
    # (and its attempt count) never lingers past a fresh send.
    record = json.dumps({"hash": code_hash, "attempts": 0})
    pipe_write = redis_client.pipeline()
    pipe_write.set(otp_record_key, record, ex=settings.OTP_EXPIRY_SECONDS)
    pipe_write.set(cooldown_key, "1", ex=WHATSAPP_OTP_COOLDOWN_SECONDS)
    pipe_write.incr(phone_count_key)
    if phone_count is None:
        pipe_write.expire(phone_count_key, 3600)
    pipe_write.incr(ip_count_key)
    if ip_count is None:
        pipe_write.expire(ip_count_key, 3600)
    pipe_write.execute()

    return {"sent": True, "expires_in": settings.OTP_EXPIRY_SECONDS}


@router.post(
    "/whatsapp/verify-otp",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
def verify_whatsapp_otp_endpoint(
    request: Request,
    payload: WhatsAppVerifyOTP,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify a code sent via send_whatsapp_otp_endpoint. On success, marks
    current_user's phone as verified -- same effect as verify_firebase_phone,
    different channel."""
    redis_client = rate_limit_redis_client
    otp_record_key = f"wa_otp:{payload.phone_number}"

    raw_record = redis_client.get(otp_record_key)
    if raw_record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This code has expired or wasn't found. Please request a new one.",
        )

    record = json.loads(raw_record)
    if record["attempts"] >= WHATSAPP_OTP_MAX_ATTEMPTS:
        redis_client.delete(otp_record_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Please request a new code.",
        )

    submitted_hash = _hash_whatsapp_otp(payload.code)
    if not hmac.compare_digest(submitted_hash, record["hash"]):
        record["attempts"] += 1
        ttl = redis_client.ttl(otp_record_key)
        redis_client.set(otp_record_key, json.dumps(record), ex=max(ttl, 1))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect code. Please try again.",
        )

    redis_client.delete(otp_record_key)

    current_user.phone = normalize_phone_to_whatsapp_format(payload.phone_number)
    current_user.is_phone_verified = True
    db.commit()
    db.refresh(current_user)

    return current_user
