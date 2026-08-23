import hmac
import hashlib
import json
from decimal import Decimal
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.order import Order, OrderStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole

client = TestClient(app)


def test_webhook_missing_signature():
    settings.RAZORPAY_WEBHOOK_SECRET = "test_secret"
    response = client.post("/payments/razorpay/webhook", content="{}")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Missing X-Razorpay-Signature" in response.json()["detail"]


def test_webhook_secret_missing_on_server():
    settings.RAZORPAY_WEBHOOK_SECRET = None
    response = client.post("/payments/razorpay/webhook", content="{}")
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert "Webhook verification is misconfigured" in response.json()["detail"]


def test_webhook_invalid_signature():
    settings.RAZORPAY_WEBHOOK_SECRET = "test_secret"
    headers = {"X-Razorpay-Signature": "invalid_sig"}
    response = client.post("/payments/razorpay/webhook", content="{}", headers=headers)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid webhook signature" in response.json()["detail"]


def test_webhook_ignored_event():
    settings.RAZORPAY_WEBHOOK_SECRET = "test_secret"
    payload = json.dumps({"event": "payment.failed"}).encode("utf-8")
    signature = hmac.new(b"test_secret", payload, hashlib.sha256).hexdigest()
    headers = {"X-Razorpay-Signature": signature}

    response = client.post("/payments/razorpay/webhook", content=payload, headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "ignored"


def test_webhook_order_paid():
    import uuid
    settings.RAZORPAY_WEBHOOK_SECRET = "test_secret"
    rzp_order_id = f"order_webhook_test_{uuid.uuid4().hex[:12]}"

    db_session = SessionLocal()
    try:
        user = db_session.query(User).filter_by(email="webhook_customer@test.com").first()
        if not user:
            user = User(
                email="webhook_customer@test.com",
                first_name="Webhook",
                last_name="Tester",
                role=UserRole.CUSTOMER,
                is_email_verified=True,
            )
            db_session.add(user)
            db_session.commit()
            db_session.refresh(user)

        order = Order(
            user_id=user.id,
            status=OrderStatus.PENDING,
            total_amount=Decimal("150.00"),
            shipping_address="123 Street, City, Country",
        )
        db_session.add(order)
        db_session.commit()
        db_session.refresh(order)

        payment = Payment(
            order_id=order.id,
            amount=order.total_amount,
            status=PaymentStatus.PENDING,
            payment_method="CARD",
            razorpay_order_id=rzp_order_id,
        )
        db_session.add(payment)
        db_session.commit()

        payload_dict = {
            "event": "order.paid",
            "payload": {
                "order": {
                    "entity": {
                        "id": rzp_order_id,
                        "amount": 15000,
                    }
                },
                "payment": {
                    "entity": {
                        "id": "pay_webhook_test_123",
                        "status": "captured",
                    }
                },
            },
        }
        payload = json.dumps(payload_dict).encode("utf-8")
        signature = hmac.new(b"test_secret", payload, hashlib.sha256).hexdigest()
        headers = {"X-Razorpay-Signature": signature}

        response = client.post("/payments/razorpay/webhook", content=payload, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "success"

        # Refresh DB session and assert
        db_session.expire_all()
        updated_payment = db_session.get(Payment, payment.id)
        assert updated_payment.status == PaymentStatus.SUCCESS
        assert updated_payment.transaction_id == "pay_webhook_test_123"

        updated_order = db_session.get(Order, order.id)
        assert updated_order.status == OrderStatus.CONFIRMED

        # Clean up test rows
        db_session.delete(updated_payment)
        db_session.delete(updated_order)
        db_session.commit()
    finally:
        db_session.close()
