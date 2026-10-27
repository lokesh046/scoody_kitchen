from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.feature_flag import FeatureFlagResponse, FeatureFlagUpdate, PublicFeatureFlagState
from app.services.feature_flag_service import (
    get_all_flags_admin,
    get_public_flags,
    update_feature_flag,
)

router = APIRouter(tags=["Feature Flags"])

from app.services.feature_flag_service import PUBLIC_FLAGS_CACHE_KEY as CACHE_KEY_PUBLIC


@router.get("/features/public", response_model=Dict[str, PublicFeatureFlagState])
def get_public_feature_flags(db: Session = Depends(get_db)):
    """Public endpoint: Returns each feature's enabled state and disabled-state
    fallback (hide / coming_soon / unavailable) for client rendering.

    Cached because the header calls this on every page for every visitor, and
    an uncached read costs two queries (the seed check plus the select). It was
    a third of all API traffic, which kept Neon's compute from ever suspending.

    The TTL is deliberately long: flags only change when an admin toggles one,
    and that path deletes this key, so a change is still immediate. A short TTL
    would reintroduce a periodic query purely to re-learn an unchanged answer.
    """
    cached = cache.get(CACHE_KEY_PUBLIC)
    if cached is not None:
        return cached

    flags = get_public_flags(db)
    cache.set(CACHE_KEY_PUBLIC, flags, ttl_seconds=3600)
    return flags

@router.get("/admin/features", response_model=List[FeatureFlagResponse])
def get_admin_feature_flags(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Admin-only: Retrieve all registered feature flags with descriptions and category metadata."""
    return get_all_flags_admin(db)

@router.patch("/admin/features/{key}", response_model=FeatureFlagResponse)
def toggle_feature_flag(
    key: str,
    payload: FeatureFlagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Admin-only: Enable or disable any system feature by key."""
    flag = update_feature_flag(
        db=db,
        key=key,
        is_enabled=payload.is_enabled,
        fallback_behavior=payload.fallback_behavior,
        admin_id=current_user.id,
    )
    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feature flag '{key}' not found in registry.",
        )
    cache.delete(CACHE_KEY_PUBLIC)
    return flag
