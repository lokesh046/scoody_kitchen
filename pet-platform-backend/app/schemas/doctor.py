from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.auth import UserResponse
from app.schemas.clinic import ClinicResponse


class DoctorCreate(BaseModel):
    user_id: int
    clinic_id: int | None = None
    specialization: str = Field(min_length=1, max_length=150)
    qualification: str = Field(min_length=1, max_length=150)
    experience_years: int = Field(default=0, ge=0)
    consultation_fee: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    license_number: str = Field(min_length=1, max_length=100)
    bio: str | None = None
    latitude: Decimal | None = Field(default=None, ge=Decimal("-90.0"), le=Decimal("90.0"))
    longitude: Decimal | None = Field(default=None, ge=Decimal("-180.0"), le=Decimal("180.0"))


class DoctorCreateAdmin(BaseModel):
    user_email: str
    clinic_id: int | None = None
    specialization: str = Field(min_length=1, max_length=150)
    qualification: str = Field(default="Degree in Veterinary Medicine", min_length=1, max_length=150)
    experience_years: int = Field(default=0, ge=0)
    consultation_fee: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    license_number: str = Field(min_length=1, max_length=100)
    bio: str | None = None
    latitude: Decimal | None = Field(default=None, ge=Decimal("-90.0"), le=Decimal("90.0"))
    longitude: Decimal | None = Field(default=None, ge=Decimal("-180.0"), le=Decimal("180.0"))


class DoctorUpdateAdmin(BaseModel):
    clinic_id: int | None = None
    specialization: str | None = Field(default=None, min_length=1, max_length=150)
    qualification: str | None = Field(default=None, min_length=1, max_length=150)
    experience_years: int | None = Field(default=None, ge=0)
    consultation_fee: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    license_number: str | None = Field(default=None, min_length=1, max_length=100)
    bio: str | None = None
    profile_image_url: str | None = None
    latitude: Decimal | None = Field(default=None, ge=Decimal("-90.0"), le=Decimal("90.0"))
    longitude: Decimal | None = Field(default=None, ge=Decimal("-180.0"), le=Decimal("180.0"))
    is_available: bool | None = None
    is_verified: bool | None = None
    is_active: bool | None = None


class DoctorUpdateSelf(BaseModel):
    qualification: str | None = Field(default=None, min_length=1, max_length=150)
    experience_years: int | None = Field(default=None, ge=0)
    consultation_fee: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    bio: str | None = None
    profile_image_url: str | None = None
    latitude: Decimal | None = Field(default=None, ge=Decimal("-90.0"), le=Decimal("90.0"))
    longitude: Decimal | None = Field(default=None, ge=Decimal("-180.0"), le=Decimal("180.0"))
    is_available: bool | None = None


class DoctorResponse(BaseModel):
    id: int
    user_id: int
    clinic_id: int | None = None
    specialization: str
    qualification: str
    experience_years: int
    consultation_fee: Decimal
    license_number: str
    bio: str | None = None
    profile_image_url: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_available: bool
    is_verified: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    user: UserResponse | None = None
    clinic: ClinicResponse | None = None

    model_config = {"from_attributes": True}


class DoctorPublicResponse(BaseModel):
    id: int
    user_id: int
    name: str | None = None
    specialization: str
    qualification: str
    experience_years: int
    consultation_fee: Decimal
    bio: str | None = None
    profile_image_url: str | None = None
    is_available: bool
    is_verified: bool
    clinic: ClinicResponse | None = None

    model_config = {"from_attributes": True}


from app.schemas.pagination import PaginatedResponse


class PaginatedDoctorResponse(PaginatedResponse[DoctorResponse]):
    pass


class NearbyDoctorResponse(BaseModel):
    id: int
    user_id: int
    name: str | None = None
    specialization: str
    qualification: str
    experience_years: int
    consultation_fee: Decimal
    bio: str | None = None
    profile_image_url: str | None = None
    is_available: bool
    is_verified: bool
    distance_km: float
    clinic: ClinicResponse | None = None

    model_config = {"from_attributes": True}
