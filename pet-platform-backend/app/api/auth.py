from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_token
from app.schemas.auth import (UserRegister,UserResponse,UserLogin,TokenResponse)
from app.services.auth_service import (create_user,get_user_by_email,authenticate_user,create_tokens)
from app.dependencies.auth import get_current_user
from app.models.refresh_token import RefreshToken

from datetime import datetime, timezone

import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from app.models.user import User

router = APIRouter(prefix="/auth",tags=["Authentication"])

@router.post("/register",response_model = UserResponse,status_code=status.HTTP_201_CREATED)

def register(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):


    existing_user = get_user_by_email(db,user_data.email)


    if existing_user:
        raise  HTTPException(
            status_code= status.HTTP_409_CONFLICT,
            detail="Email is already register"
        )

    return create_user(db,user_data)



@router.post("/login",response_model = TokenResponse,status_code=status.HTTP_200_OK)

def login(
    user_login: UserLogin,
    db: Session = Depends(get_db)
):

    user = authenticate_user(
        db,
        user_login.email,
        user_login.password
    )

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Credentials"
        )

    if not user.is_active:
        raise HTTPException(status_code = status.HTTP_403_FORBIDDEN,
        detail = "User account is not acttive")
    
    token = create_tokens(db,user)

    return token


@router.post("/logout")
def logout(
    refresh_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    token_hash = hash_token(refresh_token)
    statement = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked.is_(False),
        RefreshToken.user_id == current_user.id
    )
    
    stored_token = db.scalar(statement)

    if stored_token:
        stored_token.revoked = True
        db.commit()

    return {"message": "User Logged Out Successfully"}

@router.post(
    "/refresh",
    response_model=TokenResponse,
)



def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(
            refresh_token,
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

    token_hash = hash_token(refresh_token)

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

    # Rotate the refresh token
    stored_token.revoked = True

    tokens = create_tokens(db, user)

    return tokens

@router.get("/me",response_model=UserResponse)

def get_me(
    current_user: User = Depends(get_current_user)
):
    return current_user



