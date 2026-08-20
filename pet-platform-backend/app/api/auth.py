from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status, File, UploadFile
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
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
    TokenResponse,
    UserRegister,
    UserResponse,
    UserUpdate,
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


from app.core.limiter import limiter


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
def verify_magic_link_via_url(
    response: Response,
    token: str = Query(...),
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
def verify_magic_link_via_post(
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
    access_token = request.cookies.get("access_token")
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

    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "User Logged Out Successfully"}


@router.post(
    "/refresh",
    response_model=TokenResponse,
)
def refresh_token_endpoint(
    response: Response,
    request: Request,
    refresh_token: str | None = None,
    db: Session = Depends(get_db),
):
    token_val = refresh_token or request.cookies.get("refresh_token")
    try:
        with open("/media/ganesh/2EB4C64AB4C613ED/scooby_pets/pet-platform-backend/refresh_debug.log", "a") as f:
            f.write(f"REFRESH CALL: cookies={token_val[:15] if token_val else None}\n")
    except Exception:
        pass

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
    tokens["user"] = user
    return tokens


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
