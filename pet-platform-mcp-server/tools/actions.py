from typing import Any
from tools._client import backend_post

# In-memory store for idempotency key deduplication.
# NOTE: single-process only — resets on restart, not shared across workers.
# Fine for a solo/portfolio deployment; move to Redis before scaling out.
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
    - session_user_id: authenticated user context (IDOR protection, re-checked
      by the backend itself, not just trusted here).
    - idempotency_key: unique key per user action (prevents duplicate bookings).
    """
    if idempotency_key in _IDEMPOTENCY_CACHE:
        return _IDEMPOTENCY_CACHE[idempotency_key]

    result = backend_post(
        "/internal/bookings/consultations",
        params={
            "acting_user_id": session_user_id,
            "doctor_id": doctor_id,
            "pet_id": pet_id,
            "scheduled_at_iso": scheduled_at_iso,
            "reason": reason,
            "customer_notes": customer_notes,
        },
    )
    result["idempotency_key"] = idempotency_key
    _IDEMPOTENCY_CACHE[idempotency_key] = result
    return result


def tool_cancel_order(
    session_user_id: int,
    order_id: int,
    idempotency_key: str,
) -> dict[str, Any]:
    """Cancel an existing order and release reserved stock back to inventory.

    REQUIREMENTS:
    - session_user_id: authenticated user context (IDOR protection, re-checked
      by the backend itself, not just trusted here).
    - idempotency_key: unique key per user action (prevents duplicate cancellations).
    """
    if idempotency_key in _IDEMPOTENCY_CACHE:
        return _IDEMPOTENCY_CACHE[idempotency_key]

    result = backend_post(f"/internal/orders/{order_id}/cancel", params={"acting_user_id": session_user_id})
    result["idempotency_key"] = idempotency_key
    _IDEMPOTENCY_CACHE[idempotency_key] = result
    return result


def tool_cancel_consultation(
    session_user_id: int,
    consultation_id: int,
    idempotency_key: str,
) -> dict[str, Any]:
    """Cancel a scheduled vet consultation appointment.

    REQUIREMENTS:
    - session_user_id: authenticated user context (IDOR protection, re-checked
      by the backend itself, not just trusted here).
    - idempotency_key: unique key per user action (prevents duplicate cancellations).
    """
    if idempotency_key in _IDEMPOTENCY_CACHE:
        return _IDEMPOTENCY_CACHE[idempotency_key]

    result = backend_post(
        f"/internal/bookings/consultations/{consultation_id}/cancel",
        params={"acting_user_id": session_user_id},
    )
    result["idempotency_key"] = idempotency_key
    _IDEMPOTENCY_CACHE[idempotency_key] = result
    return result
