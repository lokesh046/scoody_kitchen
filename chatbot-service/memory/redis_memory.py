"""Redis Conversation Memory Manager with TTL & User Session Isolation."""

import json
import os
from typing import Any

# TODO: [Edge Case #9] Add Redis Token-Bucket Rate Limiter & Per-User Token Cost Tracking Engine
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


class RedisSessionMemory:
    """Session history persistence with TTL management & key isolation."""

    def __init__(self, ttl_seconds: int = 1800):
        self.ttl_seconds = ttl_seconds
        self.redis_active = False
        self._in_memory: dict[str, list[dict[str, Any]]] = {}

        try:
            import redis
            self.client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
            self.client.ping()
            self.redis_active = True
        except Exception:
            self.redis_active = False

    def _get_key(self, session_id: str) -> str:
        return f"chat:session:{session_id}"

    def get_history(self, session_id: str) -> list[dict[str, Any]]:
        """Retrieve conversation history for session."""
        key = self._get_key(session_id)
        if self.redis_active:
            try:
                raw_data = self.client.get(key)
                if raw_data:
                    return json.loads(raw_data)
                return []
            except Exception:
                pass
        return list(self._in_memory.get(session_id, []))

    def save_message(self, session_id: str, role: str, content: str) -> None:
        """Append message to session history with TTL refresh."""
        key = self._get_key(session_id)
        history = self.get_history(session_id)
        history.append({"role": role, "content": content})

        if self.redis_active:
            try:
                self.client.setex(key, self.ttl_seconds, json.dumps(history))
                return
            except Exception:
                pass
        self._in_memory[session_id] = history

    def clear_session(self, session_id: str) -> None:
        """Purge session conversation history (e.g. on logout)."""
        key = self._get_key(session_id)
        if self.redis_active:
            try:
                self.client.delete(key)
            except Exception:
                pass
        self._in_memory.pop(session_id, None)


session_memory = RedisSessionMemory()
