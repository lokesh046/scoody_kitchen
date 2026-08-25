import datetime
from pydantic import BaseModel

class CollegeSearchResponse(BaseModel):
    id: int
    name: str
    city: str | None = None
    district: str | None = None
    state: str | None = None
    is_active: bool
    last_updated: datetime.datetime

    class Config:
        from_attributes = True
