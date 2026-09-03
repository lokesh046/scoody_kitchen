from fastapi import APIRouter, File, UploadFile, HTTPException, Request, status
from app.schemas import ClassificationResponse
from app.services.pipeline import get_pipeline
from app.services.security import (
    verify_authenticated_user,
    vision_rate_limiter,
    validate_image_magic_bytes,
)

router = APIRouter()

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
CHUNK_SIZE = 64 * 1024  # 64 KB per stream chunk


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
async def classify_pet(
    request: Request,
    file: UploadFile = File(..., description="Pet photo from camera or gallery upload"),
):
    # 1. Enforce Mandatory Logged-In User Authentication (JWT)
    user_payload = verify_authenticated_user(request)
    user_identifier = str(user_payload.get("sub") or user_payload.get("user_id") or "user")

    # 2. Enforce User-Based Rate Limiting (4 classifications per minute per user)
    vision_rate_limiter.check(user_identifier)

    # 2. Chunked Stream Read with Early Abort to prevent RAM Exhaustion
    chunks: list[bytes] = []
    total_bytes = 0

    while True:
        chunk = await file.read(CHUNK_SIZE)
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

    # 3. Cryptographic / Magic Byte binary inspection
    verified_mime = validate_image_magic_bytes(content[:16])

    # 4. In-Memory Inference via Pipeline
    pipeline = get_pipeline()
    result = pipeline.predict_from_bytes(content, mime_type=verified_mime)

    return result
