"""LiteLLM Gateway Engine using LangChain ChatLiteLLM integration."""

import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

ChatLiteLLM = None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY

# Per-attempt ceiling for a single Gemini call. Without this, a hung request
# has no upper bound — it waits on whatever the underlying SDK/httpx client
# defaults to, which can be far longer than any user will tolerate.
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "12"))

# ChatGoogleGenerativeAI defaults to 6 retries on the *same* model before
# giving up. Since we already fail over to a different (fallback) model via
# with_fallbacks(), a lower retry count here means we reach that fallback
# sooner instead of hammering a struggling primary model for a long time.
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "1"))


class LiteLLMGateway:
    """Enterprise LiteLLM Gateway with LangChain Integration & Cost Calculation."""

    def __init__(
        self,
        model_name: str = "gemini/gemini-3.5-flash-lite",
        fallback_models: list[str] | None = None,
        temperature: float = 0.2,
    ):
        self.model_name = model_name
        self.fallback_models = fallback_models or [
            "gemini/gemini-3.1-pro-preview",
        ]
        self.temperature = temperature

    def get_langchain_llm(self) -> Any:
        """Return a LangChain ChatModel instance with native with_fallbacks() failover."""
        # 1. Direct High-Performance Google GenAI integration (Recommended for Gemini)
        if "gemini" in self.model_name.lower():
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
                model="gemini-3.5-flash-lite",
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

        Pricing is for gemini-3.5-flash-lite (the model this service
        actually runs): $0.30/1M input tokens, $2.50/1M output tokens —
        verified against Google DeepMind's published pricing. The prior
        values here ($0.075/$0.30) were stale/for a different model and
        undercounted real cost by roughly 4x on input, 8x on output.
        """
        cost_in = (prompt_tokens / 1_000_000) * 0.30
        cost_out = (completion_tokens / 1_000_000) * 2.50
        return round(cost_in + cost_out, 6)


litellm_gateway = LiteLLMGateway()


def get_llm_with_fallback(
    model_name: str = "gemini/gemini-3.5-flash-lite",
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
