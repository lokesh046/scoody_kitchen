MAX_SEARCH_LENGTH = 100


def clean_search(value: str | None, max_length: int = MAX_SEARCH_LENGTH) -> str:
    """Trim and cap a user-typed search string."""
    return (value or "").strip()[:max_length]


def like_pattern(value: str | None, max_length: int = MAX_SEARCH_LENGTH) -> str:
    """Build a contains-pattern for ilike(..., escape="\\").

    `%` and `_` typed by the user are matched literally instead of acting as
    wildcards, so a search for "%" can't be used to force a full-table scan.
    """
    text = clean_search(value, max_length)
    text = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{text}%"
