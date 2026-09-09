"""Redis cache for knowledge_agent answers.

FAQ-style questions ("what's your return policy", "do you ship to X") give
the same answer to every user, unlike order status or bookings — so they're
safe to cache across sessions/users. A cache hit skips the RAG lookup and
the LLM call entirely, turning a multi-second round-trip into a single fast
Redis read. Keyed purely on normalized query text (no session/user scoping),
and fails open: any Redis problem is treated as a cache miss so the agent
always falls back to its normal, correct behavior.
"""

import hashlib
import json
import os
import re
from typing import Any

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

# How long a cached answer lives before it's forced to refresh. Bounds how
# long a stale answer (e.g. after a knowledge-base update) can keep being
# served — short enough to self-heal, long enough to actually save repeat
# lookups for genuinely common questions.
KNOWLEDGE_CACHE_TTL_SECONDS = int(os.getenv("KNOWLEDGE_CACHE_TTL_SECONDS", "21600"))  # 6 hours

_WHITESPACE_RE = re.compile(r"\s+")
_TRAILING_PUNCT_RE = re.compile(r"[?!.]+$")


def _normalize(query: str) -> str:
    """Collapse trivial phrasing differences (case, spacing, trailing
    punctuation) so 'What's your return policy?' and 'what's your return
    policy' hit the same cache entry. Does not handle synonyms/rewording —
    that would need embedding similarity, which is a bigger step to take
    only if real traffic shows exact-text hashing isn't catching enough."""
    cleaned = query.strip().lower()
    cleaned = _TRAILING_PUNCT_RE.sub("", cleaned)
    cleaned = _WHITESPACE_RE.sub(" ", cleaned)
    return cleaned.strip()


class KnowledgeQueryCache:
    """Cache for knowledge_agent replies, keyed by normalized query text."""

    def __init__(self, ttl_seconds: int = KNOWLEDGE_CACHE_TTL_SECONDS):
        self.ttl_seconds = ttl_seconds
        self.redis_active = False

        try:
            import redis
            self.client = redis.Redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
            )
            self.client.ping()
            self.redis_active = True
        except Exception:
            self.redis_active = False

    def _key(self, query: str) -> str:
        digest = hashlib.sha256(_normalize(query).encode("utf-8")).hexdigest()
        return f"knowledge_cache:{digest}"

    def get(self, query: str) -> dict[str, Any] | None:
        """Returns {'reply': str, 'sources': list[str]} on a hit, else None.
        Any Redis error is swallowed and treated as a miss — a broken cache
        must never block or corrupt a real answer."""
        if not self.redis_active:
            return None
        try:
            raw = self.client.get(self._key(query))
            if not raw:
                return None
            return json.loads(raw)
        except Exception:
            return None

    def set(self, query: str, reply: str, sources: list[str]) -> None:
        """Best-effort write — failures are swallowed since caching is an
        optimization, never a requirement for the agent to function."""
        if not self.redis_active:
            return
        try:
            payload = json.dumps({"reply": reply, "sources": sources})
            self.client.setex(self._key(query), self.ttl_seconds, payload)
        except Exception:
            pass

    # --- Async wrappers -----------------------------------------------
    # Same asyncio.to_thread pattern as RedisSessionMemory: these Redis
    # calls are synchronous/blocking, so an `async def` caller must offload
    # them to a thread rather than await them directly, or it would freeze
    # the event loop for every other in-flight request.

    async def aget(self, query: str) -> dict[str, Any] | None:
        import asyncio
        return await asyncio.to_thread(self.get, query)

    async def aset(self, query: str, reply: str, sources: list[str]) -> None:
        import asyncio
        await asyncio.to_thread(self.set, query, reply, sources)


knowledge_cache = KnowledgeQueryCache()
