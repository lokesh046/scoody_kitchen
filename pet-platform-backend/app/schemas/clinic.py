from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field
from app.schemas.pagination import PaginatedResponse


class ClinicCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    address: str = Field(min_length=1, max_length=300)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    phone: str = Field(min_length=1, max_length=20)
    email: EmailStr | None = None
    latitude: Decimal | None = Field(default=None, ge=Decimal("-90.0"), le=Decimal("90.0"))
    longitude: Decimal | None = Field(default=None, ge=Decimal("-180.0"), le=Decimal("180.0"))
    opening_hours: str | None = None


class ClinicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    address: str | None = Field(default=None, min_length=1, max_length=300)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    state: str | None = Field(default=None, min_length=1, max_length=100)
    postal_code: str | None = Field(default=None, min_length=1, max_length=20)
    phone: str | None = Field(default=None, min_length=1, max_length=20)
    email: EmailStr | None = None
    latitude: Decimal | None = Field(default=None, ge=Decimal("-90.0"), le=Decimal("90.0"))
    longitude: Decimal | None = Field(default=None, ge=Decimal("-180.0"), le=Decimal("180.0"))
    opening_hours: str | None = None
    is_active: bool | None = None


class ClinicResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    address: str
    city: str
    state: str
    postal_code: str
    phone: str
    email: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    opening_hours: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedClinicResponse(PaginatedResponse[ClinicResponse]):
    pass
