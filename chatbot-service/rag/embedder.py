"""Stage 3: Vector Embedding Generator (Pinecone / Gemini Embeddings)."""

import os

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


class EmbeddingGenerator:
    """Generate dense vector embeddings using Pinecone / Gemini embedding models."""

    def __init__(self):
        self.embeddings_engine = None
        
        if PINECONE_API_KEY:
            try:
                from langchain_pinecone import PineconeEmbeddings
                self.embeddings_engine = PineconeEmbeddings(
                    model="multilingual-e5-large",
                    pinecone_api_key=PINECONE_API_KEY,
                )
            except Exception:
                pass

        if not self.embeddings_engine and GOOGLE_API_KEY:
            try:
                from langchain_google_genai import GoogleGenerativeAIEmbeddings
                self.embeddings_engine = GoogleGenerativeAIEmbeddings(
                    model="models/text-embedding-004",
                    google_api_key=GOOGLE_API_KEY,
                )
            except Exception:
                pass

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text string into a float vector."""
        if self.embeddings_engine:
            try:
                return self.embeddings_engine.embed_query(text)
            except Exception:
                pass
        # Fallback dummy 768-dim vector for testing
        return [0.0] * 768

    def embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        """Embed a list of text chunks."""
        return [self.embed_text(c) for c in chunks]


embedder = EmbeddingGenerator()
