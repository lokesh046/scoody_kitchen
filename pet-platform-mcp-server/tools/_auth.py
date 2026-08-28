import os
import jwt
import redis
import math
from datetime import datetime, timezone

MCP_CALL_TOKEN_SECRET = os.getenv("MCP_CALL_TOKEN_SECRET")
if not MCP_CALL_TOKEN_SECRET:
    raise RuntimeError("MCP_CALL_TOKEN_SECRET environment variable is not configured.")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Setup Redis client with in-memory thread-safe fallback for JTI tracking
_redis_client = None
_redis_active = False
_jti_memory_cache = set()

try:
    _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    _redis_client.ping()
    _redis_active = True
except Exception:
    _redis_active = False

def verify_mcp_call_token(token: str) -> int:
    """Verify the incoming JWT token and return the authorized session_user_id.

    Checks:
    1. Signature matches MCP_CALL_TOKEN_SECRET.
    2. Expiration (exp claim).
    3. Replay prevention: jti uniqueness check against Redis or in-memory set.
    """
    if not token:
        raise PermissionError("Access denied: missing mcp_call_token parameter.")

    try:
        payload = jwt.decode(
            token,
            MCP_CALL_TOKEN_SECRET,
            algorithms=["HS256"],
            issuer="chatbot-service"
        )
    except jwt.ExpiredSignatureError:
        raise PermissionError("Access denied: mcp_call_token has expired.")
    except jwt.InvalidTokenError as exc:
        raise PermissionError(f"Access denied: invalid mcp_call_token. Details: {exc}")

    user_id_str = payload.get("sub")
    jti = payload.get("jti")
    exp = payload.get("exp")

    if not user_id_str or not jti or not exp:
        raise PermissionError("Access denied: incomplete token claims.")

    # Replay Prevention Check
    cache_key = f"jti:{jti}"
    if _redis_active and _redis_client:
        try:
            now = datetime.now(timezone.utc).timestamp()
            ttl = int(math.ceil(exp - now))
            if ttl <= 0:
                raise PermissionError("Access denied: token is already expired.")

            # setnx returns True if the key was set (i.e. did not exist)
            is_new = _redis_client.set(cache_key, "used", ex=ttl, nx=True)
            if not is_new:
                raise PermissionError("Access denied: token replay detected.")
        except redis.RedisError:
            # Fallback to local memory if Redis fails
            if jti in _jti_memory_cache:
                raise PermissionError("Access denied: token replay detected.")
            _jti_memory_cache.add(jti)
    else:
        if jti in _jti_memory_cache:
            raise PermissionError("Access denied: token replay detected.")
        _jti_memory_cache.add(jti)

    try:
        return int(user_id_str)
    except ValueError:
        raise PermissionError("Access denied: invalid user ID format.")
