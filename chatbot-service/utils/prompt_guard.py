"""Model-based prompt injection / jailbreak detection using Llama Prompt Guard 2.

Why a model and not just regex: Prompt Guard 2 is a small classifier (22M or
86M params, DeBERTa-xsmall based) trained specifically to recognize attempts
to override a system prompt or hijack an LLM's instructions — including
rewordings, non-English phrasing, and structuring that a fixed regex list in
guardrails.py will never catch. Meta's published benchmark: ~99.8% AUC,
97.5% jailbreak detection @ 1% false-positive rate, ~19ms/prompt (22M, GPU)
or ~92ms/prompt (86M, GPU) — negligible next to a Gemini round-trip.

This is still not a silver bullet (no classifier is), so it's used here as
an additional layer alongside the regex net in guardrails.py, never as a
replacement for the tool-execution HITL gate in commerce_agent.py — that
gate is what actually keeps a hijacked/injected conversation from being
able to cancel an order or book an appointment, regardless of what this
classifier says.

The model itself now runs on the shared ml-inference-service (see
ml-inference-service/main.py) instead of loading transformers/torch and the
gated model weights in this process — this used to be loaded once per
chatbot-service gunicorn worker, multiplying memory with every worker added.
This module calls that service over HTTP and degrades to "unavailable"
exactly as before if it can't be reached or hasn't loaded the model (e.g.
no HF_TOKEN access on that service), so guardrails.py's regex-only fallback
path is unchanged.
"""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

ML_INFERENCE_URL = os.getenv("ML_INFERENCE_URL", "http://localhost:8010")
PROMPT_GUARD_ENABLED = os.getenv("PROMPT_GUARD_ENABLED", "true").lower() == "true"
_TIMEOUT_SECONDS = 5.0

_client = httpx.Client(base_url=ML_INFERENCE_URL, timeout=_TIMEOUT_SECONDS)


class PromptGuardResult:
    def __init__(self, is_malicious: bool, score: float, available: bool):
        self.is_malicious = is_malicious
        self.score = score
        self.available = available  # False if the model couldn't be loaded/run


def check_prompt_injection(text: str) -> PromptGuardResult:
    """Classify text as a prompt injection / jailbreak attempt or not.

    Returns PromptGuardResult(available=False) if the model isn't loaded on
    the ml-inference service, or that service can't be reached — callers
    should treat that as "no verdict from this layer", not as "safe", and
    continue to rely on the regex layer in guardrails.py in that case.
    """
    if not PROMPT_GUARD_ENABLED or not text or not text.strip():
        return PromptGuardResult(is_malicious=False, score=0.0, available=False)

    try:
        resp = _client.post("/prompt-guard", json={"text": text})
        resp.raise_for_status()
        data = resp.json()
        return PromptGuardResult(
            is_malicious=data["is_malicious"],
            score=data["score"],
            available=data["available"],
        )
    except Exception as exc:
        logger.warning("ml-inference /prompt-guard call failed: %s", exc)
        return PromptGuardResult(is_malicious=False, score=0.0, available=False)


def is_prompt_guard_available() -> bool:
    """Whether the model layer is actually active on the ml-inference service."""
    try:
        resp = _client.get("/health")
        resp.raise_for_status()
        return bool(resp.json().get("prompt_guard_loaded"))
    except Exception:
        return False
