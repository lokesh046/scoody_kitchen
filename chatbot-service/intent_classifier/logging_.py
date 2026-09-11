"""Logs every real routing decision so the bootstrap training set in
training_data.py can eventually be replaced/grown with real traffic instead
of hand-written guesses.

Named logging_ (trailing underscore) to avoid shadowing the stdlib logging
module on a plain `import logging` anywhere else in this package.

Fire-and-forget by design: a logging failure must never break routing, so
every call here is wrapped and swallows its own exceptions.
"""

import json
import time

REDIS_LOG_KEY = "intent_routing_log"
# Cap how much history this list holds so it can't grow unbounded on a
# busy deployment — LTRIM keeps only the most recent N entries.
MAX_LOG_ENTRIES = 50_000


def log_routing_decision(query: str, label: str, tier: str, confidence: float | None = None) -> None:
    """Append one (query, chosen_label) observation to Redis for later
    retraining. `tier` is one of "local_classifier", "gemini", or "keyword"
    — knowing which tier decided matters when reviewing this data later,
    since a keyword-fallback label is a much weaker signal than a
    high-confidence Gemini classification.
    """
    try:
        from memory.redis_memory import session_memory
        entry = {
            "query": query,
            "label": label,
            "tier": tier,
            "confidence": confidence,
            "ts": time.time(),
        }
        client = session_memory.client
        client.rpush(REDIS_LOG_KEY, json.dumps(entry))
        client.ltrim(REDIS_LOG_KEY, -MAX_LOG_ENTRIES, -1)
    except Exception:
        # Never let logging break the actual routing decision.
        pass


def load_logged_examples() -> list[dict]:
    """Read back everything logged so far, for a future retraining pass."""
    try:
        from memory.redis_memory import session_memory
        raw_entries = session_memory.client.lrange(REDIS_LOG_KEY, 0, -1)
        return [json.loads(e) for e in raw_entries]
    except Exception:
        return []
