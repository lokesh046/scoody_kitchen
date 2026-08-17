from typing import Any
from tools._client import backend_get


def tool_get_available_slots(doctor_id: int | None = None) -> list[dict[str, Any]]:
    """Get available doctor time slots for vet consultations."""
    result = backend_get("/internal/bookings/available-slots", params={"doctor_id": doctor_id})
    return result if isinstance(result, list) else result.get("error", [])


def tool_get_my_consultations(session_user_id: int) -> list[dict[str, Any]]:
    """Get all scheduled vet consultations for the authenticated user.

    SECURITY RULE: session_user_id filter enforces customer data isolation
    (IDOR protection) — enforced by the backend itself, not just here.
    """
    result = backend_get("/internal/bookings/my-consultations", params={"acting_user_id": session_user_id})
    return result if isinstance(result, list) else result.get("error", [])
