"""LangChain Native PII Redaction & Prompt Safety Guardrails Pipeline."""

import re
from fastapi import HTTPException
from langchain_core.runnables import RunnableLambda

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

# Prompt injection / jailbreak patterns
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|previous\s+|prior\s+)*instructions",
    r"bypass\s+(all\s+)*system\s+prompts",
    r"reveal\s+(the\s+)*system\s+prompt",
    r"you\s+are\n+now\s+in\s+dan\s+mode",
]


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

    # 2. Redact Leaked API Keys & Secrets
    clean = GEMINI_KEY_REGEX.sub("[REDACTED_API_KEY]", clean)
    clean = OPENAI_KEY_REGEX.sub("[REDACTED_API_KEY]", clean)
    clean = ANTHROPIC_KEY_REGEX.sub("[REDACTED_API_KEY]", clean)
    clean = PINECONE_KEY_REGEX.sub("[REDACTED_API_KEY]", clean)
    clean = AWS_KEY_REGEX.sub("[REDACTED_AWS_KEY]", clean)

    return clean


def validate_prompt_safety(text: str) -> str:
    """LangChain Safety Filter: Intercept and reject prompt injection attacks."""
    if not text:
        return text

    lower = text.lower()
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, lower):
            raise HTTPException(
                status_code=400,
                detail="Security Violation: Malicious prompt injection or jailbreak attempt detected.",
            )

    return redact_pii_text(text)


# Export native LangChain Runnable objects
pii_redactor_runnable = RunnableLambda(redact_pii_text)
prompt_safety_runnable = RunnableLambda(validate_prompt_safety)
