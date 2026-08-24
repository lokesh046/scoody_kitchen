from typing import Any
from tools._client import backend_get


def tool_get_available_slots(doctor_id: int | None = None) -> dict[str, Any]:
    """Get available doctor time slots for vet consultations."""
    return backend_get("/internal/bookings/available-slots", params={"doctor_id": doctor_id})


def tool_get_my_consultations(session_user_id: int) -> dict[str, Any]:
    """Get all scheduled vet consultations for the authenticated user.

    SECURITY RULE: session_user_id filter enforces customer data isolation
    (IDOR protection) — enforced by the backend itself, not just here.
    """
    return backend_get("/internal/bookings/my-consultations", params={"acting_user_id": session_user_id})


def tool_get_my_pets(session_user_id: int) -> dict[str, Any]:
    """Get all registered pets for the authenticated user.

    Use this to look up pet names and find their corresponding Pet IDs.
    """
    res = backend_get("/internal/pets", params={"acting_user_id": session_user_id})
    if res.get("ok") is True:
        data = res.get("data")
        if isinstance(data, list):
            res["data"] = {"pets": data}
    return res
