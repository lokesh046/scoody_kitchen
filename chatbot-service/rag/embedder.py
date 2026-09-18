"""Stage 3: Vector Embedding Generator.

Calls the shared ml-inference-service's /embed endpoint instead of loading
a local sentence-transformers model (all-MiniLM-L6-v2, 384-dim) in this
process directly. That model used to be loaded once per chatbot-service
gunicorn worker — CHATBOT_WORKERS=4 meant 4 full copies of the model in
memory for zero extra embedding throughput, since it's the same CPU-bound
work either way. Extracting it into ml-inference-service (see
ml-inference-service/main.py) means raising CHATBOT_WORKERS no longer also
multiplies this model's memory footprint.

This embeds into Pinecone index "scooby-knowledge-local" (384-dim), a
separate index from the original "scooby-knowledge" (1024-dim,
multilingual-e5-large) — vectors from two different models are not
comparable, so this could not be a swap within the same index. The
original index is untouched and still exists.
"""

import os
import time

import httpx

ML_INFERENCE_URL = os.getenv("ML_INFERENCE_URL", "http://localhost:8010")
EMBEDDING_DIMENSION = 384
_TIMEOUT_SECONDS = 10.0


class EmbeddingGenerator:
    """Generate dense vector embeddings via the shared ml-inference service."""

    def __init__(self):
        self._client = httpx.Client(base_url=ML_INFERENCE_URL, timeout=_TIMEOUT_SECONDS)

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text string into a float vector."""
        results = self.embed_chunks([text])
        return results[0] if results else [0.0] * EMBEDDING_DIMENSION

    def embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        """Embed a list of text chunks in a single batched call — previously
        this ran embed_text in a loop, i.e. one HTTP round-trip per chunk;
        batching them into one request is a direct win now that embedding
        is a network call rather than an in-process function call."""
        if not chunks:
            return []
        try:
            start = time.perf_counter()
            resp = self._client.post("/embed", json={"texts": chunks})
            resp.raise_for_status()
            duration = (time.perf_counter() - start) * 1000.0
            print(
                f"📊 [RAG Timer] ml-inference embed ({len(chunks)} chunk(s)) took {duration:.2f}ms",
                flush=True,
            )
            return resp.json()["embeddings"]
        except Exception as e:
            print(f"❌ [RAG Timer] ml-inference embed call failed: {e}", flush=True)
            # Fallback dummy vectors matching this embedder's real dimension —
            # keeps callers working (with zero similarity to anything real)
            # rather than crashing if the service genuinely can't be reached.
            return [[0.0] * EMBEDDING_DIMENSION for _ in chunks]


embedder = EmbeddingGenerator()
