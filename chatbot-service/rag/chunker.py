"""Stage 2: LangChain Recursive Character Text Chunker."""


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 60) -> list[str]:
    """Split raw document text into chunks using LangChain's RecursiveCharacterTextSplitter."""
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        chunks = splitter.split_text(text)
        if chunks:
            return chunks
    except Exception:
        pass

    # Simple fallback chunker
    step = chunk_size - overlap
    return [text[i : i + chunk_size] for i in range(0, len(text), step)] or [text]
