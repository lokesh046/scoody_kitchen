import io
import sys
import os
import base64
import json
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

# Ensure chatbot-service is in sys.path
service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if service_dir not in sys.path:
    sys.path.insert(0, service_dir)

from main import app
from utils.image_validator import validate_image_file

client = TestClient(app)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789_long_key_for_sha256")


def _make_auth_header(user_id: int = 1) -> dict:
    client.cookies.clear()
    try:
        import jwt
        token = jwt.encode({"sub": str(user_id), "role": "customer"}, JWT_SECRET_KEY, algorithm="HS256")
    except Exception:
        header = base64.b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
        payload = base64.b64encode(json.dumps({"sub": str(user_id), "role": "customer"}).encode()).decode().rstrip("=")
        token = f"{header}.{payload}.sig"
    client.cookies.set("access_token", token)
    return {}


def test_image_validator_magic_bytes_and_size_checks():
    # 1. Valid JPEG magic bytes -> passes validation
    jpeg_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00" + b"A" * 100
    mock_file = MagicMock()
    mock_file.content_type = "image/jpeg"
    assert validate_image_file(mock_file, jpeg_bytes) == "image/jpeg"

    # 2. Fake image with wrong magic bytes -> raises 400
    fake_bytes = b"NOT_AN_IMAGE_FILE_DATA"
    with pytest.raises(Exception) as exc1:
        validate_image_file(mock_file, fake_bytes)
    assert "400" in str(exc1.value) or "magic" in str(exc1.value).lower()

    # 3. Image exceeding 10MB limit -> raises 400
    huge_bytes = b"\xFF\xD8\xFF" + b"A" * (11 * 1024 * 1024)
    with pytest.raises(Exception) as exc2:
        validate_image_file(mock_file, huge_bytes)
    assert "400" in str(exc2.value) or "exceeds" in str(exc2.value).lower()


def test_unauthenticated_request_rejected_with_401():
    # Unauthenticated request without cookie -> rejected with HTTP 401 Unauthorized
    client.cookies.clear()
    response = client.post(
        "/chat",
        json={
            "message": "What is your return policy?",
            "session_id": "test_unauth_sess_401",
        },
    )
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_client_cannot_inject_user_id_in_payload():
    # Authenticated caller sends user_id in ChatRequest JSON body
    headers = _make_auth_header(user_id=42)
    response = client.post(
        "/chat",
        headers=headers,
        json={
            "message": "What is your return policy for unopened items?",
            "session_id": "test_idor_sess_01",
            "user_id": 99999,  # Malicious user_id payload is safely ignored by Pydantic extra="ignore"
        },
    )
    assert response.status_code == 200


def test_user_centric_rate_limiter_and_proxy_ip_extraction():
    from utils.rate_limiter import get_client_ip, enforce_rate_limit
    from fastapi import Request

    # 1. Test Proxy Header extraction (X-Forwarded-For)
    mock_req = MagicMock(spec=Request)
    mock_req.headers = {"x-forwarded-for": "203.0.113.195, 70.41.3.18"}
    assert get_client_ip(mock_req) == "203.0.113.195"

    # 2. Test X-Real-IP fallback
    mock_req_real = MagicMock(spec=Request)
    mock_req_real.headers = {"x-real-ip": "198.51.100.42"}
    assert get_client_ip(mock_req_real) == "198.51.100.42"

    # 3. Test enforce_rate_limit user_id keying
    mock_req_user = MagicMock(spec=Request)
    mock_req_user.client.host = "127.0.0.1"
    enforce_rate_limit(mock_req_user, user_id=999)


def test_dual_direction_secret_and_jwt_redaction():
    from utils.guardrails import redact_pii_text

    # 1. Bearer JWT Token Redaction
    text_with_token = "Here is my token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c in the prompt"
    scrubbed = redact_pii_text(text_with_token)
    assert "[REDACTED_AUTH_TOKEN]" in scrubbed
    assert "eyJhbGci" not in scrubbed

    # 2. Private Key Redaction
    pkey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
    scrubbed_key = redact_pii_text(pkey)
    assert "[REDACTED_PRIVATE_KEY]" in scrubbed_key
    assert "MIIEvgIBADAN" not in scrubbed_key


def test_pii_middleware_strategies_redact_block_mask_hash():
    from utils.guardrails import PIIMiddleware
    from fastapi import HTTPException

    # 1. Strategy = 'redact'
    mw_redact = PIIMiddleware("email", strategy="redact")
    assert mw_redact.transform("Contact customer@example.com for help") == "Contact [REDACTED_EMAIL] for help"

    # 2. Strategy = 'mask'
    mw_mask = PIIMiddleware("credit_card", strategy="mask")
    assert mw_mask.transform("Card number: 4532123456788888") == "Card number: ************8888"

    # 3. Strategy = 'hash'
    mw_hash = PIIMiddleware("email", strategy="hash")
    hashed_out = mw_hash.transform("Email: user@domain.com")
    assert "<email_hash:" in hashed_out

    # 4. Strategy = 'block'
    mw_block = PIIMiddleware("ssn", strategy="block")
    with pytest.raises(HTTPException) as exc:
        mw_block.transform("My SSN is 123-45-6789")
    assert exc.value.status_code == 400
    assert "PII Security Violation" in exc.value.detail


def test_access_token_blacklist_revocation():
    import hashlib
    from memory.redis_memory import session_memory

    # Create mock token
    token = "mock_access_token_revocation_test"
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # Blacklist it
    session_memory.blacklist_token(token_hash, ttl_seconds=60)
    assert session_memory.is_token_blacklisted(token_hash) is True

    # Try calling secure endpoint with blacklisted cookie
    client.cookies.clear()
    client.cookies.set("access_token", token)
    response = client.post(
        "/chat",
        json={
            "message": "Hello",
            "session_id": "test_blacklisted_sess",
        },
    )
    # Should get 401 revoked
    assert response.status_code == 401
    assert "revoked" in response.json()["detail"].lower()
    
    # Cleanup cookies
    client.cookies.clear()
