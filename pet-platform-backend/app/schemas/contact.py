import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

ContactReason = Literal["general", "sales", "promotion", "investment", "partnership", "other"]


class ContactInquiryCreate(BaseModel):
    reason: ContactReason
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    notes: str = Field(min_length=10, max_length=2000)
    # Honeypot: real visitors never see this field, so any value means a bot filled it in.
    website: str | None = Field(default=None, max_length=200)

    @field_validator("name", "notes")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not re.fullmatch(r"\+?[0-9 ()\-]{7,20}", v):
            raise ValueError("Enter a valid phone number")
        return v


class ContactInquiryResponse(BaseModel):
    id: int
    reason: str
    name: str
    email: str
    phone: str | None = None
    notes: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
