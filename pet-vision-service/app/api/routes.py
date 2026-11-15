import logging
import os
import threading

from fastapi import APIRouter, File, UploadFile, HTTPException, Request, status
from app.schemas import ClassificationResponse
from app.services.pipeline import get_pipeline
from app.services.security import (
    verify_authenticated_user,
    vision_rate_limiter,
    vision_daily_scan_limiter,
    validate_image_magic_bytes,
)

router = APIRouter()

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
CHUNK_SIZE = 64 * 1024  # 64 KB per stream chunk

# Scans running at the same moment, per worker. Beyond this the service answers "busy" straight away, so people are
# not left waiting until the app gives up (60 s). Two workers run, so the service as a whole takes twice this.
MAX_IN_FLIGHT = int(os.getenv("VISION_MAX_IN_FLIGHT", "30"))
_in_flight = 0
_in_flight_lock = threading.Lock()


def _enter_scan() -> bool:
    global _in_flight
    with _in_flight_lock:
        if _in_flight >= MAX_IN_FLIGHT:
            return False
        _in_flight += 1
        return True


def _leave_scan() -> None:
    global _in_flight
    with _in_flight_lock:
        _in_flight = max(0, _in_flight - 1)


@router.get("/health")
def health_check():
    pipeline = get_pipeline()
    return {
        "status": "ok",
        "service": "pet-vision-service",
        "model_loaded": pipeline.session is not None,
    }


@router.post(
    "/api/v1/classify",
    response_model=ClassificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Classify pet species, breed, and retrieve Scooby's Kitchen nutrition blueprint",
)
def classify_pet(
    request: Request,
    file: UploadFile = File(..., description="Pet photo from camera or gallery upload"),
):
    # A normal (not "async") handler on purpose: the server runs each one in its own thread, so many scans wait on
    # the AI provider at the same time instead of queueing behind each other.

    # 1. Enforce Mandatory Logged-In User Authentication (JWT)
    user_payload = verify_authenticated_user(request)
    user_identifier = str(user_payload.get("sub") or user_payload.get("user_id") or "user")

    # 2. Too many scans at once: say so quickly, before anything is counted against this user.
    if not _enter_scan():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We're very busy right now. Please try again in a moment.",
            headers={"Retry-After": "3"},
        )

    try:
        # 3. Per-user limits (4 a minute, 7 a day), both kept in Redis so they hold across workers.
        burst_member = vision_rate_limiter.check(user_identifier)
        vision_daily_scan_limiter.check_and_increment(user_identifier)

        try:
            # 4. Chunked read with early abort to prevent RAM exhaustion
            chunks: list[bytes] = []
            total_bytes = 0
            while True:
                chunk = file.file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Image file size exceeds the 15MB limit. Please upload a smaller photo.",
                    )
                chunks.append(chunk)

            if total_bytes == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The uploaded file is empty.",
                )

            content = b"".join(chunks)

            # 5. Cryptographic / Magic Byte binary inspection
            verified_mime = validate_image_magic_bytes(content[:16])

            # 6. Inference via the pipeline (AI provider first, built-in model as the fallback)
            pipeline = get_pipeline()
            return pipeline.predict_from_bytes(content, mime_type=verified_mime)
        except HTTPException:
            # The photo was unusable (too big, empty, not an image): no AI call was made, so the scan is given back.
            vision_daily_scan_limiter.refund(user_identifier)
            raise
        except Exception:
            # Our side failed (provider and fallback both): give the scan back and say so plainly.
            logging.getLogger("uvicorn.error").exception("Pet scan failed on our side")
            vision_daily_scan_limiter.refund(user_identifier)
            vision_rate_limiter.refund(user_identifier, burst_member)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="We couldn't analyse this photo right now. This scan was not counted, so please try again in a moment.",
                headers={"Retry-After": "5"},
            )
    finally:
        _leave_scan()
