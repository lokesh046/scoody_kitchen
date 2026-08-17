"""Stage 5: Full Modular RAG Ingestion Pipeline Manager."""

import uuid
from typing import Any
from fastapi import UploadFile

from rag.parser import parse_file_to_text
from rag.chunker import chunk_text
from rag.embedder import embedder
from rag.store import store_manager


class RAGIngestionPipeline:
    """Orchestrates: File -> Parser -> Chunker -> Embedder -> Vector DB Store."""

    def ingest_uploaded_file(
        self,
        file: UploadFile,
        contents: bytes,
        title: str | None = None,
        category: str = "general",
    ) -> dict[str, Any]:
        """Execute end-to-end RAG ingestion pipeline on uploaded file."""
        doc_id = f"doc_{uuid.uuid4().hex[:10]}"
        doc_title = title if title and title.strip() else (file.filename or "uploaded_doc")

        # 1. Parse File Text
        raw_text = parse_file_to_text(file, contents)

        # 2. Chunk Text using LangChain
        chunks = chunk_text(raw_text, chunk_size=600, overlap=60)

        # 3. Embed Chunks using Pinecone/Gemini Embedder
        vectors = embedder.embed_chunks(chunks)

        # 4. Prepare Vector Records
        records = []
        for idx, (chunk_text_str, vector_val) in enumerate(zip(chunks, vectors)):
            chunk_id = f"{doc_id}_c{idx}"
            records.append({
                "id": chunk_id,
                "values": vector_val,
                "metadata": {
                    "doc_id": doc_id,
                    "title": doc_title,
                    "category": category,
                    "content": chunk_text_str,
                    "chunk_index": idx,
                },
            })

        # 5. Upsert to Pinecone Vector DB Store
        store_manager.upsert_vectors(records)

        return {
            "status": "success",
            "doc_id": doc_id,
            "title": doc_title,
            "category": category,
            "chunks_indexed": len(chunks),
            "message": f"Successfully parsed, chunked, embedded, and stored '{doc_title}' in Pinecone Vector DB.",
        }

    def search_knowledge(self, query: str, top_k: int = 3) -> list[dict[str, Any]]:
        """Search pipeline: Query -> Embedder -> Vector DB Store with Thresholding."""
        query_vector = embedder.embed_text(query)
        return store_manager.search_vectors_with_threshold(query_vector, query.lower().strip(), top_k=top_k)


rag_pipeline = RAGIngestionPipeline()
