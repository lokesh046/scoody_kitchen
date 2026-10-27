from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

FAQPage = Literal["home", "shop", "pets", "vet"]

class FAQCreate(BaseModel):
    question: str = Field(max_length=300)
    answer: str
    page: FAQPage = "home"
    display_order: int = Field(default=0)
    is_active: bool = Field(default=True)

class FAQUpdate(BaseModel):
    question: str | None = Field(default=None, max_length=300)
    answer: str | None = Field(default=None)
    page: FAQPage | None = None
    display_order: int | None = Field(default=None)
    is_active: bool | None = Field(default=None)

class FAQResponse(BaseModel):
    id: int
    question: str
    answer: str
    page: str = "home"
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
