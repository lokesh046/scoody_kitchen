from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.payment import PaymentStatus


class PaymentCreate(BaseModel):
    payment_method: str = Field(
        min_length=2,
        max_length=50,
    )


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    amount: Decimal
    status: PaymentStatus
    payment_method: str
    transaction_id: str | None
    razorpay_order_id: str | None = None
    razorpay_key_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class RazorpayVerifyRequest(BaseModel):
    order_id: int
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str