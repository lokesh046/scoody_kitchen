import logging
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.core.college_database import get_college_db
from app.models.college import College
from app.core.limiter import limiter
from app.core.cache import cache
from app.schemas.college import CollegeSearchResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/colleges", tags=["Colleges"])

@router.get("/search", response_model=list[CollegeSearchResponse])
@limiter.limit("60/minute")
def search_colleges(
    request: Request,
    q: str = Query(..., min_length=2, max_length=100),
    state: str | None = Query(None, min_length=2, max_length=100),
    db: Session = Depends(get_college_db)
):
    """
    Search colleges by name with case-insensitive trigram similarity.
    Minimum search text length is 2 characters. Returns top 10 matches.
    Fuzzy results are cached in Redis/Memory for 1 hour to reduce database load.
    """
    # 1. Normalize query and state parameters
    query_clean = q.strip().lower()
    if not query_clean:
        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty or consist only of whitespace."
        )
        
    state_clean = state.strip().lower() if state else ""
    
    # 2. Check cache first with version prefix 'v1'
    cache_key = f"colleges:search:v1:{query_clean}:{state_clean}"
    try:
        cached_results = cache.get(cache_key)
        if cached_results is not None:
            return cached_results
    except Exception as exc:
        logger.warning("Cache retrieval failed for key '%s': %s", cache_key, exc)
    
    # 3. Compute similarity score
    similarity_score = func.similarity(College.name, q)
    
    # 4. Build query statement
    stmt = (
        select(College)
        .where(
            (College.is_active == True) &
            ((College.name.ilike(f"%{q}%")) | (similarity_score > 0.2))
        )
    )
    
    if state:
        stmt = stmt.where(College.state.ilike(f"%{state.strip()}%"))
        
    stmt = stmt.order_by(similarity_score.desc()).limit(10)
    
    # 5. Query the database
    try:
        colleges = db.scalars(stmt).all()
    except Exception as exc:
        logger.exception("Database query failed for college search query: '%s', state: '%s'", q, state)
        raise HTTPException(
            status_code=503,
            detail="Database service temporarily unavailable. Please try again later."
        )
        
    # 6. Format result payload matching CollegeSearchResponse Pydantic schema
    results = [
        {
            "id": c.id,
            "name": c.name,
            "city": c.city,
            "district": c.district,
            "state": c.state,
            "is_active": c.is_active,
            "last_updated": c.last_updated
        }
        for c in colleges
    ]
    
    # 7. Write to cache with 1 hour TTL
    try:
        cache.set(cache_key, results, ttl_seconds=3600)
    except Exception as exc:
        logger.warning("Cache write failed for key '%s': %s", cache_key, exc)
        
    return results
