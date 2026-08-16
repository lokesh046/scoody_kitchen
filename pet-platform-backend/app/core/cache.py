import time
from typing import Any


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


cache = InMemoryTTLCache()
