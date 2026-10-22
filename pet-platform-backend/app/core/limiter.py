import redis
from fastapi import Request, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from app.core.config import settings


def get_real_client_ip(request: Request) -> str:
    """nginx sits in front of this app and appends the real connecting IP
    as the LAST entry of X-Forwarded-For via $proxy_add_x_forwarded_for --
    any earlier entries could be spoofed by the client itself, so only the
    last one is trustworthy. Without this, slowapi's default key_func reads
    request.client.host, which behind a reverse proxy is nginx's own
    address for every request -- turning every per-IP rate limit in this
    app into one shared bucket for all visitors combined, rather than a
    limit per actual visitor.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_real_client_ip, storage_uri=settings.RATE_LIMIT_REDIS_URL)

# Raw client for hand-rolled rate-limit logic that needs direct pipeline/TTL
# access beyond slowapi's decorator API (e.g. OTP cooldown/count checks in
# app/api/auth.py). Shares the same dedicated instance as the limiter above
# rather than the cache client, so it isn't subject to cache eviction.
rate_limit_redis_client = redis.Redis.from_url(settings.RATE_LIMIT_REDIS_URL, decode_responses=True)


def rate_limit_handler(request: Request, exc: Exception) -> Response:
    if isinstance(exc, RateLimitExceeded):
        return _rate_limit_exceeded_handler(request, exc)
    return Response(content="Rate limit exceeded", status_code=429)
