from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.models.coupon import DiscountType


class CouponBase(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    description: str | None = None
    discount_type: DiscountType = DiscountType.PERCENTAGE
    discount_value: Decimal = Field(gt=0)
    min_order_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    max_discount_amount: Decimal | None = None
    valid_until: datetime | None = None
    usage_limit: int | None = None
    is_active: bool = True


class CouponCreate(CouponBase):
    pass


class CouponUpdate(BaseModel):
    description: str | None = None
    discount_type: DiscountType | None = None
    discount_value: Decimal | None = None
    min_order_amount: Decimal | None = None
    max_discount_amount: Decimal | None = None
    valid_until: datetime | None = None
    usage_limit: int | None = None
    is_active: bool | None = None


class CouponResponse(CouponBase):
    id: int
    used_count: int
    valid_from: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class CouponValidateRequest(BaseModel):
    code: str
    order_amount: Decimal = Field(ge=0)


class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_type: DiscountType
    discount_value: Decimal
    discount_amount: Decimal
    final_amount: Decimal
    message: str
