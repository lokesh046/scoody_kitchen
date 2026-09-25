from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class MockRedisPipeline:
    def __init__(self, parent):
        self.parent = parent
        self.commands = []
        self.results = []

    def ttl(self, key):
        if "otp_cooldown" in key:
            self.results.append(self.parent.cooldown_ttl)
        elif "otp_count" in key:
            self.results.append(self.parent.phone_ttl)
        elif "otp_ip_count" in key:
            self.results.append(self.parent.ip_ttl)
        return self

    def get(self, key):
        if "otp_cooldown" in key:
            self.results.append("1" if self.parent.cooldown_ttl > 0 else None)
        elif "otp_count" in key:
            self.results.append(str(self.parent.phone_count) if self.parent.phone_count is not None else None)
        elif "otp_ip_count" in key:
            self.results.append(str(self.parent.ip_count) if self.parent.ip_count is not None else None)
        return self

    def set(self, key, val, ex=None):
        return self

    def incr(self, key):
        return self

    def expire(self, key, ttl):
        return self

    def execute(self):
        res = self.results
        self.results = []
        return res


class MockRedisClient:
    def __init__(self):
        self.cooldown_ttl = -2
        self.phone_count = None
        self.phone_ttl = -2
        self.ip_count = None
        self.ip_ttl = -2

    def pipeline(self):
        return MockRedisPipeline(self)


def test_otp_rate_limiting_allowed():
    mock_redis = MockRedisClient()

    # Case 1: First request should be allowed
    with patch("app.api.auth.rate_limit_redis_client", mock_redis):
        res = client.post("/auth/request-otp", json={"phone_number": "+919876543210"})
        assert res.status_code == 200
        assert res.json()["allowed"] is True
        assert res.json()["attempts_remaining"] == 2


def test_otp_rate_limiting_cooldown():
    mock_redis = MockRedisClient()
    mock_redis.cooldown_ttl = 24  # Simulate active cooldown of 24 seconds

    # Case 2: Cooldown active should trigger 429
    with patch("app.api.auth.rate_limit_redis_client", mock_redis):
        res = client.post("/auth/request-otp", json={"phone_number": "+919876543210"})
        assert res.status_code == 429
        assert "Please wait 24 seconds" in res.json()["detail"]


def test_otp_rate_limiting_hourly_cap():
    mock_redis = MockRedisClient()
    mock_redis.phone_count = 3  # Hit the limit of 3
    mock_redis.phone_ttl = 2520  # 42 minutes remaining

    # Case 3: Hourly cap reached should trigger 429
    with patch("app.api.auth.rate_limit_redis_client", mock_redis):
        res = client.post("/auth/request-otp", json={"phone_number": "+919876543210"})
        assert res.status_code == 429
        assert "Too many attempts for this number. Try again in 42 minutes." in res.json()["detail"]


def test_otp_invalid_phone_format():
    # Case 4: Invalid phone number E.164 validation should trigger 422
    res = client.post("/auth/request-otp", json={"phone_number": "12345"})
    assert res.status_code == 422
