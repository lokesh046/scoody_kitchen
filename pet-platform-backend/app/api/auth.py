from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import UserRegister,UserResponse
from app.services.auth_service import (create_user,get_user_by_email)



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

