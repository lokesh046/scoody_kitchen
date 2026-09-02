from datetime import datetime
from pydantic import BaseModel, Field

class FeatureFlagUpdate(BaseModel):
    is_enabled: bool = Field(..., description="Whether this feature is active or disabled")

class FeatureFlagResponse(BaseModel):
    id: int
    key: str
    name: str
    description: str | None = None
    category: str
    is_enabled: bool
    updated_at: datetime
    updated_by_id: int | None = None

    class Config:
        from_attributes = True
