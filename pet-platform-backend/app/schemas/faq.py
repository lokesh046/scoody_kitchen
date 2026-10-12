from datetime import datetime
from pydantic import BaseModel, Field

class FAQCreate(BaseModel):
    question: str = Field(max_length=300)
    answer: str
    display_order: int = Field(default=0)
    is_active: bool = Field(default=True)

class FAQUpdate(BaseModel):
    question: str | None = Field(default=None, max_length=300)
    answer: str | None = Field(default=None)
    display_order: int | None = Field(default=None)
    is_active: bool | None = Field(default=None)

class FAQResponse(BaseModel):
    id: int
    question: str
    answer: str
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
