from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class PushTokenRegister(BaseModel):
    expo_push_token: str = Field(min_length=10, max_length=255)
    platform: Literal["ios", "android"]


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    link: str | None = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class NotificationUnreadCountResponse(BaseModel):
    count: int
