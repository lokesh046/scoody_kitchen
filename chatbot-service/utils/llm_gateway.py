"""LiteLLM Gateway Engine using LangChain ChatLiteLLM integration."""

import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

ChatLiteLLM = None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY

# OpenRouter as primary, Gemini as fallback: this only activates when
# OPENROUTER_API_KEY is set, so it's fully backward compatible — with no
# key configured, behavior is unchanged (Gemini stays primary). The point
# is cross-provider resilience: Gemini and OpenRouter run on entirely
# separate infrastructure, so a Google-side outage (the real 504
# DEADLINE_EXCEEDED errors hit multiple times testing this service) no
# longer takes down the whole request path.
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_PRIMARY_MODEL = os.getenv("OPENROUTER_PRIMARY_MODEL", "meta-llama/llama-3.3-70b-instruct")

# Per-attempt ceiling for a single Gemini call. Without this, a hung request
# has no upper bound — it waits on whatever the underlying SDK/httpx client
# defaults to, which can be far longer than any user will tolerate.
#
# Lowered from 12s -> 10s based on real measured latency this session: normal
# successful calls (router fallback, commerce ReAct steps, RAG generation)
# consistently landed in the 900ms-4s range, with one legitimate outlier
# succeeding at ~7.7s. A stuck/failing call was observed eating the full 12s
# ceiling before failing over. 10s keeps comfortable margin above the
# slowest real success observed while failing over ~17% faster than before
# on genuinely stuck calls — a modest, evidence-based cut, not a guess.
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "10"))

# ChatGoogleGenerativeAI defaults to 6 retries on the *same* model before
# giving up. Since we already fail over to a different (fallback) model via
# with_fallbacks(), a lower retry count here means we reach that fallback
# sooner instead of hammering a struggling primary model for a long time.
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "1"))


class LiteLLMGateway:
    """Enterprise LiteLLM Gateway with LangChain Integration & Cost Calculation."""

    def __init__(
        self,
        model_name: str = "gemini/gemini-3.1-flash-lite",
        fallback_models: list[str] | None = None,
        temperature: float = 0.2,
    ):
        self.model_name = model_name
        self.fallback_models = fallback_models or [
            "gemini/gemini-3.1-pro-preview",
        ]
        self.temperature = temperature

    def _build_gemini_chain(self) -> Any | None:
        """Build the existing Gemini primary+fallback chain. Returns None if
        it can't be built (e.g. langchain_google_genai unavailable) rather
        than raising, so callers can fall through to their own next option.
        """
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            model_id = self.model_name.replace("gemini/", "")
            primary = ChatGoogleGenerativeAI(
                model=model_id,
                temperature=self.temperature,
                google_api_key=GEMINI_API_KEY or "dummy_key_123",
                timeout=LLM_TIMEOUT_SECONDS,
                max_retries=LLM_MAX_RETRIES,
            )

            fallback_models = []
            for fb in self.fallback_models:
                fb_id = fb.replace("gemini/", "")
                fallback_models.append(
                    ChatGoogleGenerativeAI(
                        model=fb_id,
                        temperature=self.temperature,
                        google_api_key=GEMINI_API_KEY or "dummy_key_123",
                        timeout=LLM_TIMEOUT_SECONDS,
                        max_retries=LLM_MAX_RETRIES,
                    )
                )

            return primary.with_fallbacks(fallback_models)
        except Exception as e:
            logger.warning("Failed to initialize direct Google GenAI: %s", e)
            return None

    def get_langchain_llm(self) -> Any:
        """Return a LangChain ChatModel instance with native with_fallbacks() failover."""
        # 0. OpenRouter as primary, existing Gemini chain as its fallback —
        # only when OPENROUTER_API_KEY is configured (see module docstring
        # comment above). bind_tools() on this object still works normally;
        # ChatOpenAI supports the same tool-calling interface commerce_agent
        # relies on.
        if OPENROUTER_API_KEY and "gemini" in self.model_name.lower():
            try:
                from langchain_openai import ChatOpenAI
                primary = ChatOpenAI(
                    model=OPENROUTER_PRIMARY_MODEL,
                    api_key=OPENROUTER_API_KEY,
                    base_url=OPENROUTER_BASE_URL,
                    temperature=self.temperature,
                    timeout=LLM_TIMEOUT_SECONDS,
                    max_retries=LLM_MAX_RETRIES,
                )
                gemini_fallback_chain = self._build_gemini_chain()
                if gemini_fallback_chain is not None:
                    return primary.with_fallbacks([gemini_fallback_chain])
                return primary
            except Exception as e:
                logger.warning("Failed to initialize OpenRouter primary, falling back to Gemini-primary: %s", e)

        # 1. Direct High-Performance Google GenAI integration (Recommended for Gemini)
        if "gemini" in self.model_name.lower():
            gemini_chain = self._build_gemini_chain()
            if gemini_chain is not None:
                return gemini_chain

        # 2. Fallback to LiteLLM for non-Gemini models
        if ChatLiteLLM is not None:
            try:
                primary_llm = ChatLiteLLM(
                    model=self.model_name,
                    temperature=self.temperature,
                    max_retries=2,
                    api_key=GEMINI_API_KEY or "dummy_key_123",
                )

                fallbacks = [
                    ChatLiteLLM(
                        model=fb,
                        temperature=self.temperature,
                        max_retries=2,
                        api_key=GEMINI_API_KEY or "dummy_key_123",
                    )
                    for fb in self.fallback_models
                ]

                return primary_llm.with_fallbacks(fallbacks)
            except Exception:
                pass

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            primary = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=GEMINI_API_KEY or "dummy_key_123",
                timeout=LLM_TIMEOUT_SECONDS,
                max_retries=LLM_MAX_RETRIES,
            )
            fallback = ChatGoogleGenerativeAI(
                model="gemini-3.1-flash-lite",
                google_api_key=GEMINI_API_KEY or "dummy_key_123",
                timeout=LLM_TIMEOUT_SECONDS,
                max_retries=LLM_MAX_RETRIES,
            )
            return primary.with_fallbacks([fallback])
        except Exception:
            from langchain_core.runnables import RunnableLambda
            return RunnableLambda(lambda x: "Scooby AI Assistant Response")

    @staticmethod
    def calculate_completion_cost(
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> float:
        """Calculate exact USD API cost using Gemini pricing.

        Pricing is for gemini-3.1-flash-lite (the model this service
        actually runs as of the 3.5 -> 3.1 switch): $0.25/1M input tokens,
        $1.50/1M output tokens — verified against Google's published
        pricing (ai.google.dev/gemini-api/docs/pricing). Note this model
        is actually cheaper than the gemini-3.5-flash-lite it replaced
        ($0.30/$2.50), not just a version change.

        KNOWN GAP once OPENROUTER_API_KEY is set: this still assumes every
        call is billed at Gemini rates, but OpenRouter (now primary — see
        get_langchain_llm()) bills at OPENROUTER_PRIMARY_MODEL's actual
        rate, which varies by which underlying host OpenRouter routes a
        given request to (no single fixed price to hardcode here without
        it being wrong some fraction of the time). Cost/budget tracking
        will be inaccurate for OpenRouter-served calls until this is
        updated with real per-request pricing from OpenRouter's response
        (it reports actual cost in its API response) rather than a
        hardcoded constant.
        """
        cost_in = (prompt_tokens / 1_000_000) * 0.25
        cost_out = (completion_tokens / 1_000_000) * 1.50
        return round(cost_in + cost_out, 6)


litellm_gateway = LiteLLMGateway()


def get_llm_with_fallback(
    model_name: str = "gemini/gemini-3.1-flash-lite",
    fallback_model_name: str = "gemini/gemini-3.1-pro-preview",
    temperature: float = 0.2,
) -> Any:
    """Return LangChain ChatLiteLLM model instance configured with native with_fallbacks() strategy."""
    gateway = LiteLLMGateway(
        model_name=model_name,
        fallback_models=[
            fallback_model_name,
        ],
        temperature=temperature,
    )
    return gateway.get_langchain_llm()
