import sys
import os
from typing import Any
from sqlalchemy import select

# Ensure pet-platform-backend is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../pet-platform-backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.database import SessionLocal
from app.models.consultation import Consultation
from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability


def tool_get_available_slots(doctor_id: int | None = None) -> list[dict[str, Any]]:
    """Get available doctor time slots for vet consultations."""
    db = SessionLocal()
    try:
        stmt = select(DoctorAvailability).where(DoctorAvailability.is_available == True)
        if doctor_id is not None:
            stmt = stmt.where(DoctorAvailability.doctor_id == doctor_id)
        
        slots = db.scalars(stmt).all()
        return [
            {
                "slot_id": s.id,
                "doctor_id": s.doctor_id,
                "doctor_name": s.doctor.name if getattr(s, "doctor", None) else None,
                "day_of_week": s.day_of_week.value if hasattr(s.day_of_week, "value") else str(s.day_of_week),
                "start_time": str(s.start_time),
                "end_time": str(s.end_time),
                "is_available": s.is_available,
            }
            for s in slots
        ]
    finally:
        db.close()


def tool_get_my_consultations(session_user_id: int) -> list[dict[str, Any]]:
    """Get all scheduled vet consultations for the authenticated user.
    
    SECURITY RULE: session_user_id filter enforces customer data isolation (IDOR protection).
    """
    db = SessionLocal()
    try:
        stmt = select(Consultation).where(Consultation.customer_id == session_user_id)
        consultations = db.scalars(stmt).all()
        return [
            {
                "consultation_id": c.id,
                "customer_id": getattr(c, "customer_id", session_user_id),
                "doctor_id": c.doctor_id,
                "pet_id": c.pet_id,
                "status": c.status.value if hasattr(c.status, "value") else str(c.status),
                "scheduled_at": str(c.scheduled_at) if getattr(c, "scheduled_at", None) else None,
                "reason": getattr(c, "reason", None),
                "notes": getattr(c, "customer_notes", None),
            }
            for c in consultations
        ]
    finally:
        db.close()
