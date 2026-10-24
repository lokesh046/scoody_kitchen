from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field

class CategoryCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    description: str | None = None

    parent_category_id: int | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    description: str | None = None

    parent_category_id: int | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_url: str | None
    parent_category_id: int | None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class CategoryTreeResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_url: str | None
    parent_category_id: int | None
    created_at: datetime
    children: list["CategoryTreeResponse"] = []

    model_config = {
        "from_attributes": True
    }
