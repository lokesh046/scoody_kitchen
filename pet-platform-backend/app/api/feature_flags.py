from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.feature_flag import FeatureFlagResponse, FeatureFlagUpdate
from app.services.feature_flag_service import (
    get_all_flags_admin,
    get_public_flags,
    update_feature_flag,
)

router = APIRouter(tags=["Feature Flags"])

@router.get("/features/public", response_model=Dict[str, bool])
def get_public_feature_flags(db: Session = Depends(get_db)):
    """Public endpoint: Returns active feature states for frontend client rendering."""
    return get_public_flags(db)

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
        admin_id=current_user.id,
    )
    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feature flag '{key}' not found in registry.",
        )
    return flag
