from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CartItemCreate(BaseModel):
    product_id: int = Field(gt=0)

    quantity: int = Field(
        gt=0,
    )


class CartItemUpdate(BaseModel):
    quantity: int = Field(
        gt=0,
    )


class CartItemResponse(BaseModel):
    id: int
    product_id: int

    name: str
    description: str | None

    price: Decimal
    quantity: int
    subtotal: Decimal

    created_at: datetime
    updated_at: datetime


class CartResponse(BaseModel):
    id: int
    user_id: int

    items: list[CartItemResponse]

    total_amount: Decimal