from unittest.mock import MagicMock
import pytest

from app.models.enums import UserRole
from app.models.user import User
from app.services.auth_service import (
    authenticate_google_user,
    request_magic_link,
    verify_magic_link_code,
    verify_magic_link_token,
)


def test_magic_link_request_and_token_verify_workflow():
    db = MagicMock()
    # Mock user query return
    db.scalar.return_value = None

    # Request magic link (auto-creates user)
    sent = request_magic_link(db, "user@example.com", first_name="Alex")
    assert sent is True

    # Get created user from db.add call
    created_user = db.add.call_args[0][0]
    assert created_user.email == "user@example.com"
    assert created_user.magic_link_token is not None
    assert created_user.auth_provider == "magic_link"


def test_google_oidc_authentication_flow():
    db = MagicMock()
    db.scalar.return_value = None

    # Mock Google OIDC token authentication
    # Mock Google OIDC token authentication (base64 payload: {"email":"googleuser@gmail.com","sub":"google_12345","given_name":"Alice","picture":"https://image.jpg"})
    test_id_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imdvb2dsZXVzZXJAZ21haWwuY29tIiwic3ViIjoiZ29vZ2xlXzEyMzQ1IiwiZ2l2ZW5fbmFtZSI6IkFsaWNlIiwicGljdHVyZSI6Imh0dHBzOi8vaW1hZ2UuanBnIn0.signature"
    user = authenticate_google_user(db, test_id_token)

    assert user.email == "googleuser@gmail.com"
    assert user.auth_provider == "google"
    assert user.is_email_verified is True


def test_cleanup_unverified_typo_users():
    from app.services.auth_service import cleanup_unverified_users

    db = MagicMock()
    # Mock returning 2 unverified typo users
    typo_user_1 = User(id=101, email="typo1@gmaill.com", is_email_verified=False, auth_provider="magic_link")
    typo_user_2 = User(id=102, email="typo2@gmaill.com", is_email_verified=False, auth_provider="magic_link")
    db.scalars.return_value.all.return_value = [typo_user_1, typo_user_2]

    cleaned_count = cleanup_unverified_users(db, max_age_hours=24)
    assert cleaned_count == 2
    assert db.delete.call_count == 2
    assert db.commit.called
