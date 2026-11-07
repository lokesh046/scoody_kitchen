from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class VaccinationCreate(BaseModel):
    vaccine_code: str = Field(min_length=1, max_length=40)
    date_given: date
    clinic_name: str | None = Field(default=None, max_length=150)
    batch_number: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=1000)

    _strip = field_validator("clinic_name", "batch_number", "notes", mode="before")(
        lambda v: _clean(v) if isinstance(v, str) or v is None else v
    )


class VaccinationUpdate(BaseModel):
    date_given: date | None = None
    clinic_name: str | None = Field(default=None, max_length=150)
    batch_number: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=1000)

    _strip = field_validator("clinic_name", "batch_number", "notes", mode="before")(
        lambda v: _clean(v) if isinstance(v, str) or v is None else v
    )


class VaccinationRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pet_id: int
    vaccine_code: str
    date_given: date
    clinic_name: str | None = None
    batch_number: str | None = None
    notes: str | None = None
    image_url: str | None = None
    created_at: datetime


class VaccineStatusItem(BaseModel):
    code: str
    name: str
    category: str
    description: str | None = None
    vet_reviewed: bool
    status: str
    next_due_date: date | None = None
    last_given_date: date | None = None
    doses_given: int
    series_doses: int


class VaccinationOverviewResponse(BaseModel):
    pet_id: int
    species: str
    supported: bool
    date_of_birth_known: bool
    items: list[VaccineStatusItem]
    records: list[VaccinationRecordResponse]
