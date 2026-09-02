from fastapi import APIRouter, File, UploadFile, HTTPException, status
from app.schemas import ClassificationResponse
from app.services.pipeline import get_pipeline

router = APIRouter()

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    "image/heic",
    "image/heif",
    "application/octet-stream",  # Mobile file pickers sometimes send this
}

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB


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
    file: UploadFile = File(..., description="Pet photo from camera or gallery upload"),
):
    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format ({file.content_type}). Please upload a JPEG, PNG, or WebP photo.",
        )

    # Read bytes directly into memory
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file size exceeds the 15MB limit.",
        )

    pipeline = get_pipeline()
    result = pipeline.predict_from_bytes(content, mime_type=file.content_type or "image/jpeg")

    return result
