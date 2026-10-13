import hashlib
import hmac
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.services.whatsapp import normalize_phone_to_whatsapp_format

client = TestClient(app)

TEST_PHONE = "+919876543210"
TEST_PHONE_DIGITS = "919876543210"


def make_user():
    return User(
        id=1,
        email="whatsapp-test@example.com",
        role=UserRole.CUSTOMER,
        is_active=True,
        auth_provider="magic_link",
        is_email_verified=True,
        is_phone_verified=False,
    )


class MockPipeline:
    """Mirrors tests/test_otp_rate_limiting.py's MockRedisPipeline, extended
    with a set() that actually stores the value (needed here since
    send-otp's pipeline writes the OTP record itself, not just counters)."""

    def __init__(self, store):
        self.store = store
        self.results = []

    def ttl(self, key):
        self.results.append(self.store.ttls.get(key, -2))
        return self

    def get(self, key):
        self.results.append(self.store.data.get(key))
        return self

    def set(self, key, val, ex=None):
        self.store.data[key] = val
        self.store.ttls[key] = ex or -1
        return self

    def incr(self, key):
        self.store.data[key] = str(int(self.store.data.get(key) or 0) + 1)
        return self

    def expire(self, key, ttl):
        self.store.ttls[key] = ttl
        return self

    def execute(self):
        res = self.results
        self.results = []
        return res


class MockRedisStore:
    """A minimal in-memory stand-in for the real Redis client, used across
    both endpoints so a send followed by a verify in the same test behaves
    like it would against real Redis."""

    def __init__(self):
        self.data = {}
        self.ttls = {}

    def pipeline(self):
        return MockPipeline(self)

    def get(self, key):
        return self.data.get(key)

    def set(self, key, val, ex=None):
        self.data[key] = val
        self.ttls[key] = ex or -1

    def delete(self, key):
        self.data.pop(key, None)
        self.ttls.pop(key, None)

    def ttl(self, key):
        return self.ttls.get(key, -2)


@pytest.fixture(autouse=True)
def _configure_otp_secret():
    original = settings.WHATSAPP_OTP_SECRET
    settings.WHATSAPP_OTP_SECRET = "test-secret-do-not-use-in-production"
    yield
    settings.WHATSAPP_OTP_SECRET = original


@pytest.fixture
def auth_override():
    app.dependency_overrides[get_current_user] = lambda: make_user()
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def db_override():
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


def test_normalize_phone_adds_india_country_code():
    assert normalize_phone_to_whatsapp_format("9876543210") == "919876543210"


def test_normalize_phone_keeps_existing_country_code():
    assert normalize_phone_to_whatsapp_format("+919876543210") == "919876543210"
    assert normalize_phone_to_whatsapp_format("919876543210") == "919876543210"


def test_send_otp_success_stores_hash_not_plaintext(auth_override):
    mock_redis = MockRedisStore()
    with patch("app.api.auth.rate_limit_redis_client", mock_redis), \
         patch("app.api.auth.send_whatsapp_otp", new_callable=AsyncMock) as mock_send:
        res = client.post("/auth/whatsapp/send-otp", json={"phone_number": TEST_PHONE})

    assert res.status_code == 200
    assert res.json()["sent"] is True
    mock_send.assert_awaited_once()
    sent_code = mock_send.await_args.args[1]
    assert sent_code.isdigit() and len(sent_code) == 6

    stored = json.loads(mock_redis.data[f"wa_otp:{TEST_PHONE}"])
    assert stored["hash"] != sent_code
    expected_hash = hmac.new(
        settings.WHATSAPP_OTP_SECRET.encode(), sent_code.encode(), hashlib.sha256
    ).hexdigest()
    assert stored["hash"] == expected_hash
    assert stored["attempts"] == 0


def test_send_otp_requires_auth():
    mock_redis = MockRedisStore()
    with patch("app.api.auth.rate_limit_redis_client", mock_redis):
        res = client.post("/auth/whatsapp/send-otp", json={"phone_number": TEST_PHONE})
    assert res.status_code == 401


def test_send_otp_cooldown_blocks_resend(auth_override):
    mock_redis = MockRedisStore()
    mock_redis.ttls[f"wa_otp_cooldown:{TEST_PHONE}"] = 45
    with patch("app.api.auth.rate_limit_redis_client", mock_redis), \
         patch("app.api.auth.send_whatsapp_otp", new_callable=AsyncMock) as mock_send:
        res = client.post("/auth/whatsapp/send-otp", json={"phone_number": TEST_PHONE})

    assert res.status_code == 429
    assert "45 seconds" in res.json()["detail"]
    mock_send.assert_not_called()


def test_send_otp_hourly_cap_blocks(auth_override):
    mock_redis = MockRedisStore()
    mock_redis.data[f"wa_otp_count:{TEST_PHONE}"] = "5"
    mock_redis.ttls[f"wa_otp_count:{TEST_PHONE}"] = 1800
    with patch("app.api.auth.rate_limit_redis_client", mock_redis), \
         patch("app.api.auth.send_whatsapp_otp", new_callable=AsyncMock) as mock_send:
        res = client.post("/auth/whatsapp/send-otp", json={"phone_number": TEST_PHONE})

    assert res.status_code == 429
    mock_send.assert_not_called()


def test_send_otp_meta_failure_returns_502(auth_override):
    from app.services.whatsapp import WhatsAppSendError

    mock_redis = MockRedisStore()
    with patch("app.api.auth.rate_limit_redis_client", mock_redis), \
         patch("app.api.auth.send_whatsapp_otp", new_callable=AsyncMock) as mock_send:
        mock_send.side_effect = WhatsAppSendError("boom")
        res = client.post("/auth/whatsapp/send-otp", json={"phone_number": TEST_PHONE})

    assert res.status_code == 502
    # The record must not exist if sending failed -- nothing to verify against.
    assert f"wa_otp:{TEST_PHONE}" not in mock_redis.data


def test_verify_otp_correct_code_marks_phone_verified(auth_override, db_override):
    code = "123456"
    code_hash = hmac.new(settings.WHATSAPP_OTP_SECRET.encode(), code.encode(), hashlib.sha256).hexdigest()
    mock_redis = MockRedisStore()
    mock_redis.set(f"wa_otp:{TEST_PHONE}", json.dumps({"hash": code_hash, "attempts": 0}), ex=600)

    with patch("app.api.auth.rate_limit_redis_client", mock_redis):
        res = client.post("/auth/whatsapp/verify-otp", json={"phone_number": TEST_PHONE, "code": code})

    assert res.status_code == 200
    assert f"wa_otp:{TEST_PHONE}" not in mock_redis.data  # consumed on success
    db_override.commit.assert_called_once()


def test_verify_otp_wrong_code_increments_attempts(auth_override, db_override):
    code_hash = hmac.new(settings.WHATSAPP_OTP_SECRET.encode(), b"123456", hashlib.sha256).hexdigest()
    mock_redis = MockRedisStore()
    mock_redis.set(f"wa_otp:{TEST_PHONE}", json.dumps({"hash": code_hash, "attempts": 0}), ex=600)

    with patch("app.api.auth.rate_limit_redis_client", mock_redis):
        res = client.post("/auth/whatsapp/verify-otp", json={"phone_number": TEST_PHONE, "code": "000000"})

    assert res.status_code == 400
    stored = json.loads(mock_redis.data[f"wa_otp:{TEST_PHONE}"])
    assert stored["attempts"] == 1
    db_override.commit.assert_not_called()


def test_verify_otp_expired_or_missing_record(auth_override, db_override):
    mock_redis = MockRedisStore()  # nothing stored -- simulates expiry/never-requested
    with patch("app.api.auth.rate_limit_redis_client", mock_redis):
        res = client.post("/auth/whatsapp/verify-otp", json={"phone_number": TEST_PHONE, "code": "123456"})

    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


def test_verify_otp_too_many_attempts_rejected(auth_override, db_override):
    code_hash = hmac.new(settings.WHATSAPP_OTP_SECRET.encode(), b"123456", hashlib.sha256).hexdigest()
    mock_redis = MockRedisStore()
    mock_redis.set(f"wa_otp:{TEST_PHONE}", json.dumps({"hash": code_hash, "attempts": 5}), ex=600)

    with patch("app.api.auth.rate_limit_redis_client", mock_redis):
        res = client.post("/auth/whatsapp/verify-otp", json={"phone_number": TEST_PHONE, "code": "123456"})

    assert res.status_code == 429
    assert f"wa_otp:{TEST_PHONE}" not in mock_redis.data  # record cleared after lockout
