from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from app.models.enums import ConsultationStatus
from app.schemas.consultation import ConsultationResponse, ConsultationStatusUpdate
from app.services.consultation_service import (
    get_consultation_by_id,
    get_doctor_consultations,
    update_consultation_status,
)

from app.schemas.doctor_availability import (
    BulkScheduleCreate,
    DoctorAvailabilityCreate,
    DoctorAvailabilityResponse,
    DoctorAvailabilityUpdate,
)
from app.services.doctor_availability_service import (
    create_availability,
    delete_availability,
    get_availability_by_id,
    get_doctor_availabilities,
    replace_doctor_schedule_bulk,
    update_availability,
)

from app.models.enums import HealthRecordType
from app.schemas.health_record import (
    HealthRecordCreate,
    HealthRecordResponse,
    HealthRecordUpdate,
    PetHealthHistoryResponse,
)
from app.services.health_record_service import (
    create_health_record_by_doctor,
    get_health_record_by_id,
    get_pet_health_records_for_doctor,
    update_health_record_by_doctor,
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


# ==================================================
# DOCTOR AVAILABILITY SELF-SERVICE
# ==================================================



@router.get(
    "/me/availability",
    response_model=list[DoctorAvailabilityResponse],
)
def get_my_availability(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    return get_doctor_availabilities(db, doctor.id)


@router.post(
    "/me/availability",
    response_model=DoctorAvailabilityResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_my_availability(
    availability_data: DoctorAvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    try:
        return create_availability(db, doctor.id, availability_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put(
    "/me/availability/bulk",
    response_model=list[DoctorAvailabilityResponse],
)
def set_my_schedule_bulk(
    bulk_data: BulkScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    try:
        return replace_doctor_schedule_bulk(db, doctor.id, bulk_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch(
    "/me/availability/{availability_id}",
    response_model=DoctorAvailabilityResponse,
)
def update_my_availability(
    availability_id: int,
    update_data: DoctorAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    rec = get_availability_by_id(db, availability_id)
    if rec is None or rec.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability record not found")

    try:
        return update_availability(db, rec, update_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete(
    "/me/availability/{availability_id}",
    status_code=status.HTTP_200_OK,
)
def delete_my_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    rec = get_availability_by_id(db, availability_id)
    if rec is None or rec.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability record not found")

    delete_availability(db, rec)
    return {"message": "Availability record deleted successfully"}


# ==================================================
# DOCTOR CONSULTATION MANAGEMENT
# ==================================================

@router.get(
    "/consultations",
    response_model=dict,
)
def list_doctor_consultations(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: ConsultationStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    return get_doctor_consultations(
        db=db,
        doctor_id=doctor.id,
        page=page,
        limit=limit,
        status_filter=status_filter,
    )


@router.get(
    "/consultations/{consultation_id}",
    response_model=ConsultationResponse,
)
def get_doctor_consultation_detail(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None or consultation.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return consultation


@router.patch(
    "/consultations/{consultation_id}/status",
    response_model=ConsultationResponse,
)
def update_doctor_consultation_status(
    consultation_id: int,
    status_update: ConsultationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None or consultation.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    try:
        return update_consultation_status(
            db=db,
            consultation=consultation,
            new_status=status_update.status,
            doctor_notes=status_update.doctor_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ==================================================
# DOCTOR HEALTH RECORDS
# ==================================================



@router.get(
    "/pets/{pet_id}/health-records",
    response_model=PetHealthHistoryResponse,
)
def list_doctor_pet_health_records(
    pet_id: int,
    record_type: HealthRecordType | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    try:
        records = get_pet_health_records_for_doctor(
            db=db,
            doctor_id=doctor.id,
            pet_id=pet_id,
            record_type=record_type,
        )
        return {
            "pet_id": pet_id,
            "records": records,
        }
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'"))


@router.post(
    "/pets/{pet_id}/health-records",
    response_model=HealthRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_doctor_health_record(
    pet_id: int,
    create_data: HealthRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    if create_data.pet_id != pet_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="pet_id path parameter mismatch")

    try:
        return create_health_record_by_doctor(
            db=db,
            doctor_id=doctor.id,
            create_data=create_data,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'"))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/health-records/{record_id}",
    response_model=HealthRecordResponse,
)
def get_doctor_health_record_detail(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    record = get_health_record_by_id(db, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health record not found")

    return record


@router.patch(
    "/health-records/{record_id}",
    response_model=HealthRecordResponse,
)
def update_doctor_health_record(
    record_id: int,
    update_data: HealthRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor = get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    record = get_health_record_by_id(db, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health record not found")

    try:
        return update_health_record_by_doctor(
            db=db,
            doctor_id=doctor.id,
            record=record,
            update_data=update_data,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
