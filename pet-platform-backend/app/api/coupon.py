from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.coupon import CouponValidateRequest, CouponValidateResponse
from app.services.coupon_service import validate_coupon_code

router = APIRouter(
    prefix="/coupons",
    tags=["Coupons"],
)


@router.post(
    "/validate",
    response_model=CouponValidateResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
def validate_coupon_endpoint(
    request: Request,
    payload: CouponValidateRequest,
    db: Session = Depends(get_db),
):
    """
    Validates a coupon code against a cart order amount.
    Returns the computed discount and final payable amount.
    """
    is_valid, coupon, discount_amount, final_amount, message = validate_coupon_code(
        db,
        code=payload.code,
        order_amount=payload.order_amount,
    )

    if not is_valid or coupon is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    return CouponValidateResponse(
        valid=True,
        code=coupon.code,
        discount_type=coupon.discount_type,
        discount_value=coupon.discount_value,
        discount_amount=discount_amount,
        final_amount=final_amount,
        message=message,
    )
