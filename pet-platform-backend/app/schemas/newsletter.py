from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    source: str | None = Field(default=None, max_length=50)

class NewsletterSubscriberResponse(BaseModel):
    id: int
    email: str
    is_active: bool
    source: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
