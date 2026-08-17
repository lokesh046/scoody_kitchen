"""Stage 4: Pinecone Vector Database Storage & Search Interface."""

import os
from typing import Any
from rag.seed_knowledge import SEED_DOCUMENTS

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "scooby-knowledge")


class PineconeVectorStoreManager:
    """Interface to Pinecone Vector DB with score thresholding & local fallback."""

    def __init__(self, score_threshold: float = 0.65):
        self.score_threshold = score_threshold
        self.pinecone_active = False
        self.in_memory_docs: list[dict[str, Any]] = list(SEED_DOCUMENTS)

        if PINECONE_API_KEY:
            try:
                from pinecone import Pinecone
                pc = Pinecone(api_key=PINECONE_API_KEY)
                self.index = pc.Index(PINECONE_INDEX_NAME)
                self.pinecone_active = True
            except Exception:
                self.pinecone_active = False

    def upsert_vectors(self, vectors_data: list[dict[str, Any]]) -> None:
        """Upsert vectors into Pinecone index."""
        if self.pinecone_active:
            try:
                self.index.upsert(vectors=vectors_data)
            except Exception:
                pass

        for item in vectors_data:
            meta = item.get("metadata", {})
            self.in_memory_docs.append({
                "id": item["id"],
                "doc_id": meta.get("doc_id"),
                "title": meta.get("title"),
                "category": meta.get("category"),
                "content": meta.get("content"),
            })

    def search_vectors_with_threshold(self, query_vector: list[float], clean_query: str, top_k: int = 3) -> list[dict[str, Any]]:
        """Search Pinecone Vector DB enforcing similarity thresholding (Edge Case Fix #12)."""
        if self.pinecone_active:
            try:
                response = self.index.query(
                    vector=query_vector,
                    top_k=top_k,
                    include_metadata=True,
                )
                results = []
                for match in response.get("matches", []):
                    score = match.get("score", 0.0)
                    if score >= self.score_threshold:
                        meta = match.get("metadata", {})
                        results.append({
                            "title": meta.get("title", "Reference Doc"),
                            "content": meta.get("content", ""),
                            "score": score,
                        })
                return results
            except Exception:
                pass

        # Fallback keyword ranking for local/test envs
        query_words = [w for w in clean_query.split() if len(w) > 3]
        if not query_words:
            return []

        scored_results = []
        for doc in self.in_memory_docs:
            content_lower = doc["content"].lower()
            title_lower = doc["title"].lower()
            matched_terms = [w for w in query_words if (w in content_lower or w in title_lower)]
            if matched_terms:
                score = len(matched_terms) / len(query_words)
                if score >= 0.2:
                    scored_results.append((
                        score,
                        {
                            "title": doc["title"],
                            "content": doc["content"],
                            "score": score,
                        }
                    ))

        scored_results.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored_results][:top_k]

    def list_documents(self) -> list[dict[str, Any]]:
        unique_docs: dict[str, dict[str, Any]] = {}
        for doc in self.in_memory_docs:
            doc_id = doc.get("doc_id", doc.get("id"))
            if doc_id not in unique_docs:
                unique_docs[doc_id] = {
                    "doc_id": doc_id,
                    "title": doc.get("title"),
                    "category": doc.get("category", "general"),
                }
        return list(unique_docs.values())

    def delete_document(self, doc_id: str) -> dict[str, Any]:
        if self.pinecone_active:
            try:
                self.index.delete(filter={"doc_id": doc_id})
            except Exception:
                pass
        self.in_memory_docs = [d for d in self.in_memory_docs if d.get("doc_id") != doc_id and d.get("id") != doc_id]
        return {"status": "success", "message": f"Document '{doc_id}' deleted from vector store."}


store_manager = PineconeVectorStoreManager()
