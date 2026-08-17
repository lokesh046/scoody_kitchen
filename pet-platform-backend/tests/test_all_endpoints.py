import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.dependencies.auth import get_current_user
from app.core.database import get_db


client = TestClient(app)


def test_system_health_endpoints():
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert "running" in res_root.json()["message"].lower()

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["Status"] == "healthy"


def test_public_doctor_discovery_endpoints():
    res_nearby = client.get("/doctors/nearby?latitude=13.0827&longitude=80.2707&radius_km=10")
    assert res_nearby.status_code == 200
    assert isinstance(res_nearby.json(), list)


def test_role_authorized_endpoints_security():
    # Unauthenticated requests should be rejected with 401
    res_me = client.get("/auth/me")
    assert res_me.status_code == 401

    res_admin_test = client.get("/admin/test")
    assert res_admin_test.status_code == 401

    res_doctor_test = client.get("/doctor/test")
    assert res_doctor_test.status_code == 401

    res_doctor_me = client.get("/doctor/me")
    assert res_doctor_me.status_code == 401


def test_customer_access_control_rules():
    customer_user = User(id=999, email="cust@test.com", role=UserRole.CUSTOMER, is_active=True)
    app.dependency_overrides[get_current_user] = lambda: customer_user

    try:
        # Customer trying to access Admin endpoint -> 403 Forbidden
        res_admin = client.get("/admin/test")
        assert res_admin.status_code == 403

        # Customer trying to access Doctor endpoint -> 403 Forbidden
        res_doc = client.get("/doctor/test")
        assert res_doc.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_admin_access_control_rules():
    admin_user = User(id=1, email="admin@test.com", role=UserRole.ADMIN, is_active=True)
    app.dependency_overrides[get_current_user] = lambda: admin_user

    try:
        # Admin access to admin test endpoint -> 200 OK
        res_admin = client.get("/admin/test")
        assert res_admin.status_code == 200
        assert res_admin.json()["role"] == "admin"

        # Admin access to doctor test endpoint -> 200 OK
        res_doc = client.get("/doctor/test")
        assert res_doc.status_code == 200
        assert res_doc.json()["role"] == "admin"
    finally:
        app.dependency_overrides.clear()


def test_internal_service_jwt_authentication():
    import jwt
    from datetime import datetime, timezone, timedelta
    from app.core.config import settings

    # 1. No header -> 422 Unprocessable (since X-Internal-Api-Key header is required)
    res = client.get("/internal/products/search?search=Food")
    assert res.status_code in (401, 422)

    # 2. Invalid header -> 401 Unauthorized
    res = client.get(
        "/internal/products/search?search=Food",
        headers={"X-Internal-Api-Key": "invalid-token-string"}
    )
    assert res.status_code == 401

    # 3. Valid short-lived JWT -> 200 OK
    payload = {
        "iss": "pet-platform-mcp-server",
        "exp": datetime.now(timezone.utc) + timedelta(seconds=60)
    }
    token = jwt.encode(payload, settings.INTERNAL_SERVICE_API_KEY, algorithm="HS256")
    
    res = client.get(
        "/internal/products/search?search=Food",
        headers={"X-Internal-Api-Key": token}
    )
    assert res.status_code == 200
    assert "products" in res.json()
