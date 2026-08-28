from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.order import OrderStatus


class CheckoutRequest(BaseModel):
    shipping_address: str = Field(
        min_length=10,
        max_length=500,
    )
    payment_method: str | None = None
    phone: str | None = None


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    image_url: str | None = None
    selected_weight: str | None = None
    product_name: str | None = None
    price: Decimal | None = None

    model_config = {
        "from_attributes": True
    }


class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: OrderStatus
    total_amount: Decimal
    shipping_address: str
    created_at: datetime
    updated_at: datetime
    razorpay_order_id: str | None = None
    razorpay_key_id: str | None = None
    user_phone: str | None = None
    user_email: str | None = None
    user_name: str | None = None

    items: list[OrderItemResponse]

    model_config = {
        "from_attributes": True
    }


class OrderStatusUpdate(BaseModel):
    status: OrderStatus