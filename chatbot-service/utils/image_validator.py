"""Image validator enforcing size limits, MIME types, and magic bytes (Edge Case #11)."""

from fastapi import HTTPException, UploadFile

MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

# Magic byte signatures
MAGIC_BYTES = {
    b"\xFF\xD8\xFF": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # WebP RIFF header
}


def validate_image_file(file: UploadFile, contents: bytes) -> str:
    """Validate image file size, content type, and magic bytes before sending to Vision model."""
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty (0 bytes).")

    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Image file size exceeds maximum limit of 10MB ({len(contents)} bytes).",
        )

    mime_type = file.content_type or "image/jpeg"
    if mime_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{mime_type}'. Allowed types: JPEG, PNG, WEBP.",
        )

    # Magic Bytes Signature Verification
    valid_magic = False
    for magic, detected_mime in MAGIC_BYTES.items():
        if contents.startswith(magic):
            valid_magic = True
            mime_type = detected_mime
            break

    if not valid_magic:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file format. File contents do not match JPEG, PNG, or WEBP magic bytes.",
        )

    return mime_type
