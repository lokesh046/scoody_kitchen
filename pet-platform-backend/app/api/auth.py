from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
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
)
from app.services.auth_service import (
    authenticate_google_user,
    create_tokens,
    create_user,
    get_user_by_email,
    request_magic_link,
    verify_magic_link_code,
    verify_magic_link_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
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
        _set_refresh_cookie(response, tokens["refresh_token"])
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
        _set_refresh_cookie(response, tokens["refresh_token"])
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
        _set_refresh_cookie(response, tokens["refresh_token"])
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
        _set_refresh_cookie(response, tokens["refresh_token"])
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

    response.delete_cookie(key="refresh_token")
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
    _set_refresh_cookie(response, tokens["refresh_token"])

    return tokens


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user
