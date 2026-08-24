import os
import json
import redis
from typing import Any
from tools._client import backend_post

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Setup Redis client with in-memory fallback
_redis_client = None
_redis_active = False
_in_memory_cache: dict[str, dict[str, Any]] = {}

try:
    _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    _redis_client.ping()
    _redis_active = True
except Exception:
    _redis_active = False


def _get_idempotent(key: str) -> dict[str, Any] | None:
    """Retrieve idempotent response from Redis or in-memory fallback."""
    cache_key = f"idempotency:{key}"
    if _redis_active and _redis_client:
        try:
            val = _redis_client.get(cache_key)
            if val:
                return json.loads(val)
        except Exception:
            pass
    return _in_memory_cache.get(key)


def _set_idempotent(key: str, result: dict[str, Any], ttl_seconds: int = 86400) -> None:
    """Save idempotent response to Redis or in-memory fallback."""
    cache_key = f"idempotency:{key}"
    if _redis_active and _redis_client:
        try:
            _redis_client.setex(cache_key, ttl_seconds, json.dumps(result))
            return
        except Exception:
            pass
    _in_memory_cache[key] = result


def tool_book_consultation(
    session_user_id: int,
    scheduled_at_iso: str,
    reason: str,
    idempotency_key: str | None = None,
    doctor_id: int | None = None,
    doctor_name: str | None = None,
    pet_id: int | None = None,
    pet_name: str | None = None,
    customer_notes: str | None = None,
) -> dict[str, Any]:
    """Book a new vet consultation appointment.

    REQUIREMENTS:
    - session_user_id: authenticated user context (IDOR protection, re-checked
      by the backend itself, not just trusted here).
    - idempotency_key: unique key per user action (prevents duplicate bookings, generated automatically if omitted).
    - doctor_id or doctor_name: to identify the doctor.
    - pet_id or pet_name: to identify the pet.
    """
    from tools.bookings import backend_get

    # 1. Resolve Doctor Name to ID if needed
    if not doctor_id and doctor_name:
        slots_res = backend_get("/internal/bookings/available-slots")
        if isinstance(slots_res, dict) and slots_res.get("ok") is True:
            data = slots_res.get("data")
            if isinstance(data, list):
                search_name = doctor_name.lower().replace("dr.", "").replace("dr", "").strip()
                matched = [s for s in data if search_name in s.get("doctor_name", "").lower()]
                if matched:
                    doctor_id = matched[0]["doctor_id"]

    if not doctor_id:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "DOCTOR_NOT_FOUND",
                "message": "Could not resolve doctor name to a valid available doctor. Please verify the doctor's name."
            },
            "request_id": "req_internal_validation"
        }

    # 2. Resolve Pet Name to ID if needed
    if not pet_id and pet_name:
        pets_res = backend_get("/internal/pets", params={"acting_user_id": session_user_id})
        if isinstance(pets_res, dict) and pets_res.get("ok") is True:
            data = pets_res.get("data")
            if isinstance(data, list):
                search_pet = pet_name.lower().strip()
                matched = [p for p in data if search_pet == p.get("name", "").lower().strip()]
                if matched:
                    pet_id = matched[0]["pet_id"]
                else:
                    # Fallback to partial match
                    matched_partial = [p for p in data if search_pet in p.get("name", "").lower()]
                    if matched_partial:
                        pet_id = matched_partial[0]["pet_id"]

    if not pet_id:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "PET_NOT_FOUND",
                "message": "Could not resolve pet name to a valid registered pet. Please verify the pet's name."
            },
            "request_id": "req_internal_validation"
        }

    # 3. Handle Idempotency Key Generation
    if not idempotency_key:
        idempotency_key = f"idem_book_{session_user_id}_{doctor_id}_{pet_id}_{scheduled_at_iso.replace(':', '_').replace('-', '_')}"

    result = backend_post(
        "/internal/bookings/consultations",
        params={
            "acting_user_id": session_user_id,
            "doctor_id": doctor_id,
            "pet_id": pet_id,
            "scheduled_at_iso": scheduled_at_iso,
            "reason": reason,
            "customer_notes": customer_notes,
            "idempotency_key": idempotency_key,
        },
    )
    if result.get("ok") is True and isinstance(result.get("data"), dict):
        result["data"]["idempotency_key"] = idempotency_key
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
    result = backend_post(
        f"/internal/orders/{order_id}/cancel",
        params={
            "acting_user_id": session_user_id,
            "idempotency_key": idempotency_key,
        }
    )
    if result.get("ok") is True and isinstance(result.get("data"), dict):
        result["data"]["idempotency_key"] = idempotency_key
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
    result = backend_post(
        f"/internal/bookings/consultations/{consultation_id}/cancel",
        params={
            "acting_user_id": session_user_id,
            "idempotency_key": idempotency_key,
        },
    )
    if result.get("ok") is True and isinstance(result.get("data"), dict):
        result["data"]["idempotency_key"] = idempotency_key
    return result
