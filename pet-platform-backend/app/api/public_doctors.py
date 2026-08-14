from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.doctor import DoctorResponse, NearbyDoctorResponse
from app.services.doctor_service import (
    get_doctor,
    get_doctors_paginated,
    get_nearby_doctors,
)
from app.schemas.doctor_availability import DoctorSchedulePublicResponse
from app.services.doctor_availability_service import get_doctor_availabilities



router = APIRouter(
    prefix="/doctors",
    tags=["Doctor Discovery"]
)


@router.get(
    "",
    response_model=dict,
)
def list_public_doctors(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    specialization: str | None = None,
    clinic_id: int | None = None,
    city: str | None = None,
    is_available: bool | None = None,
    db: Session = Depends(get_db),
):
    try:
        return get_doctors_paginated(
            db=db,
            page=page,
            limit=limit,
            search=search,
            specialization=specialization,
            clinic_id=clinic_id,
            city=city,
            is_available=is_available,
            is_verified_only=True,
            is_active_only=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/nearby",
    response_model=list[NearbyDoctorResponse],
)
def search_nearby_doctors(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(default=10.0, gt=0.0, le=500.0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        results = get_nearby_doctors(
            db=db,
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
            limit=limit,
        )
        output = []
        for item in results:
            doc = item["doctor"]
            output.append({
                "id": doc.id,
                "user_id": doc.user_id,
                "name": item["name"],
                "specialization": doc.specialization,
                "qualification": doc.qualification,
                "experience_years": doc.experience_years,
                "consultation_fee": doc.consultation_fee,
                "bio": doc.bio,
                "profile_image_url": doc.profile_image_url,
                "is_available": doc.is_available,
                "is_verified": doc.is_verified,
                "distance_km": item["distance_km"],
                "clinic": doc.clinic,
            })
        return output
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/{doctor_id}",
    response_model=DoctorResponse,
)
def get_public_doctor_detail(
    doctor_id: int,
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None or not doctor.is_active or not doctor.is_verified:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    return doctor




@router.get(
    "/{doctor_id}/availability",
    response_model=DoctorSchedulePublicResponse,
)
def get_public_doctor_schedule(
    doctor_id: int,
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None or not doctor.is_active or not doctor.is_verified:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    availabilities = get_doctor_availabilities(db, doctor_id, is_available_only=True)
    return {
        "doctor_id": doctor.id,
        "is_accepting_consultations": doctor.is_available,
        "schedule": availabilities,
    }


from datetime import date
from app.schemas.consultation import DoctorSlotsResponse
from app.services.consultation_service import get_available_slots


@router.get(
    "/{doctor_id}/slots",
    response_model=DoctorSlotsResponse,
)
def get_public_doctor_slots(
    doctor_id: int,
    date_param: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
):
    try:
        slots = get_available_slots(
            db=db,
            doctor_id=doctor_id,
            target_date=date_param,
        )
        return {
            "doctor_id": doctor_id,
            "date": date_param.isoformat(),
            "duration_minutes": 30,
            "slots": slots,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
