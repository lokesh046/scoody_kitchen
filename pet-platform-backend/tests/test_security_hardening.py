from unittest.mock import MagicMock

import jwt
import pytest
from fastapi import HTTPException
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import Setting, settings
from app.core.limiter import limiter
from app.core.search import clean_search, like_pattern


def _token(sub, token_type="access"):
    return jwt.encode(
        {"sub": str(sub), "type": token_type},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


# ---- search -----------------------------------------------------------------

def test_like_pattern_escapes_wildcards():
    assert like_pattern("100%") == "%100\\%%"
    assert like_pattern("a_b") == "%a\\_b%"
    assert like_pattern("a\\b") == "%a\\\\b%"


def test_like_pattern_trims_and_caps_length():
    assert like_pattern("  dog  ") == "%dog%"
    assert len(clean_search("x" * 500)) == 100
    assert like_pattern(None) == "%%"


# ---- secure defaults --------------------------------------------------------

def test_dev_only_switches_are_off_by_default():
    assert Setting.model_fields["CORS_ALLOW_DEV_ORIGINS"].default is False
    assert Setting.model_fields["ALLOW_PAYMENT_SIMULATION"].default is False


def test_payment_simulation_is_blocked_unless_explicitly_allowed(monkeypatch):
    from app.api.payments import _ensure_payment_simulation_allowed

    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", None)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", None)
    monkeypatch.setattr(settings, "ALLOW_PAYMENT_SIMULATION", False)
    with pytest.raises(HTTPException) as exc:
        _ensure_payment_simulation_allowed()
    assert exc.value.status_code == 403

    monkeypatch.setattr(settings, "ALLOW_PAYMENT_SIMULATION", True)
    _ensure_payment_simulation_allowed()  # allowed: opted in and no Razorpay keys

    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_x")
    with pytest.raises(HTTPException):
        _ensure_payment_simulation_allowed()  # keys present always wins


# ---- rate limits ------------------------------------------------------------

@pytest.mark.parametrize(
    "func",
    [
        "app.api.auth.verify_magic_link_via_url",
        "app.api.auth.verify_magic_link_via_post",
        "app.api.auth.refresh_token_endpoint",
        "app.api.auth.verify_firebase_phone",
        "app.api.auth.request_otp",
        "app.api.auth.send_whatsapp_otp_endpoint",
        "app.api.auth.verify_whatsapp_otp_endpoint",
        "app.api.newsletter.subscribe",
    ],
)
def test_sensitive_routes_are_rate_limited(func):
    import app.api.auth, app.api.newsletter  # noqa: F401  (registers the limits)

    assert func in limiter._route_limits, f"{func} has no rate limit"


# ---- payment signature ------------------------------------------------------

def test_bad_payment_signature_leaves_payment_pending(monkeypatch):
    from app.models.payment import PaymentStatus
    from app.services import payment_service as ps

    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "secret")
    failed = MagicMock()
    monkeypatch.setattr(ps, "process_payment_failure", failed)
    payment = MagicMock(status=PaymentStatus.PENDING, razorpay_order_id="order_1")

    with pytest.raises(ValueError, match="Invalid payment signature"):
        ps.verify_razorpay_payment(MagicMock(), payment, "pay_1", "not-the-signature")
    failed.assert_not_called()


def test_good_payment_signature_completes_payment(monkeypatch):
    import hashlib
    import hmac

    from app.models.payment import PaymentStatus
    from app.services import payment_service as ps

    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "secret")
    done = MagicMock(return_value="done")
    monkeypatch.setattr(ps, "process_payment_success", done)
    payment = MagicMock(status=PaymentStatus.PENDING, razorpay_order_id="order_1")
    good = hmac.new(b"secret", b"order_1|pay_1", hashlib.sha256).hexdigest()

    assert ps.verify_razorpay_payment(MagicMock(), payment, "pay_1", good) == "done"
    done.assert_called_once()


# ---- websocket auth ---------------------------------------------------------

def _client():
    from app.main import app

    return TestClient(app)


def test_websocket_accepts_token_sent_as_first_message():
    from app.core.websocket_manager import manager

    import time

    client = _client()
    with client.websocket_connect("/notifications/ws") as ws:
        ws.send_json({"type": "auth", "token": _token(4242)})
        deadline = time.time() + 3
        while 4242 not in manager.active_connections and time.time() < deadline:
            time.sleep(0.05)
        assert 4242 in manager.active_connections
    deadline = time.time() + 3
    while 4242 in manager.active_connections and time.time() < deadline:
        time.sleep(0.05)
    assert 4242 not in manager.active_connections


def test_websocket_rejects_bad_first_message():
    client = _client()
    for bad in ({"type": "auth", "token": "garbage"}, {"type": "nope"}, {"token": _token(1)}):
        with client.websocket_connect("/notifications/ws") as ws:
            ws.send_json(bad)
            with pytest.raises(WebSocketDisconnect):
                ws.receive_text()


def test_websocket_rejects_refresh_token_as_first_message():
    client = _client()
    with client.websocket_connect("/notifications/ws") as ws:
        ws.send_json({"type": "auth", "token": _token(1, "refresh")})
        with pytest.raises(WebSocketDisconnect):
            ws.receive_text()


def test_websocket_still_accepts_legacy_query_token():
    client = _client()
    with client.websocket_connect(f"/notifications/ws?token={_token(4243)}"):
        pass


def test_websocket_rejects_bad_legacy_query_token():
    client = _client()
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/notifications/ws?token=garbage"):
            pass
