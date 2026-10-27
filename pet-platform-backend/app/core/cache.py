import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)


class InMemoryTTLCache:
    """Thread-safe, sub-millisecond in-memory cache manager with TTL expiration."""

    def __init__(self, default_ttl_seconds: int = 300):
        self._cache: dict[str, tuple[Any, float]] = {}
        self.default_ttl = default_ttl_seconds

    def get(self, key: str) -> Any | None:
        if key in self._cache:
            val, expiry = self._cache[key]
            if time.time() < expiry:
                return val
            del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        expiry = time.time() + ttl
        self._cache[key] = (value, expiry)

    def delete(self, key: str) -> None:
        self._cache.pop(key, None)

    def clear_prefix(self, prefix: str) -> None:
        keys_to_del = [k for k in self._cache if k.startswith(prefix)]
        for k in keys_to_del:
            self._cache.pop(k, None)

    def clear(self) -> None:
        self._cache.clear()


class RedisCacheManager:
    """Hybrid Redis Cache Manager with automatic graceful fallback to InMemoryTTLCache."""

    # How long to wait before retrying a Redis connection that failed. Connecting
    # used to be attempted exactly once, at import: a worker that booted while
    # Redis was briefly unreachable then fell back to the per-process in-memory
    # cache for its whole life, so every "cached" endpoint quietly served from a
    # cache each worker held separately and nothing ever reached Redis again.
    RECONNECT_INTERVAL_SECONDS = 30

    def __init__(self, default_ttl_seconds: int = 300):
        self.default_ttl = default_ttl_seconds
        self.fallback = InMemoryTTLCache(default_ttl_seconds=default_ttl_seconds)
        self.redis_active = False
        self.client = None
        self.hits = 0
        self.misses = 0
        self._last_connect_attempt = 0.0
        self._init_redis()

    def _init_redis(self) -> None:
        self._last_connect_attempt = time.monotonic()
        try:
            import redis
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            self.client = redis.Redis.from_url(redis_url, decode_responses=True)
            self.client.ping()
            self.redis_active = True
            logger.info("Redis cache manager connected successfully.")
        except Exception as exc:
            self.redis_active = False
            logger.warning("Redis unavailable (%s) — falling back to InMemoryTTLCache.", exc)

    def _redis_ready(self) -> bool:
        """True when Redis is usable, retrying a failed connection at most every
        RECONNECT_INTERVAL_SECONDS so a dead Redis never costs a connect per request."""
        if self.redis_active and self.client:
            return True
        if time.monotonic() - self._last_connect_attempt < self.RECONNECT_INTERVAL_SECONDS:
            return False
        self._init_redis()
        return self.redis_active and self.client is not None

    def get_stats(self) -> dict[str, Any]:
        total = self.hits + self.misses
        ratio = round((self.hits / total) * 100, 2) if total > 0 else 0.0
        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_queries": total,
            "hit_ratio_percentage": ratio,
            "redis_active": self.redis_active,
        }

    def get(self, key: str) -> Any | None:
        # Ignore security tokens and internal blacklist logs to keep logs clean
        is_token_log = "blacklist" in key or "token" in key
        
        if self._redis_ready():
            try:
                raw_val = self.client.get(key)
                if raw_val is not None:
                    self.hits += 1
                    if not is_token_log:
                        logger.debug("🐾 [CACHE HIT] (Redis) Key: %s", key)
                    return json.loads(raw_val)
                self.misses += 1
                if not is_token_log:
                    logger.debug("🐾 [CACHE MISS] (Redis) Key: %s", key)
                return None
            except Exception as exc:
                logger.warning("Redis get error: %s — using fallback.", exc)
                self.redis_active = False
        
        fallback_val = self.fallback.get(key)
        if fallback_val is not None:
            self.hits += 1
            if not is_token_log:
                logger.debug("🐾 [CACHE HIT] (InMemory) Key: %s", key)
        else:
            self.misses += 1
            if not is_token_log:
                logger.debug("🐾 [CACHE MISS] (InMemory) Key: %s", key)
        return fallback_val

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        if self._redis_ready():
            try:
                serialized = json.dumps(value, default=str)
                self.client.set(key, serialized, ex=ttl)
                self.fallback.set(key, value, ttl_seconds=ttl)
                return
            except Exception as exc:
                logger.warning("Redis set error: %s — using fallback.", exc)
                self.redis_active = False
        self.fallback.set(key, value, ttl_seconds=ttl)

    def delete(self, key: str) -> None:
        if self._redis_ready():
            try:
                self.client.delete(key)
            except Exception as exc:
                logger.warning("Redis delete error: %s — using fallback.", exc)
                self.redis_active = False
        self.fallback.delete(key)

    def clear_prefix(self, prefix: str) -> None:
        if self._redis_ready():
            try:
                pattern = f"{prefix}*"
                keys = list(self.client.scan_iter(pattern))
                if keys:
                    self.client.delete(*keys)
            except Exception as exc:
                logger.warning("Redis clear_prefix error: %s — using fallback.", exc)
                self.redis_active = False
        self.fallback.clear_prefix(prefix)

    def clear(self) -> None:
        if self._redis_ready():
            try:
                self.client.flushdb()
            except Exception as exc:
                logger.warning("Redis clear error: %s — using fallback.", exc)
                self.redis_active = False
        self.fallback.clear()


cache = RedisCacheManager()
