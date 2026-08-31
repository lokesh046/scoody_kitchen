from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator

from app.models.enums import ConsultationStatus
from app.schemas.auth import UserResponse
from app.schemas.clinic import ClinicResponse
from app.schemas.pagination import PaginatedResponse


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
    user_id: int | None = None
    specialization: str
    qualification: str
    consultation_fee: Decimal
    user: UserResponse | None = None
    clinic: ClinicResponse | None = None

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
    meeting_room_id: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    can_join: bool = True
    time_until_start_seconds: int | None = None
    time_remaining_seconds: int | None = None
    is_expired: bool = False
    created_at: datetime
    updated_at: datetime

    pet: PetMinimalResponse | None = None
    doctor: DoctorMinimalResponse | None = None

    model_config = {"from_attributes": True}


class ConsultationJoinResponse(BaseModel):
    meeting_room_id: str
    room_name: str
    jitsi_token: str
    jitsi_app_id: str | None = None
    jitsi_domain: str
    is_moderator: bool
    role: str = "participant"
    expires_at: str | None = None


class DoctorSlotsResponse(BaseModel):
    doctor_id: int
    date: str
    duration_minutes: int
    slots: list[str]


class PaginatedConsultationResponse(PaginatedResponse[ConsultationResponse]):
    pass


class ConsultationParticipantResponse(BaseModel):
    id: int
    session_id: int
    consultation_id: int
    user_id: int
    role: str
    joined_at: datetime
    left_at: datetime | None = None
    duration_seconds: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConsultationSessionResponse(BaseModel):
    id: int
    consultation_id: int
    room_id: str
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    participants: list[ConsultationParticipantResponse] = []

    model_config = {"from_attributes": True}


class ConsultationAuditResponse(BaseModel):
    consultation_id: int
    status: ConsultationStatus
    scheduled_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    total_sessions: int
    sessions: list[ConsultationSessionResponse] = []
