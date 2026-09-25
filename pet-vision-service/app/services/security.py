import os
import time
import jwt
import redis
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

# Same physical Redis used by pet-platform-backend's own rate limiter
# (db index 2, "isolated rate-limiter" instance) — reused here rather than
# spinning up a dedicated Redis just for this one counter. Keys are
# namespaced ("vision_scan_count:") so they never collide with the
# backend's own keys ("otp_count:", etc.) on the same instance.
RATE_LIMIT_REDIS_URL = os.getenv("RATE_LIMIT_REDIS_URL", "redis://localhost:6379/2")
daily_scan_redis_client = redis.Redis.from_url(RATE_LIMIT_REDIS_URL, decode_responses=True)


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
    """
    Sliding-window rate limiter per authenticated user, backed by a Redis
    sorted set (score = request timestamp) rather than an in-process dict.
    This used to be in-memory, which was fine for a single instance but
    silently breaks under multiple replicas behind a load balancer — each
    replica would count independently, so N replicas would let a user
    effectively get N times the limit depending on which one handled each
    request. Redis makes the count shared and correct regardless of how
    many vision-service replicas are running.
    """
    def __init__(self, max_requests: int = 4, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def check(self, user_key: str):
        key = f"vision_burst:{user_key}"
        now = time.time()
        cutoff = now - self.window_seconds

        pipe = daily_scan_redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, cutoff)
        pipe.zrange(key, 0, 0, withscores=True)
        pipe.zcard(key)
        _, oldest, current_count = pipe.execute()

        if current_count >= self.max_requests:
            oldest_ts = oldest[0][1] if oldest else now
            retry_after = max(1, int(self.window_seconds - (now - oldest_ts)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: Maximum {self.max_requests} classifications per minute allowed. Please wait {retry_after}s before scanning another pet.",
                headers={"Retry-After": str(retry_after)}
            )

        pipe = daily_scan_redis_client.pipeline()
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, self.window_seconds)
        pipe.execute()


# Global singleton rate limiter (4 requests per minute per user) — guards
# against rapid-fire bursts (e.g. a retry loop hammering the endpoint).
# Safe across multiple vision-service replicas since it's Redis-backed.
vision_rate_limiter = UserRateLimiter(max_requests=4, window_seconds=60)


class DailyScanLimiter:
    """
    Redis-backed rolling 24-hour cap per user, independent of the in-memory
    per-minute burst limiter above. Persists across service restarts (unlike
    the in-memory limiter) since it exists to cap Gemini API cost per user,
    not just smooth bursts. The window starts on a user's first scan and
    rolls forward from there (via Redis EXPIRE on first increment), rather
    than resetting at a fixed calendar boundary.
    """
    def __init__(self, max_scans: int = 7, window_seconds: int = 86400):
        self.max_scans = max_scans
        self.window_seconds = window_seconds

    def check_and_increment(self, user_key: str):
        count_key = f"vision_scan_count:{user_key}"

        pipe = daily_scan_redis_client.pipeline()
        pipe.get(count_key)
        pipe.ttl(count_key)
        current_count, ttl = pipe.execute()

        current_count = int(current_count) if current_count is not None else 0

        if current_count >= self.max_scans:
            wait_minutes = max(1, ttl // 60) if ttl and ttl > 0 else 24 * 60
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Daily scan limit reached: you can scan up to {self.max_scans} pets per day. "
                    f"Try again in {wait_minutes} minutes."
                ),
                headers={"Retry-After": str(ttl if ttl and ttl > 0 else self.window_seconds)},
            )

        pipe = daily_scan_redis_client.pipeline()
        pipe.incr(count_key)
        if current_count == 0:
            pipe.expire(count_key, self.window_seconds)
        pipe.execute()


# Global singleton daily cap (7 scans per rolling 24 hours per user)
vision_daily_scan_limiter = DailyScanLimiter(max_scans=7, window_seconds=86400)


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
