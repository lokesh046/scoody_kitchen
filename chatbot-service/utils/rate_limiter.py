"""LangChain Callback Token Cost Tracker & Redis Sliding-Window Rate Limiter Engine."""

import os
import time
from typing import Any
from fastapi import HTTPException, Request
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from utils.llm_gateway import LiteLLMGateway

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


class LangChainTokenCostCallbackHandler(BaseCallbackHandler):
    """Custom LangChain CallbackHandler to track token usage and LiteLLM cost metrics per request."""

    def __init__(self, session_id: str = "default", model_name: str = "gemini/gemini-2.5-flash"):
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

        if not token_usage and response.generations:
            for gen_list in response.generations:
                for gen in gen_list:
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

        try:
            import redis
            self.client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
            self.client.ping()
            self.redis_active = True
        except Exception:
            self.redis_active = False
            self._local_counts: dict[str, list[float]] = {}

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
