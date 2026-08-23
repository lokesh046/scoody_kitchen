"""LangChain Native PII Redaction & Prompt Safety Guardrails Pipeline."""

import logging
import os
import re
from fastapi import HTTPException
from langchain_core.runnables import RunnableLambda

logger = logging.getLogger(__name__)

# Regex patterns for sensitive PII and API keys / Secrets
CREDIT_CARD_REGEX = re.compile(r"\b(?:\d[ -]*?){13,16}\b")
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
PHONE_REGEX = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
SSN_REGEX = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

# Secret & API Key Leak Detection Patterns
GEMINI_KEY_REGEX = re.compile(r"\bAIzaSy[A-Za-z0-9_-]{33}\b")
OPENAI_KEY_REGEX = re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{32,128}\b")
ANTHROPIC_KEY_REGEX = re.compile(r"\bsk-ant-api\d{2}-[A-Za-z0-9_-]{80,120}\b")
PINECONE_KEY_REGEX = re.compile(r"\bpcsk_[A-Za-z0-9_-]{40,120}\b")
AWS_KEY_REGEX = re.compile(r"\bAKIA[0-9A-Z]{16}\b")
JWT_TOKEN_REGEX = re.compile(r"\bBearer\s+eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", re.IGNORECASE)
RAW_JWT_REGEX = re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")
PRIVATE_KEY_REGEX = re.compile(r"-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----")

# Prompt injection / jailbreak patterns.
#
# NOTE: this is a keyword/regex net, not a real defense against a determined
# attacker — it catches the common, lazy phrasings but a rewrite, a typo,
# non-English phrasing, base64/leetspeak encoding, or splitting the payload
# across turns all sail straight through. Treat this as one cheap layer, not
# the reason state-changing tools are safe (that guarantee lives in the
# tool-execution HITL gate in commerce_agent.py, which is enforced
# regardless of what the model was told to believe). For anything handling
# real money or account actions, pair this with an LLM-based classifier
# pass on suspicious turns, and never let RAG/tool output be interpreted as
# system-level instructions.
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|any\s+|every\s+)?(the\s+)?(above\s+|previous\s+|prior\s+|earlier\s+)*instructions",
    r"disregard\s+(all\s+|any\s+|every\s+)?(the\s+)?(above\s+|previous\s+|prior\s+|earlier\s+)*instructions",
    r"forget\s+(all\s+|any\s+|every\s+)?(the\s+)?(above\s+|previous\s+|prior\s+)*(instructions|rules|context)",
    r"bypass\s+(all\s+)?(the\s+)?(system\s+)?(prompts?|rules|guardrails|filters)",
    r"(reveal|show|print|repeat|output)\s+(me\s+)?(the\s+|your\s+)?(system|hidden|initial)\s+prompt",
    r"you\s+are\s+now\s+(in\s+)?(dan|developer|jailbreak|unrestricted|god)\s*mode",
    r"act\s+as\s+(if\s+you\s+(are|were)\s+)?(an?\s+)?(unfiltered|uncensored|unrestricted|jailbroken)",
    r"pretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(ai|assistant)\s+(with\s+no|without)\s+(restrictions|rules|filters)",
    r"new\s+instructions?\s*:\s*",
    r"system\s*:\s*you\s+(must|will|shall)",
    r"do\s+anything\s+now",
    r"\bdan\b.{0,20}\bjailbreak\b",
    r"override\s+(your|the)\s+(safety|previous|system)\s+(instructions|settings|rules)",
    # Attempts to smuggle a fake "confirmation" or role directive to get a
    # state-changing action executed without a real human reply — relevant
    # here specifically because this bot can cancel orders / book vets.
    r"as\s+the\s+(system|admin|developer)\s*,?\s*(i\s+)?(confirm|approve|authorize)",
    r"treat\s+this\s+as\s+(a\s+)?(confirmed|approved|authorized)\s+(action|request)",
]


import hashlib
from typing import Callable, Literal


class PIIMatch:
    """Class representing a detected PII match substring."""

    def __init__(self, pii_type: str, match_text: str, start: int, end: int):
        self.pii_type = pii_type
        self.match_text = match_text
        self.start = start
        self.end = end


class PIIMiddleware:
    """LangChain-compatible PII Middleware supporting strategies: redact, block, mask, hash.

    Operates across surfaces:
    - apply_to_input: check/sanitize user input messages
    - apply_to_output: check/sanitize AI output content & stream deltas
    - apply_to_tool_results: check/sanitize tool result messages
    """

    BUILTIN_PATTERNS = {
        "email": EMAIL_REGEX,
        "credit_card": CREDIT_CARD_REGEX,
        "phone": PHONE_REGEX,
        "ssn": SSN_REGEX,
        "jwt_token": JWT_TOKEN_REGEX,
        "raw_jwt": RAW_JWT_REGEX,
        "api_key": GEMINI_KEY_REGEX,
        "private_key": PRIVATE_KEY_REGEX,
    }

    def __init__(
        self,
        pii_type: Literal["email", "credit_card", "phone", "ssn", "jwt_token", "api_key", "private_key"] | str,
        *,
        strategy: Literal["redact", "block", "mask", "hash"] = "redact",
        detector: Callable[[str], list[PIIMatch]] | str | None = None,
        apply_to_input: bool = True,
        apply_to_output: bool = True,
        apply_to_tool_results: bool = False,
    ):
        self.pii_type = pii_type
        self.strategy = strategy
        self.apply_to_input = apply_to_input
        self.apply_to_output = apply_to_output
        self.apply_to_tool_results = apply_to_tool_results

        if isinstance(detector, str):
            self.regex = re.compile(detector)
        elif detector is None and pii_type in self.BUILTIN_PATTERNS:
            self.regex = self.BUILTIN_PATTERNS[pii_type]
        else:
            self.regex = None

    def transform(self, text: str) -> str:
        """Apply configured PII strategy (redact, block, mask, hash) to text."""
        if not text or not self.regex:
            return text

        matches = list(self.regex.finditer(text))
        if not matches:
            return text

        if self.strategy == "block":
            raise HTTPException(
                status_code=400,
                detail=f"PII Security Violation: Prompt contains disallowed {self.pii_type} information.",
            )

        new_text = text
        # Process replacements from right to left to maintain offset indices
        for m in reversed(matches):
            raw = m.group(0)
            start, end = m.span()
            if self.strategy == "redact":
                replacement = f"[REDACTED_{self.pii_type.upper()}]"
            elif self.strategy == "mask":
                if len(raw) > 4:
                    replacement = "*" * (len(raw) - 4) + raw[-4:]
                else:
                    replacement = "*" * len(raw)
            elif self.strategy == "hash":
                digest = hashlib.sha256(raw.encode()).hexdigest()[:8]
                replacement = f"<{self.pii_type}_hash:{digest}>"
            else:
                replacement = f"[REDACTED_{self.pii_type.upper()}]"

            new_text = new_text[:start] + replacement + new_text[end:]

        return new_text


def redact_pii_text(text: str) -> str:
    """LangChain Runnable transformation: Redact sensitive customer PII, API Keys, and Secrets from input text."""
    if not text:
        return text

    clean = text
    # 1. Redact PII
    clean = CREDIT_CARD_REGEX.sub("[REDACTED_CREDIT_CARD]", clean)
    clean = EMAIL_REGEX.sub("[REDACTED_EMAIL]", clean)
    clean = PHONE_REGEX.sub("[REDACTED_PHONE]", clean)
    clean = SSN_REGEX.sub("[REDACTED_SSN]", clean)

    # 2. Redact Leaked API Keys, Bearer Tokens & Secrets
    clean = GEMINI_KEY_REGEX.sub("[REDACTED_API_KEY]", clean)
    clean = OPENAI_KEY_REGEX.sub("[REDACTED_API_KEY]", clean)
    clean = ANTHROPIC_KEY_REGEX.sub("[REDACTED_API_KEY]", clean)
    clean = PINECONE_KEY_REGEX.sub("[REDACTED_API_KEY]", clean)
    clean = AWS_KEY_REGEX.sub("[REDACTED_AWS_KEY]", clean)
    clean = JWT_TOKEN_REGEX.sub("[REDACTED_AUTH_TOKEN]", clean)
    clean = RAW_JWT_REGEX.sub("[REDACTED_AUTH_TOKEN]", clean)
    clean = PRIVATE_KEY_REGEX.sub("[REDACTED_PRIVATE_KEY]", clean)

    return clean


def validate_prompt_safety(text: str) -> str:
    """LangChain Safety Filter: Intercept and reject prompt injection attacks.

    Two layers, in order:
    1. Regex net (cheap, instant, catches lazy/common phrasings).
    2. Llama Prompt Guard 2 model classifier (utils/prompt_guard.py) — catches
       rewordings, paraphrases, and non-English attempts the regex can't.
       Runs only if the model is actually loaded (transformers/torch present
       and HF access configured); if not, this layer is a silent no-op and
       the regex layer is still the active defense — the request never
       fails just because the optional model layer isn't set up.

    Neither layer is the reason state-changing tools are safe — that's the
    tool-execution HITL gate in commerce_agent.py, enforced regardless of
    what either of these classifiers concludes.
    """
    if not text:
        return text

    import time
    start_regex = time.perf_counter()
    lower = text.lower()
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, lower):
            raise HTTPException(
                status_code=400,
                detail="Security Violation: Malicious prompt injection or jailbreak attempt detected.",
            )
    regex_duration = (time.perf_counter() - start_regex) * 1000.0

    start_model = time.perf_counter()
    from utils.prompt_guard import check_prompt_injection

    guard_result = check_prompt_injection(text)
    model_duration = (time.perf_counter() - start_model) * 1000.0

    if guard_result.available:
        print(
            f"🛡️ [Safety Timer] Regex took {regex_duration:.2f}ms | AI Model took {model_duration:.2f}ms "
            f"(Is malicious: {guard_result.is_malicious}, Score: {guard_result.score:.3f})",
            flush=True
        )
    else:
        print(
            f"🛡️ [Safety Timer] Regex took {regex_duration:.2f}ms | AI Model was unavailable/disabled (took {model_duration:.2f}ms)",
            flush=True
        )

    if guard_result.available and guard_result.is_malicious:
        logger.warning(
            "Prompt Guard model flagged input as malicious (score=%.3f, threshold=%.2f).",
            guard_result.score, float(os.getenv("PROMPT_GUARD_THRESHOLD", "0.5")),
        )
        raise HTTPException(
            status_code=400,
            detail="Security Violation: Malicious prompt injection or jailbreak attempt detected.",
        )

    return redact_pii_text(text)


# Export native LangChain Runnable objects
pii_redactor_runnable = RunnableLambda(redact_pii_text)
prompt_safety_runnable = RunnableLambda(validate_prompt_safety)
