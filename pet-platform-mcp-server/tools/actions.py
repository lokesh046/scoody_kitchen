import sys
import os
from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field

# Ensure pet-platform-backend is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../pet-platform-backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.database import SessionLocal
from app.models.enums import ConsultationStatus
from app.schemas.consultation import ConsultationCreate
from app.services.consultation_service import (
    create_consultation,
    get_consultation_by_id,
    update_consultation_status,
)
from app.services.order_service import cancel_order as service_cancel_order, get_order_by_id

# In-memory store for idempotency key deduplication
_IDEMPOTENCY_CACHE: dict[str, dict[str, Any]] = {}


def tool_book_consultation(
    session_user_id: int,
    doctor_id: int,
    pet_id: int,
    scheduled_at_iso: str,
    reason: str,
    idempotency_key: str,
    customer_notes: str | None = None,
) -> dict[str, Any]:
    """Book a new vet consultation appointment.
    
    REQUIREMENTS:
    - session_user_id: Authenticated user context (IDOR protection).
    - idempotency_key: Unique key per user action (prevents duplicate bookings).
    """
    # 1. Idempotency Check
    if idempotency_key in _IDEMPOTENCY_CACHE:
        return _IDEMPOTENCY_CACHE[idempotency_key]

    db = SessionLocal()
    try:
        dt = datetime.fromisoformat(scheduled_at_iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        create_data = ConsultationCreate(
            doctor_id=doctor_id,
            pet_id=pet_id,
            scheduled_at=dt,
            reason=reason,
            customer_notes=customer_notes,
        )

        consultation = create_consultation(db, customer_id=session_user_id, create_data=create_data)
        
        status_val = (consultation.status.value if hasattr(consultation.status, "value") else str(consultation.status)).lower()
        result = {
            "status": "success",
            "message": "Consultation successfully booked.",
            "consultation_id": consultation.id,
            "customer_id": consultation.customer_id,
            "doctor_id": consultation.doctor_id,
            "pet_id": consultation.pet_id,
            "scheduled_at": str(consultation.scheduled_at),
            "booking_status": status_val,
            "idempotency_key": idempotency_key,
        }

        _IDEMPOTENCY_CACHE[idempotency_key] = result
        return result
    except (ValueError, KeyError, MemoryError) as exc:
        return {"status": "error", "error": str(exc), "idempotency_key": idempotency_key}
    finally:
        db.close()


def tool_cancel_order(
    session_user_id: int,
    order_id: int,
    idempotency_key: str,
) -> dict[str, Any]:
    """Cancel an existing order and release reserved stock back to inventory.
    
    REQUIREMENTS:
    - session_user_id: Authenticated user context (IDOR protection).
    - idempotency_key: Unique key per user action (prevents duplicate cancellations).
    """
    # 1. Idempotency Check
    if idempotency_key in _IDEMPOTENCY_CACHE:
        return _IDEMPOTENCY_CACHE[idempotency_key]

    db = SessionLocal()
    try:
        order = get_order_by_id(db, order_id)
        if not order:
            return {"status": "error", "error": f"Order #{order_id} not found.", "idempotency_key": idempotency_key}

        # 2. IDOR Security Check
        if order.user_id != session_user_id:
            raise ValueError(f"Access Denied: Order #{order_id} does not belong to user {session_user_id}")

        cancelled_order = service_cancel_order(db, order)
        status_val = (cancelled_order.status.value if hasattr(cancelled_order.status, "value") else str(cancelled_order.status)).lower()

        result = {
            "status": "success",
            "message": f"Order #{order_id} has been successfully cancelled and stock released.",
            "order_id": cancelled_order.id,
            "order_status": status_val,
            "idempotency_key": idempotency_key,
        }

        _IDEMPOTENCY_CACHE[idempotency_key] = result
        return result
    except ValueError as exc:
        return {"status": "error", "error": str(exc), "idempotency_key": idempotency_key}
    finally:
        db.close()


def tool_cancel_consultation(
    session_user_id: int,
    consultation_id: int,
    idempotency_key: str,
) -> dict[str, Any]:
    """Cancel a scheduled vet consultation appointment.
    
    REQUIREMENTS:
    - session_user_id: Authenticated user context (IDOR protection).
    - idempotency_key: Unique key per user action (prevents duplicate cancellations).
    """
    # 1. Idempotency Check
    if idempotency_key in _IDEMPOTENCY_CACHE:
        return _IDEMPOTENCY_CACHE[idempotency_key]

    db = SessionLocal()
    try:
        consultation = get_consultation_by_id(db, consultation_id)
        if not consultation:
            return {"status": "error", "error": f"Consultation #{consultation_id} not found.", "idempotency_key": idempotency_key}

        # 2. IDOR Security Check
        if consultation.customer_id != session_user_id:
            raise ValueError(f"Access Denied: Consultation #{consultation_id} does not belong to user {session_user_id}")

        updated = update_consultation_status(db, consultation, ConsultationStatus.CANCELLED)
        status_val = (updated.status.value if hasattr(updated.status, "value") else str(updated.status)).lower()

        result = {
            "status": "success",
            "message": f"Consultation #{consultation_id} has been cancelled.",
            "consultation_id": updated.id,
            "consultation_status": status_val,
            "idempotency_key": idempotency_key,
        }

        _IDEMPOTENCY_CACHE[idempotency_key] = result
        return result
    except ValueError as exc:
        return {"status": "error", "error": str(exc), "idempotency_key": idempotency_key}
    finally:
        db.close()
