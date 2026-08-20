from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator

from app.models.enums import ConsultationStatus


class ConsultationCreate(BaseModel):
    pet_id: int
    doctor_id: int
    scheduled_at: datetime
    reason: str = Field(min_length=3, max_length=500)
    customer_notes: str | None = None


class ConsultationStatusUpdate(BaseModel):
    status: ConsultationStatus
    doctor_notes: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: str) -> str:
        if isinstance(v, str):
            return v.lower()
        return v


class PetMinimalResponse(BaseModel):
    id: int
    name: str
    species: str
    breed: str | None = None

    model_config = {"from_attributes": True}


class DoctorMinimalResponse(BaseModel):
    id: int
    specialization: str
    qualification: str
    consultation_fee: Decimal

    model_config = {"from_attributes": True}


class ConsultationResponse(BaseModel):
    id: int
    customer_id: int
    pet_id: int
    doctor_id: int
    scheduled_at: datetime
    duration_minutes: int
    status: ConsultationStatus
    reason: str
    customer_notes: str | None = None
    doctor_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    pet: PetMinimalResponse | None = None
    doctor: DoctorMinimalResponse | None = None

    model_config = {"from_attributes": True}


class DoctorSlotsResponse(BaseModel):
    doctor_id: int
    date: str
    duration_minutes: int
    slots: list[str]


from app.schemas.pagination import PaginatedResponse


class PaginatedConsultationResponse(PaginatedResponse[ConsultationResponse]):
    pass
