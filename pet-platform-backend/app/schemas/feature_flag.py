from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

FallbackBehavior = Literal["hide", "coming_soon", "unavailable"]

class FeatureFlagUpdate(BaseModel):
    is_enabled: bool = Field(..., description="Whether this feature is active or disabled")
    fallback_behavior: FallbackBehavior | None = Field(
        None, description="What to render while disabled: hide, coming_soon, or unavailable. Omit to leave unchanged."
    )

class FeatureFlagResponse(BaseModel):
    id: int
    key: str
    name: str
    description: str | None = None
    category: str
    is_enabled: bool
    fallback_behavior: FallbackBehavior
    updated_at: datetime
    updated_by_id: int | None = None

    class Config:
        from_attributes = True

class PublicFeatureFlagState(BaseModel):
    enabled: bool
    fallback_behavior: FallbackBehavior
