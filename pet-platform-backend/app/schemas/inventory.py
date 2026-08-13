from datetime import datetime

from pydantic import BaseModel, Field


class InventoryCreate(BaseModel):
    product_id: int = Field(gt=0)

    stock_quantity: int = Field(
        default=0,
        ge=0,
    )

    low_stock_threshold: int = Field(
        default=5,
        ge=0,
    )


class InventoryUpdate(BaseModel):
    stock_quantity: int | None = Field(
        default=None,
        ge=0,
    )

    low_stock_threshold: int | None = Field(
        default=None,
        ge=0,
    )


class InventoryResponse(BaseModel):
    id: int
    product_id: int
    stock_quantity: int
    reserved_quantity: int
    low_stock_threshold: int
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }