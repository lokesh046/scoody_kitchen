from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.doctor import DoctorResponse, DoctorUpdateSelf
from app.services.doctor_service import (
    get_doctor_by_user_id,
    update_doctor,
)


router = APIRouter(
    prefix="/doctor",
    tags=["Doctor"]
)


@router.get("/test")
def doctor_test(
    current_user: User = Depends(
        require_roles(UserRole.DOCTOR, UserRole.ADMIN)
    )
):
    return {
        "message": "Doctor access granted",
        "user_id": current_user.id,
        "role": current_user.role
    }


@router.get(
    "/me",
    response_model=DoctorResponse,
)
def get_doctor_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.DOCTOR, UserRole.ADMIN)
    ),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found",
        )
    return doctor


@router.patch(
    "/me",
    response_model=DoctorResponse,
)
def update_doctor_me(
    update_data: DoctorUpdateSelf,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.DOCTOR)
    ),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found",
        )
    try:
        return update_doctor(db, doctor, update_data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
