import io
from fastapi import HTTPException, UploadFile


def parse_file_to_text(file: UploadFile, contents: bytes) -> str:
    """Stage 1: Extract raw text from uploaded PDF, DOCX, TXT, or MD files."""
    filename = file.filename or "unknown_file"
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(contents))
            text_pages = [page.extract_text() for page in reader.pages if page.extract_text()]
            extracted = "\n".join(text_pages).strip()
            if not extracted:
                raise ValueError("PDF contains no readable text.")
            return extracted
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF file '{filename}': {str(exc)}")

    elif ext == "docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(contents))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            extracted = "\n".join(paragraphs).strip()
            if not extracted:
                raise ValueError("DOCX document is empty.")
            return extracted
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to parse DOCX file '{filename}': {str(exc)}")

    elif ext in ["txt", "md"]:
        try:
            return contents.decode("utf-8", errors="ignore").strip()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to parse text file '{filename}': {str(exc)}")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Supported formats: .pdf, .docx, .txt, .md",
        )
