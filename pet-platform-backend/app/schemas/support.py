from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import SupportTicketCategory, SupportTicketStatus
from app.schemas.auth import UserResponse
from app.schemas.consultation import ConsultationResponse
from app.schemas.order import OrderResponse
from app.schemas.pagination import PaginatedResponse


class SupportTicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    category: SupportTicketCategory = SupportTicketCategory.OTHER
    # At most one of these may be set — enforced in support_service.py, not
    # here, since Pydantic field validators can't cleanly express "at most
    # one of two optional fields" alongside FastAPI's dependency-injected
    # DB-ownership check that also has to run for whichever one is set.
    order_id: int | None = None
    consultation_id: int | None = None
    message: str = Field(min_length=1, max_length=4000)


class SupportMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class SupportTicketStatusUpdate(BaseModel):
    status: SupportTicketStatus


class SupportMessageResponse(BaseModel):
    id: int
    ticket_id: int
    sender_id: int
    is_staff_reply: bool
    body: str
    created_at: datetime
    sender: UserResponse | None = None

    model_config = {"from_attributes": True}


class SupportTicketResponse(BaseModel):
    id: int
    customer_id: int
    order_id: int | None
    consultation_id: int | None
    subject: str
    category: SupportTicketCategory
    status: SupportTicketStatus
    assigned_admin_id: int | None
    created_at: datetime
    updated_at: datetime
    customer: UserResponse | None = None
    assigned_admin: UserResponse | None = None

    model_config = {"from_attributes": True}


class SupportTicketDetailResponse(SupportTicketResponse):
    messages: list[SupportMessageResponse] = []
    # Populated only when order_id/consultation_id is set — lets both the
    # customer and an admin see exactly which order or consultation a ticket
    # refers to without leaving the thread to look it up separately.
    order: OrderResponse | None = None
    consultation: ConsultationResponse | None = None


class SupportUnreadCountResponse(BaseModel):
    count: int


class PaginatedSupportTicketResponse(PaginatedResponse[SupportTicketResponse]):
    pass
