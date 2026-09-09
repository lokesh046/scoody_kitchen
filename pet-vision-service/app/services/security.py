import os
import time
import jwt
from collections import defaultdict
from fastapi import Request, HTTPException, status
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY or not JWT_SECRET_KEY.strip():
    raise RuntimeError(
        "CRITICAL CONFIGURATION ERROR: 'JWT_SECRET_KEY' environment variable is not configured. "
        "The Pet Vision Service refuses to start with an empty or insecure fallback key. "
        "Please provide a secure 256-bit JWT secret in your environment or .env file."
    )
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


def verify_authenticated_user(request: Request) -> dict:
    """
    Enforce mandatory user authentication for Pet Vision AI.
    Extracts and validates the JWT Bearer token from the Authorization header.
    Returns the decoded token payload (user info).
    """
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Please log in to your account to access the AI Pet Vision Scanner.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format: Bearer token expected.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired: Your login token has expired. Please refresh or log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: Authentication verification failed.",
            headers={"WWW-Authenticate": "Bearer"},
        )


class UserRateLimiter:
    """Sliding-window in-memory rate limiter per authenticated user / IP."""
    def __init__(self, max_requests: int = 4, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, user_key: str):
        now = time.time()
        cutoff = now - self.window_seconds

        # Clean old timestamps
        valid_timestamps = [ts for ts in self._requests[user_key] if ts > cutoff]
        self._requests[user_key] = valid_timestamps

        if len(valid_timestamps) >= self.max_requests:
            oldest = valid_timestamps[0]
            retry_after = max(1, int(self.window_seconds - (now - oldest)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: Maximum {self.max_requests} classifications per minute allowed. Please wait {retry_after}s before scanning another pet.",
                headers={"Retry-After": str(retry_after)}
            )

        self._requests[user_key].append(now)


# Global singleton rate limiter (4 requests per minute per user)
vision_rate_limiter = UserRateLimiter(max_requests=4, window_seconds=60)


def validate_image_magic_bytes(header_bytes: bytes) -> str:
    """
    Inspect the first 16 bytes to guarantee it is genuinely a JPEG, PNG, WebP, or HEIC image.
    Returns the detected canonical mime type.
    """
    if len(header_bytes) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is too small to be a valid image."
        )

    # 1. JPEG: \xff\xd8\xff
    if header_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    # 2. PNG: \x89PNG\r\n\x1a\n
    if header_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    # 3. WebP: Starts with 'RIFF' and contains 'WEBP' at index 8..12
    if header_bytes.startswith(b"RIFF") and b"WEBP" in header_bytes[:16]:
        return "image/webp"

    # 4. GIF: GIF87a or GIF89a
    if header_bytes.startswith(b"GIF87a") or header_bytes.startswith(b"GIF89a"):
        return "image/gif"

    # 5. HEIC / HEIF / MP4 container with ftyp
    if b"ftyp" in header_bytes[:16]:
        return "image/heic"

    # 6. BMP: Starts with 'BM'
    if header_bytes.startswith(b"BM"):
        return "image/bmp"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid image format: Binary signature does not match a valid JPEG, PNG, WebP, or HEIC photo."
    )
