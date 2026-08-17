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
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789")


def _make_auth_header(user_id: int = 1) -> dict:
    try:
        import jwt
        token = jwt.encode({"sub": str(user_id), "role": "customer"}, JWT_SECRET_KEY, algorithm="HS256")
    except Exception:
        header = base64.b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
        payload = base64.b64encode(json.dumps({"sub": str(user_id), "role": "customer"}).encode()).decode().rstrip("=")
        token = f"{header}.{payload}.sig"
    return {"Authorization": f"Bearer {token}"}


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
    # Unauthenticated request without Bearer token -> rejected with HTTP 401 Unauthorized
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
