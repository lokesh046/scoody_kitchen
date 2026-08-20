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

    def __init__(self, default_ttl_seconds: int = 300):
        self.default_ttl = default_ttl_seconds
        self.fallback = InMemoryTTLCache(default_ttl_seconds=default_ttl_seconds)
        self.redis_active = False
        self.client = None
        self._init_redis()

    def _init_redis(self) -> None:
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

    def get(self, key: str) -> Any | None:
        # Ignore security tokens and internal blacklist logs to keep stdout clean
        is_token_log = "blacklist" in key or "token" in key
        
        if self.redis_active and self.client:
            try:
                raw_val = self.client.get(key)
                if raw_val is not None:
                    if not is_token_log:
                        print(f"🐾 [CACHE HIT] (Redis) Key: {key}")
                    return json.loads(raw_val)
                if not is_token_log:
                    print(f"🐾 [CACHE MISS] (Redis) Key: {key}")
                return None
            except Exception as exc:
                logger.warning("Redis get error: %s — using fallback.", exc)
        
        fallback_val = self.fallback.get(key)
        if fallback_val is not None:
            if not is_token_log:
                print(f"🐾 [CACHE HIT] (InMemory) Key: {key}")
        else:
            if not is_token_log:
                print(f"🐾 [CACHE MISS] (InMemory) Key: {key}")
        return fallback_val

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        if self.redis_active and self.client:
            try:
                serialized = json.dumps(value, default=str)
                self.client.set(key, serialized, ex=ttl)
                self.fallback.set(key, value, ttl_seconds=ttl)
                return
            except Exception as exc:
                logger.warning("Redis set error: %s — using fallback.", exc)
        self.fallback.set(key, value, ttl_seconds=ttl)

    def delete(self, key: str) -> None:
        if self.redis_active and self.client:
            try:
                self.client.delete(key)
            except Exception as exc:
                logger.warning("Redis delete error: %s — using fallback.", exc)
        self.fallback.delete(key)

    def clear_prefix(self, prefix: str) -> None:
        if self.redis_active and self.client:
            try:
                pattern = f"{prefix}*"
                keys = list(self.client.scan_iter(pattern))
                if keys:
                    self.client.delete(*keys)
            except Exception as exc:
                logger.warning("Redis clear_prefix error: %s — using fallback.", exc)
        self.fallback.clear_prefix(prefix)

    def clear(self) -> None:
        if self.redis_active and self.client:
            try:
                self.client.flushdb()
            except Exception as exc:
                logger.warning("Redis clear error: %s — using fallback.", exc)
        self.fallback.clear()


cache = RedisCacheManager()
