from rag.pipeline import rag_pipeline
from rag.store import store_manager


class KnowledgeVectorStore:
    """Delegates to modular RAG pipeline & store manager."""

    def search_knowledge(self, query: str, top_k: int = 3):
        return rag_pipeline.search_knowledge(query, top_k=top_k)

    def list_documents(self):
        return store_manager.list_documents()

    def delete_document(self, doc_id: str):
        return store_manager.delete_document(doc_id)


vector_store = KnowledgeVectorStore()
