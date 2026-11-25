from unittest.mock import MagicMock, patch
import pytest

from app.core.security import hash_token
from app.models.enums import UserRole
from app.models.magic_link_token import MagicLinkToken
from app.models.user import User
from app.services.auth_service import (
    authenticate_google_user,
    request_magic_link,
    verify_magic_link_code,
    verify_magic_link_token,
)


def test_magic_link_request_defers_user_creation_until_verified():
    db = MagicMock()
    db.scalar.return_value = None  # no existing account for this email yet

    sent = request_magic_link(db, "user@example.com", first_name="Alex")
    assert sent is True

    # A brand-new email gets only a pending token -- no `user` row until it's verified.
    added_objects = [call[0][0] for call in db.add.call_args_list]
    assert not any(isinstance(obj, User) for obj in added_objects)
    created_token = next(obj for obj in added_objects if isinstance(obj, MagicLinkToken))

    assert created_token.user_id is None
    assert created_token.email == "user@example.com"
    assert created_token.pending_first_name == "Alex"
    assert created_token.token_hash is not None
    assert created_token.code_hash is not None


def test_magic_link_request_for_existing_user_reuses_account():
    db = MagicMock()
    existing_user = User(id=9, email="returning@example.com", is_active=True)
    db.scalar.return_value = existing_user

    sent = request_magic_link(db, "returning@example.com")
    assert sent is True

    added_objects = [call[0][0] for call in db.add.call_args_list]
    assert not any(isinstance(obj, User) for obj in added_objects)
    created_token = next(obj for obj in added_objects if isinstance(obj, MagicLinkToken))
    assert created_token.user_id == 9
    assert created_token.email is None


def test_verify_magic_link_code_creates_user_for_first_time_pending_signup():
    db = MagicMock()
    pending_token = MagicLinkToken(
        id=7,
        user_id=None,
        email="newuser@example.com",
        pending_first_name="Nova",
        pending_last_name=None,
        code_hash=hash_token("123456"),
        failed_attempts=0,
        used=False,
    )
    # 1st db.scalar: get_user_by_email (no account yet) -> None
    # 2nd: the pending-token lookup by email -> pending_token
    # 3rd: inside _resolve_user_for_token, re-check for a race-created account -> None
    db.scalar.side_effect = [None, pending_token, None]

    user = verify_magic_link_code(db, "newuser@example.com", "123456")

    assert pending_token.used is True
    assert user.email == "newuser@example.com"
    assert user.first_name == "Nova"
    assert user.auth_provider == "magic_link"
    assert user.is_email_verified is True
    assert any(isinstance(call[0][0], User) for call in db.add.call_args_list)


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
    """Legacy ghost `user` rows (pre-dating deferred user creation) still get swept."""
    from app.services.auth_service import cleanup_unverified_users

    db = MagicMock()
    typo_user_1 = User(id=101, email="typo1@gmaill.com", is_email_verified=False, auth_provider="magic_link")
    typo_user_2 = User(id=102, email="typo2@gmaill.com", is_email_verified=False, auth_provider="magic_link")

    users_result, tokens_result = MagicMock(), MagicMock()
    users_result.all.return_value = [typo_user_1, typo_user_2]
    tokens_result.all.return_value = []
    db.scalars.side_effect = [users_result, tokens_result]

    cleaned_count = cleanup_unverified_users(db, max_age_hours=24)
    assert cleaned_count == 2
    assert db.delete.call_count == 2
    assert db.commit.called


def test_cleanup_stale_pending_signup_tokens():
    """A never-verified brand-new signup leaves no `user` row -- just a stale token to sweep."""
    from app.services.auth_service import cleanup_unverified_users

    db = MagicMock()
    stale_token = MagicLinkToken(id=5, user_id=None, email="neververified@example.com", used=False)

    users_result, tokens_result = MagicMock(), MagicMock()
    users_result.all.return_value = []
    tokens_result.all.return_value = [stale_token]
    db.scalars.side_effect = [users_result, tokens_result]

    cleaned_count = cleanup_unverified_users(db, max_age_hours=24)
    assert cleaned_count == 1
    assert db.delete.call_count == 1
    assert db.commit.called


@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_oidc_multiple_client_ids(mock_verify):
    db = MagicMock()
    db.scalar.return_value = None

    mock_verify.return_value = {
        "email": "googleuser@gmail.com",
        "sub": "google_12345",
        "given_name": "Alice",
        "picture": "https://image.jpg",
    }

    with patch("app.core.config.settings.GOOGLE_CLIENT_ID", "web_client_id"):
        with patch("app.core.config.settings.GOOGLE_CLIENT_IDS", ["ios_client_id", "android_client_id"]):
            user = authenticate_google_user(db, "valid_mock_token")

    assert user.email == "googleuser@gmail.com"
    mock_verify.assert_called_once_with(
        "valid_mock_token",
        mock_verify.call_args[0][1],
        ["web_client_id", "ios_client_id", "android_client_id"]
    )

