import math
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def paginate_query(
    db: Session,
    query: Any,
    page: int = 1,
    limit: int = 20,
) -> dict:
    if page < 1:
        page = 1
    if limit < 1:
        limit = 20

    subq = query.subquery()
    count_stmt = select(func.count()).select_from(subq)
    total_items = db.scalar(count_stmt) or 0

    total_pages = math.ceil(total_items / limit) if limit > 0 else 0
    offset = (page - 1) * limit
    items = list(db.scalars(query.offset(offset).limit(limit)).unique().all())

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total_items": total_items,
        "total_pages": total_pages,
        "total": total_items,
        "pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
