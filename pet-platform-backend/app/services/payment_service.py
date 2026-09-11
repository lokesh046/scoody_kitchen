import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.payment import Payment, PaymentStatus
from app.services.inventory_service import finalize_stock, release_stock
from app.services.order_service import cancel_order, validate_order_status_transition, change_order_status

def create_payment(
    db: Session,
    order: Order,
    payment_method: str,
) -> Payment:

    if order.status != OrderStatus.PENDING:
        raise ValueError(
            "Payment can only be created for a pending order"
        )

    existing_payment = db.scalar(
        select(Payment).where(
            Payment.order_id == order.id
        )
    )

    if existing_payment is not None:
        raise ValueError(
            "Payment already exists for this order"
        )

    import razorpay
    from app.core.config import settings

    razorpay_order_id = None
    if payment_method == "CARD" and settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            amount_paise = int(order.total_amount * 100)
            razorpay_order = client.order.create(data={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"receipt_order_{order.id}",
                "payment_capture": 1
            })
            razorpay_order_id = razorpay_order.get("id")
        except Exception as e:
            raise ValueError(f"Failed to initiate Razorpay transaction: {str(e)}")

    payment = Payment(
        order_id=order.id,
        amount=order.total_amount,
        status=PaymentStatus.PENDING,
        payment_method=payment_method,
        razorpay_order_id=razorpay_order_id,
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    return payment



def process_payment_success(
    db: Session,
    payment: Payment,
) -> Payment:

    if payment.status != PaymentStatus.PENDING:
        raise ValueError(
            "Payment is no longer pending"
        )

    order = payment.order
    validate_order_status_transition(order.status, OrderStatus.CONFIRMED)

    order_items = list(
        db.scalars(
            select(OrderItem).where(
                OrderItem.order_id == order.id
            )
        ).all()
    )

    for order_item in order_items:
        finalize_stock(
            db,
            order_item.product_id,
            order_item.quantity,
        )

    payment.status = PaymentStatus.SUCCESS

    if not payment.transaction_id:
        payment.transaction_id = (
            f"TXN-{uuid.uuid4().hex[:16].upper()}"
        )

    change_order_status(db, order, OrderStatus.CONFIRMED, "Order payment verified and confirmed")

    from app.models.cart import Cart
    cart = db.scalar(
        select(Cart).where(Cart.user_id == order.user_id)
    )
    if cart:
        for cart_item in list(cart.items):
            db.delete(cart_item)

    if order.coupon_code:
        try:
            from app.services.coupon_service import increment_coupon_usage
            increment_coupon_usage(db, order.coupon_code)
        except Exception:
            pass

    db.commit()
    db.refresh(payment)

    return payment


def process_payment_failure(
    db: Session,
    payment: Payment,
) -> Payment:

    if payment.status != PaymentStatus.PENDING:
        raise ValueError(
            "Payment is no longer pending"
        )

    order = payment.order
    cancel_order(db, order)

    payment.status = PaymentStatus.FAILED

    db.commit()
    db.refresh(payment)

    return payment


def verify_razorpay_payment(
    db: Session,
    payment: Payment,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> Payment:
    import razorpay
    from app.core.config import settings

    if payment.status != PaymentStatus.PENDING:
        raise ValueError("Payment is no longer pending")

    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        # Fallback for manual local sandbox simulation (only allowed when DEBUG is True)
        if settings.DEBUG and razorpay_signature == "test_signature":
            pass
        else:
            raise ValueError("Razorpay credentials are not configured on server")
    else:
        try:
            import hmac
            import hashlib
            msg = f"{payment.razorpay_order_id}|{razorpay_payment_id}"
            expected = hmac.new(
                key=settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
                msg=msg.encode("utf-8"),
                digestmod=hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(expected, razorpay_signature):
                raise ValueError("HMAC signature mismatch")
        except Exception as e:
            process_payment_failure(db, payment)
            raise ValueError(f"Invalid payment signature verification failed: {str(e)}")

    payment.transaction_id = razorpay_payment_id
    payment.razorpay_signature = razorpay_signature

    return process_payment_success(db, payment)


def verify_razorpay_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str,
) -> bool:
    import hmac
    import hashlib
    try:
        expected = hmac.new(
            secret.encode("utf-8"),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return False