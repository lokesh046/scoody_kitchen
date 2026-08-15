from datetime import date, datetime
from pydantic import BaseModel, Field

from app.models.enums import HealthRecordType


class HealthRecordCreate(BaseModel):
    pet_id: int
    consultation_id: int | None = None
    record_type: HealthRecordType = HealthRecordType.GENERAL
    title: str = Field(min_length=2, max_length=200)
    symptoms: str | None = None
    clinical_findings: str | None = None
    diagnosis: str | None = None
    treatment: str | None = None
    medications: str | None = None
    follow_up_date: date | None = None
    notes: str | None = None


class HealthRecordUpdate(BaseModel):
    record_type: HealthRecordType | None = None
    title: str | None = Field(default=None, min_length=2, max_length=200)
    symptoms: str | None = None
    clinical_findings: str | None = None
    diagnosis: str | None = None
    treatment: str | None = None
    medications: str | None = None
    follow_up_date: date | None = None
    notes: str | None = None


class DoctorMinimalSummary(BaseModel):
    id: int
    specialization: str

    model_config = {"from_attributes": True}


class HealthRecordResponse(BaseModel):
    id: int
    pet_id: int
    doctor_id: int | None = None
    consultation_id: int | None = None
    record_type: HealthRecordType
    title: str
    symptoms: str | None = None
    clinical_findings: str | None = None
    diagnosis: str | None = None
    treatment: str | None = None
    medications: str | None = None
    follow_up_date: date | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    doctor: DoctorMinimalSummary | None = None

    model_config = {"from_attributes": True}


class PetHealthHistoryResponse(BaseModel):
    pet_id: int
    records: list[HealthRecordResponse]
