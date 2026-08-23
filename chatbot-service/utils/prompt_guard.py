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

Requirements to actually use this:
- `transformers` and `torch` installed (see requirements.txt / pyproject.toml).
- A Hugging Face token with access to the gated Meta Llama 4 Community
  License repo, set as HF_TOKEN (or HUGGING_FACE_HUB_TOKEN) in the
  environment. Request access once at:
  https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M
- On first use the model weights (~350MB for 86M, smaller for 22M) are
  downloaded and cached locally by `transformers` — this is a one-time
  cold-start cost per machine/image, not per request.

If any of the above isn't available (no torch, no HF access, offline,
etc.) this module degrades to "unavailable" rather than raising, and
guardrails.py falls back to regex-only detection — the service must never
fail to start or fail a request just because this optional layer couldn't
load.
"""

import logging
import os
import threading
from typing import Optional

logger = logging.getLogger(__name__)

# 22M is the default: ~75% lower latency/compute than the 86M model for a
# small accuracy trade-off, which is the right call for a per-message input
# filter that runs on every chat turn. Set PROMPT_GUARD_MODEL=meta-llama/Llama-Prompt-Guard-2-86M
# to use the larger model if you want the extra accuracy and can afford the latency.
PROMPT_GUARD_MODEL = os.getenv("PROMPT_GUARD_MODEL", "meta-llama/Llama-Prompt-Guard-2-22M")
PROMPT_GUARD_ENABLED = os.getenv("PROMPT_GUARD_ENABLED", "true").lower() == "true"
# Prompt Guard 2 outputs a "malicious" probability in [0, 1]; this is the
# bar above which we treat a message as an injection attempt. Lower this to
# be stricter (more false positives), raise it to be more permissive.
PROMPT_GUARD_THRESHOLD = float(os.getenv("PROMPT_GUARD_THRESHOLD", "0.5"))
# Model's own max context; longer inputs are truncated to this before
# classification (matches Meta's guidance to chunk very long inputs rather
# than silently truncate them, but a simple truncation is used here for
# now — chat messages are short in this app).
PROMPT_GUARD_MAX_TOKENS = 512

# Execute on 'cpu' by default to avoid issues on older, incompatible GPUs (e.g. GeForce MX130).
# Set PROMPT_GUARD_DEVICE=cuda in production/staging to utilize GPU acceleration.
PROMPT_GUARD_DEVICE = os.getenv("PROMPT_GUARD_DEVICE", "cpu")



class PromptGuardResult:
    def __init__(self, is_malicious: bool, score: float, available: bool):
        self.is_malicious = is_malicious
        self.score = score
        self.available = available  # False if the model couldn't be loaded/run


class _PromptGuardClassifier:
    """Lazily loads the Prompt Guard 2 model on first use, once per process."""

    def __init__(self):
        self._pipeline = None
        self._load_attempted = False
        self._load_failed_reason: Optional[str] = None
        self._lock = threading.Lock()

    def _ensure_loaded(self) -> bool:
        if self._pipeline is not None:
            return True
        if self._load_attempted:
            # Already tried and failed this process lifetime; don't retry
            # on every single chat message — that would turn every request
            # into a slow, doomed import/download attempt.
            return False

        with self._lock:
            if self._pipeline is not None:
                return True
            if self._load_attempted:
                return False
            self._load_attempted = True

            try:
                from transformers import pipeline  # noqa: local import, optional dependency

                self._pipeline = pipeline(
                    "text-classification",
                    model=PROMPT_GUARD_MODEL,
                    truncation=True,
                    max_length=PROMPT_GUARD_MAX_TOKENS,
                    device=PROMPT_GUARD_DEVICE,
                )
                logger.info("Loaded Prompt Guard model: %s", PROMPT_GUARD_MODEL)
                return True
            except Exception as exc:
                self._load_failed_reason = str(exc)
                logger.warning(
                    "Prompt Guard model unavailable (%s); falling back to regex-only "
                    "injection detection. To enable it, install `transformers`+`torch` "
                    "and set an HF_TOKEN with access to %s.",
                    exc, PROMPT_GUARD_MODEL,
                )
                return False

    def classify(self, text: str) -> PromptGuardResult:
        if not PROMPT_GUARD_ENABLED or not text or not text.strip():
            return PromptGuardResult(is_malicious=False, score=0.0, available=False)

        if not self._ensure_loaded() or self._pipeline is None:
            return PromptGuardResult(is_malicious=False, score=0.0, available=False)

        try:
            # Prompt Guard 2 is a binary classifier: labels are typically
            # "LABEL_0"/"LABEL_1" or "benign"/"malicious" depending on the
            # model card revision, so match on whichever indicates malicious
            # rather than assuming one exact string.
            result = self._pipeline(text[: PROMPT_GUARD_MAX_TOKENS * 4])[0]
            label = str(result.get("label", "")).lower()
            score = float(result.get("score", 0.0))
            is_malicious_label = "malicious" in label or "injection" in label or label.endswith("_1") or label == "1" or "label_1" in label
            malicious_score = score if is_malicious_label else (1.0 - score)
            return PromptGuardResult(
                is_malicious=malicious_score >= PROMPT_GUARD_THRESHOLD,
                score=malicious_score,
                available=True,
            )
        except Exception as exc:
            logger.error("Prompt Guard classification failed at runtime: %s", exc)
            return PromptGuardResult(is_malicious=False, score=0.0, available=False)


_classifier = _PromptGuardClassifier()


def check_prompt_injection(text: str) -> PromptGuardResult:
    """Classify text as a prompt injection / jailbreak attempt or not.

    Returns PromptGuardResult(available=False) if the model isn't loaded —
    callers should treat that as "no verdict from this layer", not as "safe",
    and continue to rely on the regex layer in guardrails.py in that case.
    """
    return _classifier.classify(text)


def is_prompt_guard_available() -> bool:
    """Whether the model layer is actually active (vs. silently unavailable)."""
    return _classifier._ensure_loaded()
