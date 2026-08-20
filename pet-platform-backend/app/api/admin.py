from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.order import OrderStatus
from app.models.user import User
from app.schemas.order import OrderResponse, OrderStatusUpdate
from app.services.order_service import (
    cancel_order,
    confirm_order,
    deliver_order,
    get_all_orders,
    get_order_by_id,
    process_order,
    ship_order,
)


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@router.get("/test")
def admin_test(
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    )
):
    return {
        "message": "Admin access granted",
        "user_id": current_user.id,
        "role": current_user.role
    }


@router.delete("/users/cleanup-unverified")
def cleanup_unverified_users_admin(
    max_age_hours: int = 24,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    from app.services.auth_service import cleanup_unverified_users
    deleted_count = cleanup_unverified_users(db, max_age_hours=max_age_hours)
    return {
        "message": f"Successfully deleted {deleted_count} unverified typo accounts older than {max_age_hours} hours.",
        "deleted_count": deleted_count,
    }


@router.get(
    "/orders",
    response_model=list[OrderResponse],
)
def list_all_orders_admin(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: OrderStatus | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    return get_all_orders(db, skip=skip, limit=limit, status=status)


@router.get(
    "/orders/{order_id}",
    response_model=OrderResponse,
)
def get_order_details_admin(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    order = get_order_by_id(db, order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return order


@router.patch(
    "/orders/{order_id}/status",
    response_model=OrderResponse,
)
def update_order_status_admin(
    order_id: int,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    order = get_order_by_id(db, order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    try:
        target_status = status_data.status
        if target_status == OrderStatus.CONFIRMED:
            return confirm_order(db, order)
        elif target_status == OrderStatus.PROCESSING:
            return process_order(db, order)
        elif target_status == OrderStatus.SHIPPED:
            return ship_order(db, order)
        elif target_status in (OrderStatus.DELIVERED, OrderStatus.COMPLETED):
            return deliver_order(db, order)
        elif target_status == OrderStatus.CANCELLED:
            return cancel_order(db, order)
        else:
            raise ValueError(f"Invalid target status '{target_status.value}'")

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# ==================================================
# ADMIN CLINIC MANAGEMENT
# ==================================================

from app.schemas.clinic import ClinicCreate, ClinicResponse, ClinicUpdate, PaginatedClinicResponse
from app.services.clinic_service import (
    create_clinic,
    deactivate_clinic,
    get_clinic,
    get_clinics_paginated,
    update_clinic,
)


@router.post(
    "/clinics",
    response_model=ClinicResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_clinic_admin(
    clinic_data: ClinicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    return create_clinic(db, clinic_data)


@router.get(
    "/clinics",
    response_model=PaginatedClinicResponse,
)
def list_clinics_admin(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    city: str | None = None,
    is_active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    try:
        return get_clinics_paginated(
            db=db,
            page=page,
            limit=limit,
            search=search,
            city=city,
            is_active_only=is_active_only,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/clinics/{clinic_id}",
    response_model=ClinicResponse,
)
def get_clinic_details_admin(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    clinic = get_clinic(db, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")
    return clinic


@router.patch(
    "/clinics/{clinic_id}",
    response_model=ClinicResponse,
)
def update_clinic_admin(
    clinic_id: int,
    clinic_data: ClinicUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    clinic = get_clinic(db, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")
    return update_clinic(db, clinic, clinic_data)


# ==================================================
# ADMIN DOCTOR MANAGEMENT
# ==================================================

from app.schemas.doctor import DoctorCreate, DoctorCreateAdmin, DoctorResponse, DoctorUpdateAdmin, PaginatedDoctorResponse
from app.services.doctor_service import (
    create_doctor,
    deactivate_doctor,
    get_doctor,
    get_doctors_paginated,
    update_doctor as update_doctor_service,
    verify_doctor,
)


@router.post(
    "/doctors",
    response_model=DoctorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_doctor_admin(
    doctor_data: DoctorCreateAdmin,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    from sqlalchemy import select, func
    user = db.scalar(
        select(User).where(func.lower(User.email) == doctor_data.user_email.strip().lower())
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please use a registered email ID."
        )

    create_dto = DoctorCreate(
        user_id=user.id,
        clinic_id=doctor_data.clinic_id,
        specialization=doctor_data.specialization,
        qualification=doctor_data.qualification,
        experience_years=doctor_data.experience_years,
        consultation_fee=doctor_data.consultation_fee,
        license_number=doctor_data.license_number,
        bio=doctor_data.bio,
        latitude=doctor_data.latitude,
        longitude=doctor_data.longitude,
    )

    try:
        return create_doctor(db, create_dto)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/doctors",
    response_model=PaginatedDoctorResponse,
)
def list_doctors_admin(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    specialization: str | None = None,
    clinic_id: int | None = None,
    city: str | None = None,
    is_available: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
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
            is_verified_only=False,
            is_active_only=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/doctors/{doctor_id}",
    response_model=DoctorResponse,
)
def get_doctor_details_admin(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    return doctor


@router.patch(
    "/doctors/{doctor_id}",
    response_model=DoctorResponse,
)
def update_doctor_admin(
    doctor_id: int,
    update_data: DoctorUpdateAdmin,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    try:
        return update_doctor_service(db, doctor, update_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch(
    "/doctors/{doctor_id}/verify",
    response_model=DoctorResponse,
)
def verify_doctor_admin(
    doctor_id: int,
    is_verified: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    return verify_doctor(db, doctor, is_verified)


@router.patch(
    "/doctors/{doctor_id}/status",
    response_model=DoctorResponse,
)
def update_doctor_status_admin(
    doctor_id: int,
    is_active: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    doctor.is_active = is_active
    db.commit()
    db.refresh(doctor)
    return doctor


from app.schemas.shipping import CreateShipmentRequest, OrderTrackingResponse
from app.services.shipping_service import create_shipment_for_order, get_tracking_details


@router.post(
    "/orders/{order_id}/shipment",
    response_model=OrderTrackingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_order_shipment_admin(
    order_id: int,
    shipment_data: CreateShipmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    try:
        await create_shipment_for_order(
            db,
            order_id=order_id,
            tracking_number=shipment_data.tracking_number,
            carrier=shipment_data.carrier,
        )
        return get_tracking_details(db, order_id=order_id, current_user=current_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


from app.models.consultation import Consultation
from app.models.enums import ConsultationStatus
from app.schemas.consultation import ConsultationResponse, ConsultationStatusUpdate, PaginatedConsultationResponse
from app.services.consultation_service import get_consultation_by_id, update_consultation_status
from app.core.pagination import paginate_query
from sqlalchemy.orm import joinedload
from sqlalchemy import select

@router.get(
    "/consultations",
    response_model=PaginatedConsultationResponse,
)
def list_all_consultations_admin(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: ConsultationStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    query = (
        select(Consultation)
        .options(
            joinedload(Consultation.pet),
            joinedload(Consultation.doctor),
        )
    )
    if status_filter is not None:
        query = query.where(Consultation.status == status_filter)
    query = query.order_by(Consultation.created_at.desc())
    return paginate_query(db, query, page=page, limit=limit)


@router.patch(
    "/consultations/{consultation_id}/status",
    response_model=ConsultationResponse,
)
def update_consultation_status_admin(
    consultation_id: int,
    status_update: ConsultationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None:
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