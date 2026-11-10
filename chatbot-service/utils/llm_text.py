def content_to_text(content) -> str:
    """Plain text from an LLM reply, which may be a string or a list of content blocks."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, (list, tuple)):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(str(block.get("text") or block.get("content") or ""))
            elif hasattr(block, "text"):
                parts.append(str(getattr(block, "text", "") or ""))
        return "".join(parts).strip()
    return str(content).strip()
