from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

class DoctorApplicationCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=150)
    last_name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=150)
    phone: str = Field(min_length=3, max_length=50)
    specialization: str = Field(min_length=1, max_length=150)
    qualification: str = Field(min_length=1, max_length=150)
    experience_years: int = Field(default=0, ge=0)
    consultation_fee: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    license_number: str = Field(min_length=1, max_length=100)
    bio: str | None = None
    degree_start_year: int = Field(ge=1900)
    degree_end_year: int = Field(ge=1900)
    nationality: str = Field(min_length=1, max_length=100)
    education_history: str | None = None
    clinic_name: str = Field(min_length=1, max_length=150)
    clinic_address: str = Field(min_length=1, max_length=255)
    clinic_city: str = Field(min_length=1, max_length=100)
    clinic_state: str = Field(min_length=1, max_length=100)
    aadhaar_card_url: str | None = None
    pan_card_url: str | None = None
    medical_certificate_url: str | None = None

class DoctorApplicationResponse(BaseModel):
    id: int
    user_id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    specialization: str
    qualification: str
    experience_years: int
    consultation_fee: Decimal
    license_number: str
    bio: str | None = None
    degree_start_year: int
    degree_end_year: int
    nationality: str
    education_history: str | None = None
    clinic_name: str
    clinic_address: str
    clinic_city: str
    clinic_state: str
    aadhaar_card_url: str | None = None
    pan_card_url: str | None = None
    medical_certificate_url: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class DoctorApplicationUpdateStatus(BaseModel):
    status: str = Field(min_length=1, max_length=50)
