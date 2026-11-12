import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_SPECIES = re.compile(r"^[a-z][a-z _-]{1,29}$")
_CODE = re.compile(r"^[a-z0-9_]{2,40}$")


def _clean(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class VaccineRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    species: str
    code: str
    name: str
    category: str
    description: str | None = None
    first_dose_weeks: int
    series_doses: int
    series_interval_weeks: int
    booster_months: int
    repeat_months: int
    booster_weeks: int | None = None
    sort_order: int
    is_active: bool
    vet_reviewed: bool


class VaccineRuleCreate(BaseModel):
    species: str = Field(min_length=2, max_length=30)
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=120)
    category: Literal["core", "non_core"] = "core"
    description: str | None = Field(default=None, max_length=1000)
    first_dose_weeks: int = Field(ge=0, le=520)
    series_doses: int = Field(default=1, ge=1, le=20)
    series_interval_weeks: int = Field(default=3, ge=0, le=52)
    booster_months: int = Field(default=12, ge=0, le=120)
    repeat_months: int = Field(default=12, ge=0, le=240)
    booster_weeks: int | None = Field(default=None, ge=1, le=260)
    sort_order: int = Field(default=0, ge=0, le=1000)
    is_active: bool = True
    vet_reviewed: bool = False

    @field_validator("species", mode="before")
    @classmethod
    def _species_ok(cls, v):
        v = str(v).strip().lower()
        if not _SPECIES.match(v):
            raise ValueError("Species must be 2-30 letters (for example: dog, cat, goat, cow)")
        return v

    @field_validator("code", mode="before")
    @classmethod
    def _code_ok(cls, v):
        v = str(v).strip().lower()
        if not _CODE.match(v):
            raise ValueError("Code must be 2-40 characters: lowercase letters, numbers and underscores")
        return v

    @field_validator("name", "description", mode="before")
    @classmethod
    def _strip(cls, v):
        return _clean(v) if isinstance(v, str) else v


class VaccineRuleUpdate(BaseModel):
    """Species and code cannot be changed (recorded doses refer to the code); use is_active=false to retire a rule."""

    name: str | None = Field(default=None, min_length=2, max_length=120)
    category: Literal["core", "non_core"] | None = None
    description: str | None = Field(default=None, max_length=1000)
    first_dose_weeks: int | None = Field(default=None, ge=0, le=520)
    series_doses: int | None = Field(default=None, ge=1, le=20)
    series_interval_weeks: int | None = Field(default=None, ge=0, le=52)
    booster_months: int | None = Field(default=None, ge=0, le=120)
    repeat_months: int | None = Field(default=None, ge=0, le=240)
    booster_weeks: int | None = Field(default=None, ge=1, le=260)
    sort_order: int | None = Field(default=None, ge=0, le=1000)
    is_active: bool | None = None
    vet_reviewed: bool | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def _strip(cls, v):
        return _clean(v) if isinstance(v, str) else v
