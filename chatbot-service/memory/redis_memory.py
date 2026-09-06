"""Redis Conversation Memory Manager with TTL & User Session Isolation."""

import json
import os
from typing import Any

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")


class RedisSessionMemory:
    """Session history persistence with TTL management & key isolation."""

    def __init__(self, ttl_seconds: int = 1800):
        self.ttl_seconds = ttl_seconds
        self.redis_active = False
        self._in_memory: dict[str, Any] = {}

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
                key_type = self.client.type(key)
                if isinstance(key_type, bytes):
                    key_type = key_type.decode("utf-8")

                if key_type == "string":
                    raw_data = self.client.get(key)
                    self.client.delete(key)
                    if raw_data:
                        old_history = json.loads(raw_data)
                        if old_history:
                            self.client.rpush(key, *[json.dumps(m) for m in old_history])
                            self.client.expire(key, self.ttl_seconds)
                            return old_history
                    return []

                raw_messages = self.client.lrange(key, 0, -1)
                if raw_messages:
                    return [json.loads(m.decode("utf-8") if isinstance(m, bytes) else m) for m in raw_messages]
                return []
            except Exception:
                pass
        return list(self._in_memory.get(session_id, []))

    def save_message(self, session_id: str, role: str, content: str) -> None:
        """Append message to session history with TTL refresh."""
        key = self._get_key(session_id)
        new_msg = {"role": role, "content": content}

        if self.redis_active:
            try:
                key_type = self.client.type(key)
                if isinstance(key_type, bytes):
                    key_type = key_type.decode("utf-8")

                if key_type == "string":
                    raw_data = self.client.get(key)
                    self.client.delete(key)
                    if raw_data:
                        old_history = json.loads(raw_data)
                        if old_history:
                            self.client.rpush(key, *[json.dumps(m) for m in old_history])

                self.client.rpush(key, json.dumps(new_msg))
                self.client.ltrim(key, -40, -1)
                self.client.expire(key, self.ttl_seconds)
                return
            except Exception:
                pass
        history = list(self._in_memory.get(session_id, []))
        history.append(new_msg)
        self._in_memory[session_id] = history[-40:]

    def clear_session(self, session_id: str) -> None:
        """Purge session conversation history (e.g. on logout)."""
        key = self._get_key(session_id)
        if self.redis_active:
            try:
                self.client.delete(key)
            except Exception:
                pass
        self._in_memory.pop(session_id, None)

    def blacklist_token(self, token_hash: str, ttl_seconds: int) -> None:
        """Blacklist an access token on logout."""
        key = f"blacklist:access:{token_hash}"
        if self.redis_active:
            try:
                self.client.setex(key, ttl_seconds, "revoked")
                return
            except Exception:
                pass
        self._in_memory[key] = [{"role": "revoked", "content": "revoked"}]

    def is_token_blacklisted(self, token_hash: str) -> bool:
        """Check if an access token hash is blacklisted."""
        key = f"blacklist:access:{token_hash}"
        if self.redis_active:
            try:
                return bool(self.client.get(key))
            except Exception:
                pass
        return key in self._in_memory

    def set_pending_action(self, session_id: str, action: str, args: dict) -> None:
        """Store pending state-changing action for verification on the next turn."""
        key = f"pending_action:{session_id}"
        data = json.dumps({"action": action, "args": args})
        if self.redis_active:
            try:
                self.client.setex(key, 300, data)
                return
            except Exception:
                pass
        self._in_memory[key] = data

    def get_pending_action(self, session_id: str) -> dict | None:
        """Retrieve and parse pending action details."""
        key = f"pending_action:{session_id}"
        raw = None
        if self.redis_active:
            try:
                raw = self.client.get(key)
            except Exception:
                pass
        else:
            raw = self._in_memory.get(key)

        if raw:
            try:
                return json.loads(raw)
            except Exception:
                pass
        return None

    def clear_pending_action(self, session_id: str) -> None:
        """Clear pending action status once completed or expired."""
        key = f"pending_action:{session_id}"
        if self.redis_active:
            try:
                self.client.delete(key)
            except Exception:
                pass
        self._in_memory.pop(key, None)

    def create_pending_action(self, user_id: int, session_id: str, action: str, args: dict) -> str:
        """Create a new first-class pending action ticket with automatic expiration."""
        import secrets
        from datetime import datetime, timezone, timedelta
        
        confirmation_id = f"conf_{secrets.token_hex(4)}" # 8-character hex code
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=300)
        
        ticket = {
            "confirmation_id": confirmation_id,
            "user_id": user_id,
            "session_id": session_id,
            "action": action,
            "arguments": args,
            "status": "pending",
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        }
        
        ticket_key = f"pending_ticket:{confirmation_id}"
        session_key = f"pending_session_ticket:{session_id}"
        data = json.dumps(ticket)
        
        if self.redis_active:
            try:
                self.client.setex(ticket_key, 300, data)
                self.client.setex(session_key, 300, confirmation_id)
                return confirmation_id
            except Exception:
                pass
        
        self._in_memory[ticket_key] = data
        self._in_memory[session_key] = confirmation_id
        return confirmation_id

    def get_pending_action_by_id(self, confirmation_id: str) -> dict | None:
        """Retrieve and parse pending action ticket details by ID."""
        ticket_key = f"pending_ticket:{confirmation_id}"
        raw = None
        if self.redis_active:
            try:
                raw = self.client.get(ticket_key)
            except Exception:
                pass
        else:
            raw = self._in_memory.get(ticket_key)

        if raw:
            try:
                return json.loads(raw)
            except Exception:
                pass
        return None

    def get_active_session_ticket_id(self, session_id: str) -> str | None:
        """Resolve the active confirmation ticket ID for a given session."""
        session_key = f"pending_session_ticket:{session_id}"
        if self.redis_active:
            try:
                val = self.client.get(session_key)
                if isinstance(val, bytes):
                    return val.decode("utf-8")
                return val
            except Exception:
                pass
        val = self._in_memory.get(session_key)
        if isinstance(val, bytes):
            return val.decode("utf-8")
        return str(val) if val is not None else None

    def consume_pending_action(self, confirmation_id: str, session_id: str) -> None:
        """Mark the pending ticket as consumed by deleting it from Redis."""
        ticket_key = f"pending_ticket:{confirmation_id}"
        session_key = f"pending_session_ticket:{session_id}"
        if self.redis_active:
            try:
                self.client.delete(ticket_key)
                self.client.delete(session_key)
            except Exception:
                pass
        self._in_memory.pop(ticket_key, None)
        self._in_memory.pop(session_key, None)


    # --- Async wrappers -------------------------------------------------
    # The methods above use the synchronous `redis` client, which blocks
    # the event loop for the duration of the network round-trip. These
    # wrappers push the (fast, I/O-bound) call onto a worker thread via
    # asyncio.to_thread so an `async def` caller can `await` them without
    # stalling other concurrent requests on the same process. Prefer these
    # from any async route handler or LangGraph node.

    async def aget_history(self, session_id: str) -> list[dict[str, Any]]:
        import asyncio
        return await asyncio.to_thread(self.get_history, session_id)

    async def asave_message(self, session_id: str, role: str, content: str) -> None:
        import asyncio
        await asyncio.to_thread(self.save_message, session_id, role, content)

    async def aclear_session(self, session_id: str) -> None:
        import asyncio
        await asyncio.to_thread(self.clear_session, session_id)

    async def ais_token_blacklisted(self, token_hash: str) -> bool:
        import asyncio
        return await asyncio.to_thread(self.is_token_blacklisted, token_hash)

    async def aset_pending_action(self, session_id: str, action: str, args: dict) -> None:
        import asyncio
        await asyncio.to_thread(self.set_pending_action, session_id, action, args)

    async def aget_pending_action(self, session_id: str) -> dict | None:
        import asyncio
        return await asyncio.to_thread(self.get_pending_action, session_id)

    async def acreate_pending_action(self, user_id: int, session_id: str, action: str, args: dict) -> str:
        import asyncio
        return await asyncio.to_thread(self.create_pending_action, user_id, session_id, action, args)

    async def aget_pending_action_by_id(self, confirmation_id: str) -> dict | None:
        import asyncio
        return await asyncio.to_thread(self.get_pending_action_by_id, confirmation_id)

    async def aget_active_session_ticket_id(self, session_id: str) -> str | None:
        import asyncio
        return await asyncio.to_thread(self.get_active_session_ticket_id, session_id)

    async def aconsume_pending_action(self, confirmation_id: str, session_id: str) -> None:
        import asyncio
        await asyncio.to_thread(self.consume_pending_action, confirmation_id, session_id)

    async def aclear_pending_action(self, session_id: str) -> None:
        import asyncio
        await asyncio.to_thread(self.clear_pending_action, session_id)


session_memory = RedisSessionMemory()
