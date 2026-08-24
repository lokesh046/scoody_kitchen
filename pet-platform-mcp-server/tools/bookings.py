from typing import Any
from tools._client import backend_get
from tools._auth import verify_mcp_call_token


def tool_get_available_slots(doctor_id: int | None = None) -> dict[str, Any]:
    """Get available doctor time slots for vet consultations."""
    return backend_get("/internal/bookings/available-slots", params={"doctor_id": doctor_id})


def tool_get_my_consultations(mcp_call_token: str) -> dict[str, Any]:
    """Get all scheduled vet consultations for the authenticated user.

    SECURITY RULE: mcp_call_token enforces user validation and protection.
    """
    session_user_id = verify_mcp_call_token(mcp_call_token)
    return backend_get("/internal/bookings/my-consultations", params={"acting_user_id": session_user_id})


def tool_get_my_pets(mcp_call_token: str) -> dict[str, Any]:
    """Get all registered pets for the authenticated user.

    Use this to look up pet names and find their corresponding Pet IDs.
    """
    session_user_id = verify_mcp_call_token(mcp_call_token)
    res = backend_get("/internal/pets", params={"acting_user_id": session_user_id})
    if res.get("ok") is True:
        data = res.get("data")
        if isinstance(data, list):
            res["data"] = {"pets": data}
    return res
