from datetime import date, datetime
import re

from pydantic import BaseModel, Field, field_validator


def _clean_microchip(value: str | None) -> str | None:
    """Accepts the number as printed on the chip card (spaces or dashes allowed); blank means none."""
    if value is None:
        return None
    digits = re.sub(r"[\s-]", "", value)
    if not digits:
        return None
    if not re.fullmatch(r"\d{9,15}", digits):
        raise ValueError("Microchip number must be 9 to 15 digits")
    return digits


class PetCreate(BaseModel):
    name: str =  Field(
        min_length= 1,
        max_length= 100,
    )

    species: str = Field(
        min_length=1,
        max_length=50
    )

    breed: str | None = Field(
        default = None,
        max_length= 100,
    )

    gender: str | None = Field(
        default=None,
        max_length=20,
    )

    date_of_birth: date | None = None

    weight: float | None = Field(
        default=None,
        gt=0,
    )

    profile_image_url: str | None = None

    microchip_number: str | None = None

    _validate_microchip = field_validator("microchip_number", mode="before")(_clean_microchip)



class PetUpdate(BaseModel):
    name: str | None = Field(
        default = None,
        min_length=1,
        max_length=100   
    )

    species: str | None = Field(
        default = None,
        min_length=1,
        max_length=50
    )

    breed: str | None = Field(
        default = None,
        max_length=100,
        )

    gender: str | None = Field(
        default = None,
        max_length=20,
    )

    date_of_birth: date | None = None

    weight: float | None = Field(
        default = None,
        gt = 0,
        )

    profile_image_url: str | None = None

    microchip_number: str | None = None

    _validate_microchip = field_validator("microchip_number", mode="before")(_clean_microchip)

class PetResponse(BaseModel):
    id: int
    user_id: int
    name: str
    species: str
    breed: str | None
    gender: str | None
    date_of_birth: date | None
    weight: float | None
    profile_image_url: str | None
    microchip_number: str | None = None
    created_at: datetime


    model_config = {
        "from_attributes": True
    }
    