from abc import ABC, abstractmethod
import os
import uuid
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

# Allowed image MIME types and magic byte headers
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
}

# Maximum default file size: 5 MB
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


class BaseStorageProvider(ABC):
    """Abstract base class for storage providers (S3, Cloudinary, Local, etc.)."""

    @abstractmethod
    def upload_image(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
    ) -> str:
        """Uploads image bytes to the storage provider and returns the public image URL."""
        pass

    @abstractmethod
    def delete_image(self, image_url: str) -> None:
        """Deletes an image from the storage provider using its URL or storage key."""
        pass


class LocalStorageProvider(BaseStorageProvider):
    """Local filesystem storage provider suitable for local development and testing."""

    def __init__(
        self,
        upload_dir: str = "uploads",
        base_url: str = "http://127.0.0.1:8000",
    ):
        self.upload_dir = upload_dir
        self.base_url = base_url.rstrip("/")
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_image(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
    ) -> str:
        key = generate_unique_storage_key(original_filename)
        file_path = os.path.join(self.upload_dir, key)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        return f"{self.base_url}/{self.upload_dir}/{key}"

    def delete_image(self, image_url: str) -> None:
        if not image_url:
            return

        target_path_marker = f"/{self.upload_dir}/"
        if target_path_marker in image_url:
            rel_path = image_url.split(target_path_marker, 1)[-1]
            file_path = os.path.join(self.upload_dir, rel_path)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass


class CloudinaryStorageProvider(BaseStorageProvider):
    """Cloudinary cloud media storage provider with automatic CDN distribution."""

    def __init__(
        self,
        cloud_name: str | None = None,
        api_key: str | None = None,
        api_secret: str | None = None,
    ):
        self.cloud_name = settings.CLOUDINARY_CLOUD_NAME if cloud_name is None else cloud_name
        self.api_key = settings.CLOUDINARY_API_KEY if api_key is None else api_key
        self.api_secret = settings.CLOUDINARY_API_SECRET if api_secret is None else api_secret

        if not (self.cloud_name and self.api_key and self.api_secret):
            raise ValueError(
                "Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) must be configured."
            )

        import cloudinary
        cloudinary.config(
            cloud_name=self.cloud_name,
            api_key=self.api_key,
            api_secret=self.api_secret,
            secure=True,
        )

    def upload_image(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
    ) -> str:
        import cloudinary.uploader

        response = cloudinary.uploader.upload(
            file_bytes,
            folder="scooby_kitchen",
            resource_type="image",
            fetch_format="auto",
            quality="auto",
        )
        url = response.get("secure_url") or response.get("url")
        if not url:
            raise RuntimeError("Cloudinary upload did not return a valid URL.")
        return url

    def delete_image(self, image_url: str) -> None:
        if not image_url:
            return
        import cloudinary.uploader
        try:
            parts = image_url.split("/upload/")
            if len(parts) > 1:
                path = parts[1]
                # strip version prefix if present e.g. v12345/
                if path.startswith("v") and "/" in path:
                    path = path.split("/", 1)[1]
                public_id = os.path.splitext(path)[0]
                cloudinary.uploader.destroy(public_id)
        except Exception:
            pass


def get_storage_provider() -> BaseStorageProvider:
    """Factory function returning configured storage provider instance."""
    provider_name = settings.IMAGE_STORAGE_PROVIDER.lower()
    if provider_name == "local":
        return LocalStorageProvider(
            upload_dir=settings.UPLOAD_DIR,
            base_url=settings.BASE_URL,
        )
    elif provider_name == "cloudinary":
        return CloudinaryStorageProvider(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
        )
    raise NotImplementedError(
        f"Storage provider '{provider_name}' is not configured or supported."
    )


def validate_image_file(
    file: UploadFile,
    file_bytes: bytes,
    max_size: int = MAX_FILE_SIZE_BYTES,
) -> None:
    """
    Validates file size, non-emptiness, content-type header, and binary magic bytes.
    Raises HTTPException with 400 Bad Request on validation failure.
    """
    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    if len(file_bytes) > max_size:
        max_mb = max_size / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum limit of {max_mb:.1f}MB",
        )

    content_type = file.content_type
    if not content_type or content_type.lower() not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES.keys())}",
        )

    # Magic byte verification
    expected_headers = ALLOWED_IMAGE_TYPES[content_type.lower()]
    header_matched = any(file_bytes.startswith(h) for h in expected_headers)
    if not header_matched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match reported image format",
        )


def generate_unique_storage_key(filename: str) -> str:
    """Generates a secure, non-clashing storage key/filename."""
    ext = os.path.splitext(filename)[1].lower() if filename else ""
    if not ext or ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".jpg"
    return f"products/{uuid.uuid4().hex}{ext}"
