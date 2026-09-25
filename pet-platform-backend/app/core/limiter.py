import redis
from fastapi import Request, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address, storage_uri=settings.RATE_LIMIT_REDIS_URL)

# Raw client for hand-rolled rate-limit logic that needs direct pipeline/TTL
# access beyond slowapi's decorator API (e.g. OTP cooldown/count checks in
# app/api/auth.py). Shares the same dedicated instance as the limiter above
# rather than the cache client, so it isn't subject to cache eviction.
rate_limit_redis_client = redis.Redis.from_url(settings.RATE_LIMIT_REDIS_URL, decode_responses=True)


def rate_limit_handler(request: Request, exc: Exception) -> Response:
    if isinstance(exc, RateLimitExceeded):
        return _rate_limit_exceeded_handler(request, exc)
    return Response(content="Rate limit exceeded", status_code=429)
