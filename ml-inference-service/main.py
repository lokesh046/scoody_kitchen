"""Shared ML inference service for chatbot-service.

Hosts the two torch/transformers-backed models chatbot-service used to load
once per gunicorn worker: the local sentence-transformers embedding model
(see chatbot-service/rag/embedder.py) and the Llama Prompt Guard injection
classifier (see chatbot-service/utils/prompt_guard.py). Both now call this
service over HTTP instead of importing torch themselves.

Why this exists: chatbot-service runs WEB_CONCURRENCY gunicorn workers, each
its own OS process. Loading a ~90MB embedding model and a ~350MB (86M) or
smaller (22M) Prompt Guard model directly in chatbot-service meant every
worker held its own full copy — 4 workers meant 4x the model memory for
zero extra throughput, since request-handling capacity and model-copy count
were tied together for no good reason. Loading each model exactly once
here lets chatbot-service's CHATBOT_WORKERS scale independently of model
memory.

Runs as a single process deliberately: model inference here is CPU-bound
per request, so more Python worker processes wouldn't add throughput the
way they do for chatbot-service's I/O-bound (mostly-waiting-on-Gemini)
request handling — they'd just be more copies of the same models. If this
process becomes the bottleneck under real load, the fix is a request queue
or batching layer in front of it, not more processes each holding another
full model copy.
"""

import logging
import os
import threading
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384

PROMPT_GUARD_MODEL = os.getenv("PROMPT_GUARD_MODEL", "meta-llama/Llama-Prompt-Guard-2-22M")
PROMPT_GUARD_ENABLED = os.getenv("PROMPT_GUARD_ENABLED", "true").lower() == "true"
PROMPT_GUARD_DEVICE = os.getenv("PROMPT_GUARD_DEVICE", "cpu")
PROMPT_GUARD_MAX_TOKENS = 512

_embed_lock = threading.Lock()
_embed_model = None

_guard_lock = threading.Lock()
_guard_pipeline = None
_guard_load_attempted = False
_guard_load_failed_reason: Optional[str] = None


def _load_embed_model():
    global _embed_model
    if _embed_model is not None:
        return _embed_model
    with _embed_lock:
        if _embed_model is None:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading embedding model %s...", EMBEDDING_MODEL_NAME)
            _embed_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
            logger.info("Embedding model ready.")
    return _embed_model


def _load_guard_pipeline():
    """Lazy, one-time load — kept lazy (unlike the embedding model) because
    this model is gated behind Meta's license and an HF_TOKEN with approved
    access; a deployment without that access should still start up and
    serve embeddings normally, just report Prompt Guard as unavailable."""
    global _guard_pipeline, _guard_load_attempted, _guard_load_failed_reason
    if _guard_pipeline is not None:
        return _guard_pipeline
    if _guard_load_attempted:
        return None
    with _guard_lock:
        if _guard_pipeline is not None:
            return _guard_pipeline
        if _guard_load_attempted:
            return None
        _guard_load_attempted = True
        try:
            from transformers import pipeline
            token = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")
            logger.info("Loading Prompt Guard model %s...", PROMPT_GUARD_MODEL)
            _guard_pipeline = pipeline(
                "text-classification",
                model=PROMPT_GUARD_MODEL,
                truncation=True,
                max_length=PROMPT_GUARD_MAX_TOKENS,
                device=PROMPT_GUARD_DEVICE,
                token=token,
            )
            logger.info("Prompt Guard model ready.")
        except Exception as exc:
            _guard_load_failed_reason = str(exc)
            logger.warning(
                "Prompt Guard model unavailable (%s); callers should fall back to "
                "regex-only injection detection.", exc,
            )
    return _guard_pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eager, blocking load at startup — not lazy-on-first-request — so a
    # readiness/health check can gate real traffic on "model actually
    # loaded" rather than the first real user request paying the ~18s cold
    # start. Prompt Guard stays lazy (see _load_guard_pipeline's docstring).
    _load_embed_model()
    if PROMPT_GUARD_ENABLED:
        _load_guard_pipeline()
    yield


app = FastAPI(title="Scooby ML Inference Service", lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    if not req.texts:
        return EmbedResponse(embeddings=[])
    model = _load_embed_model()
    vectors = model.encode(req.texts, convert_to_numpy=True)
    return EmbedResponse(embeddings=[v.tolist() for v in vectors])


class PromptGuardRequest(BaseModel):
    text: str


class PromptGuardResponse(BaseModel):
    is_malicious: bool
    score: float
    available: bool


@app.post("/prompt-guard", response_model=PromptGuardResponse)
def prompt_guard(req: PromptGuardRequest) -> PromptGuardResponse:
    if not PROMPT_GUARD_ENABLED or not req.text or not req.text.strip():
        return PromptGuardResponse(is_malicious=False, score=0.0, available=False)

    pipe = _load_guard_pipeline()
    if pipe is None:
        return PromptGuardResponse(is_malicious=False, score=0.0, available=False)

    try:
        result = pipe(req.text[: PROMPT_GUARD_MAX_TOKENS * 4])[0]
        label = str(result.get("label", "")).lower()
        score = float(result.get("score", 0.0))
        # Prompt Guard 2's label naming varies by model-card revision
        # ("LABEL_0"/"LABEL_1" or "benign"/"malicious"), so match on
        # whichever indicates malicious rather than assuming one exact string.
        is_malicious_label = (
            "malicious" in label or "injection" in label
            or label.endswith("_1") or label == "1" or "label_1" in label
        )
        malicious_score = score if is_malicious_label else (1.0 - score)
        threshold = float(os.getenv("PROMPT_GUARD_THRESHOLD", "0.5"))
        return PromptGuardResponse(
            is_malicious=malicious_score >= threshold,
            score=malicious_score,
            available=True,
        )
    except Exception as exc:
        logger.error("Prompt Guard classification failed: %s", exc)
        return PromptGuardResponse(is_malicious=False, score=0.0, available=False)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "embedding_model_loaded": _embed_model is not None,
        "prompt_guard_enabled": PROMPT_GUARD_ENABLED,
        "prompt_guard_loaded": _guard_pipeline is not None,
        "prompt_guard_load_failed_reason": _guard_load_failed_reason,
    }


if __name__ == "__main__":
    import uvicorn

    # Single worker, deliberately — see module docstring.
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8010")), workers=1)
