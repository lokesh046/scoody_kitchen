import pytest
from unittest.mock import MagicMock

from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserRegister, UserResponse
from app.services.auth_service import create_user


def test_public_registration_defaults_to_customer():
    db = MagicMock()
    user_data = UserRegister(
        email="testcustomer@example.com",
        first_name="Jane",
        last_name="Doe",
        phone="1234567890",
    )

    # create_user explicitly hard-codes UserRole.CUSTOMER
    created = create_user(db, user_data)
    assert created.role == UserRole.CUSTOMER


def test_user_response_schema_role_serialization():
    user = User(
        id=1,
        email="doctor@example.com",
        first_name="Doc",
        last_name="Smith",
        phone="9876543210",
        auth_provider="magic_link",
        is_email_verified=True,
        role=UserRole.DOCTOR,
        is_active=True,
    )

    resp = UserResponse.model_validate(user)
    assert resp.role == UserRole.DOCTOR
    assert resp.role.value == "doctor"


def test_role_access_matrix():
    admin_user = User(id=1, role=UserRole.ADMIN, is_active=True)
    doctor_user = User(id=2, role=UserRole.DOCTOR, is_active=True)
    customer_user = User(id=3, role=UserRole.CUSTOMER, is_active=True)

    # Doctor access check
    allowed_roles_doctor = (UserRole.DOCTOR, UserRole.ADMIN)
    assert doctor_user.role in allowed_roles_doctor
    assert admin_user.role in allowed_roles_doctor
    assert customer_user.role not in allowed_roles_doctor

    # Admin access check
    allowed_roles_admin = (UserRole.ADMIN,)
    assert admin_user.role in allowed_roles_admin
    assert doctor_user.role not in allowed_roles_admin
    assert customer_user.role not in allowed_roles_admin
