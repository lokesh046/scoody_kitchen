from unittest.mock import MagicMock, patch
import pytest

from app.models.enums import UserRole
from app.models.magic_link_token import MagicLinkToken
from app.models.user import User
from app.services.auth_service import (
    authenticate_google_user,
    request_magic_link,
    verify_magic_link_code,
    verify_magic_link_token,
)


def test_magic_link_request_and_token_verify_workflow():
    db = MagicMock()
    db.scalar.return_value = None

    # Request magic link (auto-creates user)
    sent = request_magic_link(db, "user@example.com", first_name="Alex")
    assert sent is True

    # Get created user and token from db.add calls
    added_objects = [call[0][0] for call in db.add.call_args_list]
    created_user = next(obj for obj in added_objects if isinstance(obj, User))
    created_token = next(obj for obj in added_objects if isinstance(obj, MagicLinkToken))

    assert created_user.email == "user@example.com"
    assert created_user.auth_provider == "magic_link"
    assert created_token.token_hash is not None
    assert created_token.code_hash is not None


@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_oidc_authentication_flow_verified(mock_verify):
    db = MagicMock()
    db.scalar.return_value = None

    mock_verify.return_value = {
        "email": "googleuser@gmail.com",
        "sub": "google_12345",
        "given_name": "Alice",
        "picture": "https://image.jpg",
    }

    with patch("app.core.config.settings.GOOGLE_CLIENT_ID", "mock_client_id"):
        user = authenticate_google_user(db, "valid_mock_token")

    assert user.email == "googleuser@gmail.com"
    assert user.auth_provider == "google"
    assert user.is_email_verified is True


def test_google_oidc_unverified_token_rejected():
    db = MagicMock()
    with patch("app.core.config.settings.GOOGLE_CLIENT_ID", "mock_client_id"):
        with patch("google.oauth2.id_token.verify_oauth2_token", side_effect=Exception("Invalid signature")):
            with pytest.raises(ValueError, match="Invalid Google ID token signature"):
                authenticate_google_user(db, "forged_unverified_jwt_token")


def test_otp_code_account_level_failed_attempt_throttling():
    db = MagicMock()
    user = User(id=1, email="test@example.com", is_active=True)
    token = MagicLinkToken(id=1, user_id=1, code_hash="different_hash", failed_attempts=4, used=False)

    db.scalar.side_effect = [user, token]

    # 5th failed attempt should trigger token invalidation
    with pytest.raises(ValueError, match="Too many failed attempts"):
        verify_magic_link_code(db, "test@example.com", "999999")

    assert token.failed_attempts == 5
    assert token.used is True


def test_cleanup_unverified_typo_users():
    from app.services.auth_service import cleanup_unverified_users

    db = MagicMock()
    typo_user_1 = User(id=101, email="typo1@gmaill.com", is_email_verified=False, auth_provider="magic_link")
    typo_user_2 = User(id=102, email="typo2@gmaill.com", is_email_verified=False, auth_provider="magic_link")
    db.scalars.return_value.all.return_value = [typo_user_1, typo_user_2]

    cleaned_count = cleanup_unverified_users(db, max_age_hours=24)
    assert cleaned_count == 2
    assert db.delete.call_count == 2
    assert db.commit.called
