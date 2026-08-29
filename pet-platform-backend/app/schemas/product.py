from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator


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

    in_slider: bool = False


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

    in_slider: bool | None = None


class ProductImageResponse(BaseModel):
    id: int | None = None
    product_id: int
    image_url: str
    display_order: int

    model_config = {
        "from_attributes": True
    }


class ProductResponse(BaseModel):
    id: int
    category_id: int
    name: str
    description: str | None
    sku: str
    price: Decimal
    image_url: str | None = None
    is_active: bool
    in_slider: bool
    created_at: datetime
    updated_at: datetime

    category: CategoryResponse | None = None
    available_stock: int | None = None
    is_in_stock: bool | None = None
    inventory_id: int | None = None
    reserved_stock: int | None = None
    low_stock_threshold: int | None = None
    images: list[ProductImageResponse] = []
    weight_options: list[dict] | None = None
    average_rating: float = 0.0
    review_count: int = 0

    @field_validator("in_slider", mode="before")
    @classmethod
    def set_in_slider_default(cls, v):
        return v if v is not None else False

    model_config = {
        "from_attributes": True
    }


from app.schemas.pagination import PaginatedResponse


class PaginatedProductResponse(PaginatedResponse[ProductResponse]):
    pass
