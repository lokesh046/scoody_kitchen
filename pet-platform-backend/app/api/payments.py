from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentResponse, RazorpayVerifyRequest
from app.services.payment_service import (
    create_payment,
    process_payment_failure,
    process_payment_success,
)
from app.services.order_service import get_user_order


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)

@router.post(
    "/{order_id}",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
def create_order_payment(
    request: Request,
    order_id: int,
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_user_order(
        db,
        current_user.id,
        order_id,
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    try:
        payment = create_payment(
            db,
            order,
            payment_data.payment_method,
        )
        from app.core.config import settings
        payment.razorpay_key_id = settings.RAZORPAY_KEY_ID
        return payment

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/{order_id}/success",
    response_model=PaymentResponse,
)
@limiter.limit("10/minute")
def simulate_payment_success(
    request: Request,
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.config import settings
    if settings.RAZORPAY_KEY_ID or settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manual payment simulation is disabled when Razorpay is active."
        )

    order = get_user_order(
        db,
        current_user.id,
        order_id,
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    payment = order.payment

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    try:
        return process_payment_success(
            db,
            payment,
        )

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/{order_id}/failure",
    response_model=PaymentResponse,
)
@limiter.limit("10/minute")
def simulate_payment_failure(
    request: Request,
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.config import settings
    if settings.RAZORPAY_KEY_ID or settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manual payment simulation is disabled when Razorpay is active."
        )

    order = get_user_order(
        db,
        current_user.id,
        order_id,
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    payment = order.payment

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    try:
        return process_payment_failure(
            db,
            payment,
        )

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/razorpay/verify",
    response_model=PaymentResponse,
)
@limiter.limit("10/minute")
def verify_razorpay(
    request: Request,
    verify_data: RazorpayVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_user_order(
        db,
        current_user.id,
        verify_data.order_id,
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    payment = order.payment

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment session not found",
        )

    if payment.razorpay_order_id != verify_data.razorpay_order_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Razorpay order ID mismatch",
        )

    try:
        from app.services.payment_service import verify_razorpay_payment
        verified_payment = verify_razorpay_payment(
            db=db,
            payment=payment,
            razorpay_payment_id=verify_data.razorpay_payment_id,
            razorpay_signature=verify_data.razorpay_signature,
        )
        from app.core.config import settings
        verified_payment.razorpay_key_id = settings.RAZORPAY_KEY_ID
        return verified_payment

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/razorpay/webhook",
    status_code=status.HTTP_200_OK,
)
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")

    from app.core.config import settings
    # 1. Verify Webhook Signature
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook verification is misconfigured on the server.",
        )

    if not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header",
        )

    from app.services.payment_service import verify_razorpay_webhook_signature
    is_valid = verify_razorpay_webhook_signature(
        payload=payload,
        signature=signature,
        secret=settings.RAZORPAY_WEBHOOK_SECRET,
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )

    # 2. Parse JSON Payload
    try:
        import json
        event_data = json.loads(payload)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    event_type = event_data.get("event")

    if event_type in ("order.paid", "payment.captured"):
        order_payload = event_data.get("payload", {}).get("order", {}).get("entity", {})
        payment_payload = event_data.get("payload", {}).get("payment", {}).get("entity", {})

        razorpay_order_id = order_payload.get("id") or payment_payload.get("order_id")
        razorpay_payment_id = payment_payload.get("id")

        if not razorpay_order_id:
            return {"status": "ignored", "detail": "Missing razorpay_order_id"}

        from sqlalchemy import select
        from app.models.payment import Payment, PaymentStatus

        payment = db.scalar(
            select(Payment).where(Payment.razorpay_order_id == razorpay_order_id)
        )

        if not payment:
            return {
                "status": "not_found",
                "detail": f"Payment session for Razorpay Order ID {razorpay_order_id} not found",
            }

        if payment.status == PaymentStatus.SUCCESS:
            return {"status": "already_processed"}

        try:
            if razorpay_payment_id:
                payment.transaction_id = razorpay_payment_id
            payment.razorpay_signature = signature or "webhook_verified"

            from app.services.payment_service import process_payment_success
            process_payment_success(db, payment)
            return {"status": "success", "order_id": payment.order_id}
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process webhook order capture: {str(exc)}",
            )

    elif event_type == "payment.failed":
        payment_payload = event_data.get("payload", {}).get("payment", {}).get("entity", {})
        razorpay_order_id = payment_payload.get("order_id")
        razorpay_payment_id = payment_payload.get("id")
        error_desc = payment_payload.get("error_description") or "Payment failed at bank gateway"

        if not razorpay_order_id:
            return {"status": "ignored", "detail": "Missing razorpay_order_id"}

        from sqlalchemy import select
        from app.models.payment import Payment, PaymentStatus

        payment = db.scalar(
            select(Payment).where(Payment.razorpay_order_id == razorpay_order_id)
        )

        if payment and payment.status != PaymentStatus.SUCCESS:
            payment.status = PaymentStatus.FAILED
            if razorpay_payment_id:
                payment.transaction_id = razorpay_payment_id
            db.commit()
            return {"status": "failure_recorded", "order_id": payment.order_id, "detail": error_desc}

        return {"status": "ignored", "detail": "Payment already resolved or not found"}

    return {"status": "ignored", "event": event_type}