from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from auth.dependencies import require_admin_role
from rag.pipeline import rag_pipeline
from rag.store import store_manager

# All routes inside this router require Admin Authentication & Role Authorization
router = APIRouter(
    prefix="/rag",
    tags=["RAG Admin"],
    dependencies=[Depends(require_admin_role)],
)


@router.post("/upload")
async def upload_knowledge_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    category: str = Form(default="general"),
) -> dict:
    """[ADMIN ONLY] Execute end-to-end RAG Ingestion Pipeline: Upload -> Parse -> Chunk -> Embed -> Store in Pinecone."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected for upload.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

    return rag_pipeline.ingest_uploaded_file(
        file=file,
        contents=contents,
        title=title,
        category=category,
    )


@router.get("/documents")
def list_knowledge_documents() -> list[dict]:
    """[ADMIN ONLY] List all indexed knowledge documents in vector store."""
    return store_manager.list_documents()


@router.delete("/documents/{doc_id}")
def delete_knowledge_document(doc_id: str) -> dict:
    """[ADMIN ONLY] Purge document vectors from Pinecone index."""
    return store_manager.delete_document(doc_id)
