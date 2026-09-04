from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.coupon import Coupon, DiscountType
from app.schemas.coupon import CouponCreate, CouponUpdate


def calculate_coupon_discount(
    coupon: Coupon,
    order_amount: Decimal,
) -> tuple[bool, Decimal, str]:
    """
    Validates a coupon against the given order amount and calculates the discount.
    Returns: (is_valid: bool, discount_amount: Decimal, message: str)
    """
    now = datetime.now(timezone.utc)

    if not coupon.is_active:
        return False, Decimal("0.00"), "This coupon code is inactive."

    if coupon.valid_until is not None:
        valid_until = coupon.valid_until
        if valid_until.tzinfo is None:
            valid_until = valid_until.replace(tzinfo=timezone.utc)
        if now > valid_until:
            return False, Decimal("0.00"), "This coupon code has expired."

    if coupon.valid_from is not None:
        valid_from = coupon.valid_from
        if valid_from.tzinfo is None:
            valid_from = valid_from.replace(tzinfo=timezone.utc)
        if now < valid_from:
            return False, Decimal("0.00"), "This coupon is not yet valid."

    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        return False, Decimal("0.00"), "This coupon usage limit has been reached."

    if order_amount < coupon.min_order_amount:
        return (
            False,
            Decimal("0.00"),
            f"Minimum cart value of ₹{coupon.min_order_amount} required to use this code.",
        )

    # Calculate discount
    if coupon.discount_type == DiscountType.PERCENTAGE:
        raw_discount = (order_amount * coupon.discount_value) / Decimal("100")
        if coupon.max_discount_amount is not None:
            discount = min(raw_discount, coupon.max_discount_amount)
        else:
            discount = raw_discount
    else:  # FLAT
        discount = min(coupon.discount_value, order_amount)

    discount = round(discount, 2)
    return True, discount, f"Coupon '{coupon.code.upper()}' applied successfully!"


def validate_coupon_code(
    db: Session,
    code: str,
    order_amount: Decimal,
) -> tuple[bool, Coupon | None, Decimal, Decimal, str]:
    """
    Looks up and validates a coupon code.
    Returns: (is_valid, coupon, discount_amount, final_amount, message)
    """
    normalized_code = code.strip().upper()
    statement = select(Coupon).where(Coupon.code == normalized_code)
    coupon = db.scalars(statement).first()

    if coupon is None:
        return False, None, Decimal("0.00"), order_amount, f"Invalid promo code '{code}'."

    is_valid, discount, message = calculate_coupon_discount(coupon, order_amount)
    final_amount = max(Decimal("0.00"), order_amount - discount)

    return is_valid, coupon, discount, final_amount, message


def create_coupon(db: Session, data: CouponCreate) -> Coupon:
    normalized_code = data.code.strip().upper()
    existing = db.scalars(select(Coupon).where(Coupon.code == normalized_code)).first()
    if existing:
        raise ValueError(f"Coupon code '{normalized_code}' already exists.")

    coupon = Coupon(
        code=normalized_code,
        description=data.description,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        min_order_amount=data.min_order_amount,
        max_discount_amount=data.max_discount_amount,
        valid_until=data.valid_until,
        usage_limit=data.usage_limit,
        is_active=data.is_active,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


def get_all_coupons(db: Session, is_active_only: bool = False) -> list[Coupon]:
    query = select(Coupon).order_by(Coupon.created_at.desc())
    if is_active_only:
        query = query.where(Coupon.is_active == True)  # noqa: E712
    return list(db.scalars(query).all())


def get_coupon_by_id(db: Session, coupon_id: int) -> Coupon | None:
    return db.get(Coupon, coupon_id)


def update_coupon(db: Session, coupon: Coupon, data: CouponUpdate) -> Coupon:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(coupon, field, value)
    db.commit()
    db.refresh(coupon)
    return coupon


def delete_coupon(db: Session, coupon: Coupon) -> None:
    db.delete(coupon)
    db.commit()


def increment_coupon_usage(db: Session, code: str) -> None:
    normalized_code = code.strip().upper()
    coupon = db.scalars(select(Coupon).where(Coupon.code == normalized_code)).first()
    if coupon:
        coupon.used_count += 1
        db.commit()
