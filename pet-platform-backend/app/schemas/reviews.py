from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.auth import UserResponse
from app.schemas.pagination import PaginatedResponse


class DoctorReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    comment: str | None = Field(None, max_length=1000, description="Optional text review")


class DoctorReviewResponse(BaseModel):
    id: int
    consultation_id: int
    doctor_id: int
    customer_id: int
    rating: int
    comment: str | None = None
    created_at: datetime
    updated_at: datetime
    customer: UserResponse | None = None

    model_config = {"from_attributes": True}


class PaginatedDoctorReviewResponse(PaginatedResponse[DoctorReviewResponse]):
    pass


class ProductReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    comment: str | None = Field(None, max_length=1000, description="Optional text review")
    image_url: str | None = Field(None, max_length=500, description="Optional uploaded review image URL")


class ProductReviewResponse(BaseModel):
    id: int
    product_id: int
    user_id: int
    rating: int
    comment: str | None = None
    image_url: str | None = None
    is_verified_buyer: bool = False
    created_at: datetime
    updated_at: datetime
    user: UserResponse | None = None

    model_config = {"from_attributes": True}


class PaginatedProductReviewResponse(PaginatedResponse[ProductReviewResponse]):
    pass
