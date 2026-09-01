from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_roles
from app.models.enums import ConsultationStatus, UserRole
from app.models.user import User
from app.schemas.consultation import (
    ConsultationAuditResponse,
    ConsultationCreate,
    ConsultationBookWithPayment,
    ConsultationPaymentIntentRequest,
    ConsultationPaymentIntentResponse,
    ConsultationJoinResponse,
    ConsultationParticipantResponse,
    ConsultationResponse,
    DoctorSlotsResponse,
    PaginatedConsultationResponse,
)
from app.services.consultation_service import (
    create_consultation,
    create_consultation_payment_intent,
    book_consultation_with_payment,
    get_consultation_audit_summary,
    get_consultation_by_id,
    get_customer_consultations,
    record_participant_join,
    record_participant_leave,
    update_consultation_status,
)
from app.core.jitsi import generate_jaas_token


router = APIRouter(
    prefix="/consultations",
    tags=["Customer Consultations"],
)


@router.post(
    "/create-payment-intent",
    response_model=ConsultationPaymentIntentResponse,
)
def get_consultation_payment_intent(
    intent_data: ConsultationPaymentIntentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    try:
        return create_consultation_payment_intent(
            db=db,
            customer_id=current_user.id,
            intent_data=intent_data,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'"))
    except MemoryError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc).strip("'"))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/book-with-payment",
    response_model=ConsultationResponse,
    status_code=status.HTTP_201_CREATED,
)
def book_consultation_paid(
    data: ConsultationBookWithPayment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    try:
        return book_consultation_with_payment(
            db=db,
            customer_id=current_user.id,
            data=data,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'"))
    except MemoryError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc).strip("'"))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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
    from app.core.cache import cache
    cache_key = f"consultation:detail:{consultation_id}:user:{current_user.id}"
    cached_data = cache.get(cache_key)
    
    if cached_data is not None:
        return cached_data

    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None or consultation.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    
    from app.services.consultation_service import calculate_session_timing
    timing = calculate_session_timing(consultation)

    from app.core.config import settings
    response_dict = ConsultationResponse.model_validate(consultation).model_dump()
    response_dict["jitsi_domain"] = settings.JITSI_DOMAIN
    response_dict["can_join"] = timing["can_join"]
    response_dict["time_until_start_seconds"] = timing["time_until_start_seconds"]
    response_dict["time_remaining_seconds"] = timing["time_remaining_seconds"]
    response_dict["is_expired"] = timing["is_expired"]
    
    # Safe to cache metadata
    cache.set(cache_key, response_dict, ttl_seconds=10)
    return response_dict


@router.post(
    "/{consultation_id}/join",
    response_model=ConsultationJoinResponse,
)
def join_my_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None or consultation.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    
    from app.services.consultation_service import calculate_session_timing, update_consultation_status
    timing = calculate_session_timing(consultation)
    if not timing["can_join"]:
        if timing["is_expired"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Consultation appointment window has expired.")
        if timing["time_until_start_seconds"] > 0:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Waiting room active. Consultation has not started yet.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Consultation is not active.")

    # Auto-transition from CONFIRMED to IN_PROGRESS upon joining
    if consultation.status == ConsultationStatus.CONFIRMED:
        update_consultation_status(db, consultation, ConsultationStatus.IN_PROGRESS)

    token, app_id = generate_jaas_token(consultation, current_user)
    if not token:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to issue meeting credentials.")

    from app.core.config import settings
    raw_room = getattr(consultation, "meeting_room_id", None) or f"consultation-{consultation.id}"
    room_name = raw_room if raw_room.startswith("scooby-") else f"scooby-{raw_room}"

    sched_dt = consultation.scheduled_at
    if sched_dt.tzinfo is None:
        from datetime import timezone
        sched_dt = sched_dt.replace(tzinfo=timezone.utc)
    from datetime import timedelta
    latest_join_dt = sched_dt + timedelta(minutes=consultation.duration_minutes + 15)

    # Record participant telemetry
    try:
        record_participant_join(
            db=db,
            consultation_id=consultation.id,
            user_id=current_user.id,
            role="customer",
            room_id=room_name,
        )
    except Exception as e:
        import logging
        logging.getLogger("app.consultation").warning(f"Failed to record participant join telemetry: {e}")

    return {
        "meeting_room_id": raw_room,
        "room_name": room_name,
        "jitsi_token": token,
        "jitsi_app_id": app_id,
        "jitsi_domain": settings.JITSI_DOMAIN,
        "is_moderator": False,
        "role": "participant",
        "expires_at": latest_join_dt.isoformat(),
    }


@router.post(
    "/{consultation_id}/leave",
    response_model=ConsultationParticipantResponse | None,
)
def leave_my_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None or (consultation.customer_id != current_user.id and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    return record_participant_leave(db=db, consultation_id=consultation_id, user_id=current_user.id)


@router.get(
    "/{consultation_id}/audit",
    response_model=ConsultationAuditResponse,
)
def get_my_consultation_audit(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None or (consultation.customer_id != current_user.id and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    audit = get_consultation_audit_summary(db, consultation_id)
    if not audit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit records not found")
    return audit


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
