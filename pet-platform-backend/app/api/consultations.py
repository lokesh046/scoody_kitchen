from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_roles
from app.models.enums import ConsultationStatus, UserRole
from app.models.user import User
from app.schemas.consultation import ConsultationCreate, ConsultationResponse
from app.services.consultation_service import (
    create_consultation,
    get_consultation_by_id,
    get_customer_consultations,
    update_consultation_status,
)


router = APIRouter(
    prefix="/consultations",
    tags=["Customer Consultations"],
)


@router.post(
    "",
    response_model=ConsultationResponse,
    status_code=status.HTTP_201_CREATED,
)
def book_consultation(
    create_data: ConsultationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    try:
        return create_consultation(
            db=db,
            customer_id=current_user.id,
            create_data=create_data,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'"))
    except MemoryError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc).strip("'"))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


from app.schemas.consultation import (
    ConsultationCreate,
    ConsultationResponse,
    DoctorSlotsResponse,
    PaginatedConsultationResponse,
)


@router.get(
    "",
    response_model=PaginatedConsultationResponse,
)
def list_my_consultations(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: ConsultationStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    return get_customer_consultations(
        db=db,
        customer_id=current_user.id,
        page=page,
        limit=limit,
        status_filter=status_filter,
    )


@router.get(
    "/{consultation_id}",
    response_model=ConsultationResponse,
)
def get_my_consultation_detail(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None or consultation.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return consultation


@router.patch(
    "/{consultation_id}/cancel",
    response_model=ConsultationResponse,
)
def cancel_my_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None or consultation.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    try:
        return update_consultation_status(
            db=db,
            consultation=consultation,
            new_status=ConsultationStatus.CANCELLED,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
