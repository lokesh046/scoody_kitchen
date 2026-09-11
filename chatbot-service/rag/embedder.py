"""Stage 3: Vector Embedding Generator.

Uses a local sentence-transformers model (all-MiniLM-L6-v2, 384-dim)
instead of a remote embedding API call. Measured directly: ~9ms per
embedding once the model is warm, versus ~500-700ms for the remote
Pinecone/Gemini embedding call this replaced — the model itself is loaded
once per process (a ~18s one-time cost, same pattern as the intent
classifier and prompt-guard models elsewhere in this service), not per
request.

This embeds into Pinecone index "scooby-knowledge-local" (384-dim), a
separate index from the original "scooby-knowledge" (1024-dim,
multilingual-e5-large) — vectors from two different models are not
comparable, so this could not be a swap within the same index. The
original index is untouched and still exists.
"""

import threading
import time

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384


class EmbeddingGenerator:
    """Generate dense vector embeddings using a local sentence-transformers model."""

    def __init__(self):
        self._model = None
        self._load_attempted = False
        self._lock = threading.Lock()

    def _ensure_loaded(self) -> bool:
        if self._model is not None:
            return True
        if self._load_attempted:
            return False
        with self._lock:
            if self._model is not None:
                return True
            if self._load_attempted:
                return False
            self._load_attempted = True
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(MODEL_NAME)
                return True
            except Exception as e:
                print(f"❌ [RAG Timer] Local embedding model failed to load: {e}", flush=True)
                return False

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text string into a float vector."""
        if self._ensure_loaded():
            try:
                start = time.perf_counter()
                vec = self._model.encode(text, convert_to_numpy=True)
                duration = (time.perf_counter() - start) * 1000.0
                print(f"📊 [RAG Timer] Local embedding (all-MiniLM-L6-v2) took {duration:.2f}ms", flush=True)
                return vec.tolist()
            except Exception as e:
                print(f"❌ [RAG Timer] Local embedding failed: {e}", flush=True)
        # Fallback dummy vector matching this embedder's real dimension —
        # keeps callers working (with zero similarity to anything real)
        # rather than crashing if the model genuinely can't load.
        return [0.0] * EMBEDDING_DIMENSION

    def embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        """Embed a list of text chunks."""
        return [self.embed_text(c) for c in chunks]


embedder = EmbeddingGenerator()
