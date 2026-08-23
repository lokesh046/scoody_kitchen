from datetime import date, datetime
from pydantic import BaseModel, Field


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
    created_at: datetime


    model_config = {
        "from_attributes": True
    }
    