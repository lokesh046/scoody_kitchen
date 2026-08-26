from datetime import datetime
from pydantic import BaseModel, Field

class BannerCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    subtitle: str | None = Field(default=None, max_length=500)
    link_url: str | None = Field(default=None, max_length=500)
    display_order: int = Field(default=0)
    is_active: bool = Field(default=True)

class BannerUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    subtitle: str | None = Field(default=None, max_length=500)
    link_url: str | None = Field(default=None, max_length=500)
    display_order: int | None = Field(default=None)
    is_active: bool | None = Field(default=None)

class BannerResponse(BaseModel):
    id: int
    title: str | None = None
    subtitle: str | None = None
    image_url: str
    link_url: str | None = None
    display_order: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
