from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


from app.schemas.category import CategoryResponse


class ProductCreate(BaseModel):
    category_id: int = Field(gt=0)

    name: str = Field(
        min_length=1,
        max_length=200,
    )

    description: str | None = None

    sku: str = Field(
        min_length=1,
        max_length=100,
    )

    price: Decimal = Field(
        gt=Decimal("0.00")
    )


class ProductUpdate(BaseModel):
    category_id: int | None = Field(
        default=None,
        gt=0,
    )

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    description: str | None = None

    sku: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    price: Decimal | None = Field(
        default=None,
        gt=Decimal("0.00")
    )

    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: int
    category_id: int
    name: str
    description: str | None
    sku: str
    price: Decimal
    image_url: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    category: CategoryResponse | None = None
    available_stock: int | None = None
    is_in_stock: bool | None = None

    model_config = {
        "from_attributes": True
    }


class PaginatedProductResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    limit: int
    pages: int
