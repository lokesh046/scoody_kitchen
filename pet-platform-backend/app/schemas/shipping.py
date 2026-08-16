from datetime import datetime
from pydantic import BaseModel, Field


class CreateShipmentRequest(BaseModel):
    tracking_number: str = Field(
        ...,
        min_length=5,
        max_length=255,
        description="Courier tracking number (e.g. EZ2000000002)",
    )
    carrier: str = Field(
        default="USPS",
        min_length=2,
        max_length=100,
        description="Shipping carrier name (e.g. USPS, FedEx, DHL)",
    )


class ShipmentResponse(BaseModel):
    provider: str
    tracking_number: str
    carrier: str
    status: str
    estimated_delivery: datetime | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None

    model_config = {"from_attributes": True}


class OrderStatusTimelineItem(BaseModel):
    status: str
    description: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class OrderTrackingResponse(BaseModel):
    order_id: int
    order_status: str
    shipment: ShipmentResponse | None = None
    timeline: list[OrderStatusTimelineItem]

    model_config = {"from_attributes": True}
