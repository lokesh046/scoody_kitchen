"""LangChain Callback Token Cost Tracker & Redis Sliding-Window Rate Limiter Engine."""

import os
import time
from datetime import datetime, timezone
from typing import Any
from fastapi import HTTPException, Request
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from utils.llm_gateway import LiteLLMGateway

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

# Per-user daily token budget — complements the per-minute request-count
# limiter below, which treats every request as equally "expensive"
# regardless of size. A handful of requests that each generate huge
# responses can slip under the request-count limit while still costing
# real money; this catches that. Configurable via env so changing it later
# is a restart, not a code change.
DAILY_TOKEN_LIMIT = int(os.getenv("DAILY_TOKEN_LIMIT", "50000"))


class LangChainTokenCostCallbackHandler(BaseCallbackHandler):
    """Custom LangChain CallbackHandler to track token usage and LiteLLM cost metrics per request."""

    def __init__(self, session_id: str = "default", model_name: str = "gemini/gemini-3.5-flash-lite"):
        super().__init__()
        self.session_id = session_id
        self.model_name = model_name
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.total_tokens = 0
        self.estimated_cost_usd = 0.0

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Callback invoked automatically on LLM execution completion."""
        llm_output = response.llm_output or {}
        token_usage = llm_output.get("token_usage", {})

        # The current langchain-google-genai integration puts real usage on
        # `message.usage_metadata` (a direct attribute of the AIMessage),
        # not in `llm_output` or `generation_info` — verified directly
        # against a live streamed response. Checking this first is what
        # actually works today; the older paths below are kept as a
        # fallback for other model integrations that may still use them.
        if not token_usage and response.generations:
            for gen_list in response.generations:
                for gen in gen_list:
                    message = getattr(gen, "message", None)
                    usage_metadata = getattr(message, "usage_metadata", None) if message else None
                    if usage_metadata:
                        token_usage = {
                            "prompt_tokens": usage_metadata.get("input_tokens", 0),
                            "completion_tokens": usage_metadata.get("output_tokens", 0),
                            "total_tokens": usage_metadata.get("total_tokens", 0),
                        }
                        break

                    gen_info = getattr(gen, "generation_info", {}) or {}
                    if "usage_metadata" in gen_info:
                        meta = gen_info["usage_metadata"]
                        token_usage = {
                            "prompt_tokens": meta.get("input_tokens", 0),
                            "completion_tokens": meta.get("output_tokens", 0),
                            "total_tokens": meta.get("total_tokens", 0),
                        }

        p_tokens = token_usage.get("prompt_tokens", 0)
        c_tokens = token_usage.get("completion_tokens", 0)
        
        self.prompt_tokens += p_tokens
        self.completion_tokens += c_tokens
        self.total_tokens += token_usage.get("total_tokens", p_tokens + c_tokens)

        # Calculate exact API cost via LiteLLM Gateway
        self.estimated_cost_usd += LiteLLMGateway.calculate_completion_cost(
            model=self.model_name,
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
        )


class RedisSlidingWindowRateLimiter:
    """Redis sliding-window rate limiter for API requests."""

    def __init__(self, limit: int = 30, window_seconds: int = 60):
        self.limit = limit
        self.window_seconds = window_seconds
        self.redis_active = False
        # Initialized unconditionally, not just in the except branch below —
        # check_rate_limit() falls through to this fallback on ANY Redis
        # exception (even a transient one after a healthy startup), not
        # only when Redis was down from the start. If this weren't always
        # initialized, that fallback path would crash with AttributeError
        # on the first momentary Redis hiccup instead of degrading safely.
        self._local_counts: dict[str, list[float]] = {}

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

    def check_rate_limit(self, identifier: str) -> None:
        """Enforce rate limit for client IP / User ID. Raises HTTP 429 if exceeded."""
        key = f"rate_limit:{identifier}"
        now = time.time()

        if self.redis_active:
            try:
                pipe = self.client.pipeline()
                pipe.zremrangebyscore(key, 0, now - self.window_seconds)
                pipe.zadd(key, {str(now): now})
                pipe.zcard(key)
                pipe.expire(key, self.window_seconds)
                results = pipe.execute()

                request_count = results[2]
                if request_count > self.limit:
                    raise HTTPException(
                        status_code=429,
                        detail=f"Too Many Requests: Rate limit of {self.limit} requests per minute exceeded.",
                    )
                return
            except Exception as exc:
                if isinstance(exc, HTTPException):
                    raise exc

        # Local fallback sliding window
        timestamps = self._local_counts.get(identifier, [])
        valid_timestamps = [t for t in timestamps if now - t <= self.window_seconds]
        valid_timestamps.append(now)
        self._local_counts[identifier] = valid_timestamps

        if len(valid_timestamps) > self.limit:
            raise HTTPException(
                status_code=429,
                detail=f"Too Many Requests: Rate limit of {self.limit} requests per minute exceeded.",
            )


rate_limiter = RedisSlidingWindowRateLimiter()


class RedisTokenBudget:
    """Per-user daily token budget, backed by Redis.

    Token counts for a request are only known AFTER the LLM finishes
    generating a response — there's no way to know a message's cost before
    running it. So this can't stop the request that pushes a user over
    budget; it blocks the NEXT request once their running total for the
    day already exceeds the limit. That's how token quotas work everywhere
    (OpenAI, Anthropic, Gemini itself included), not a shortcut taken here.
    """

    def __init__(self, daily_limit: int = DAILY_TOKEN_LIMIT):
        self.daily_limit = daily_limit
        self.redis_active = False
        # Same reasoning as RedisSlidingWindowRateLimiter above: this must
        # be initialized unconditionally since record_usage() falls through
        # to it on ANY Redis exception, not only a from-startup outage.
        self._local_usage: dict[str, tuple[str, int]] = {}

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

    def _key(self, identifier: str) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"token_usage:{identifier}:{today}"

    def check_budget(self, identifier: str) -> None:
        """Raise HTTP 429 if this identifier already used up today's budget."""
        if self.redis_active:
            try:
                used_raw = self.client.get(self._key(identifier))
                used = int(used_raw) if used_raw else 0
            except Exception:
                # A broken Redis must degrade this guardrail, not break chat.
                return
        else:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            stored_date, stored_count = self._local_usage.get(identifier, (today, 0))
            used = stored_count if stored_date == today else 0

        if used >= self.daily_limit:
            raise HTTPException(
                status_code=429,
                detail=f"Daily usage limit of {self.daily_limit} tokens reached. Resets at midnight UTC.",
            )

    def record_usage(self, identifier: str, total_tokens: int) -> None:
        """Best-effort — a failure here must never break a response that
        already succeeded and was already shown to the user."""
        if total_tokens <= 0:
            return
        if self.redis_active:
            try:
                key = self._key(identifier)
                pipe = self.client.pipeline()
                pipe.incrby(key, total_tokens)
                pipe.expire(key, 86400)
                pipe.execute()
                return
            except Exception:
                pass

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        stored_date, stored_count = self._local_usage.get(identifier, (today, 0))
        if stored_date != today:
            stored_count = 0
        self._local_usage[identifier] = (today, stored_count + total_tokens)


token_budget = RedisTokenBudget()


def enforce_token_budget(user_id: int | None) -> None:
    """Per-user daily token budget check. Unauthenticated traffic has no
    stable identity to bill usage against safely, so this only applies to
    logged-in users — anonymous abuse is still bounded by the per-IP
    request-count limiter above."""
    if user_id is None:
        return
    token_budget.check_budget(f"user:{user_id}")


def record_token_usage(user_id: int | None, total_tokens: int) -> None:
    if user_id is None:
        return
    token_budget.record_usage(f"user:{user_id}", total_tokens)


def get_client_ip(request: Request) -> str:
    """Extract real client IP address from request headers or socket address.
    
    Checks X-Forwarded-For and X-Real-IP headers for requests coming through reverse proxies.
    """
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(",")[0].strip()
        if client_ip:
            return client_ip

    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip and x_real_ip.strip():
        return x_real_ip.strip()

    return request.client.host if request.client else "127.0.0.1"


def enforce_rate_limit(request: Request, user_id: int | None = None) -> None:
    """Enforce per-user (primary) or per-IP (secondary) sliding-window rate limiting.
    
    Prevents IP rotation evasions and proxy-throttling collisions by tying rate limit 
    buckets directly to authenticated user_id post-JWT authorization.
    """
    if user_id is not None:
        identifier = f"user:{user_id}"
    else:
        client_ip = get_client_ip(request)
        identifier = f"ip:{client_ip}"

    rate_limiter.check_rate_limit(identifier)
