"""The app-store review account: one email accepts a fixed 6-digit code and is sent no email."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core.security import hash_token
from app.services import auth_service
from app.services.auth_service import request_magic_link

REVIEW_EMAIL = "appreview@hearthandone.com"
REVIEW_CODE = "482913"


@pytest.fixture
def configured():
    with patch.object(auth_service.settings, "REVIEW_ACCOUNT_EMAIL", REVIEW_EMAIL), \
         patch.object(auth_service.settings, "REVIEW_ACCOUNT_CODE", REVIEW_CODE):
        yield


def _run(email):
    db = MagicMock()
    user = SimpleNamespace(id=7, is_active=True)
    with patch.object(auth_service, "get_user_by_email", return_value=user), \
         patch.object(auth_service, "send_magic_link_email", return_value=True) as send:
        result = request_magic_link(db, email)
    stored = db.add.call_args[0][0]
    return result, send, stored


def test_review_account_gets_the_fixed_code_and_no_email(configured):
    result, send, stored = _run("AppReview@HearthAndOne.com")  # case does not matter
    assert result is True
    send.assert_not_called()
    assert stored.code_hash == hash_token(REVIEW_CODE)


def test_every_other_email_still_gets_a_random_code_by_email(configured):
    result, send, stored = _run("customer@example.com")
    assert result is True
    send.assert_called_once()
    emailed_code = send.call_args.kwargs["otp_code"]
    assert len(emailed_code) == 6 and emailed_code.isdigit()
    assert stored.code_hash == hash_token(emailed_code)


def test_off_when_nothing_is_configured():
    with patch.object(auth_service.settings, "REVIEW_ACCOUNT_EMAIL", ""), \
         patch.object(auth_service.settings, "REVIEW_ACCOUNT_CODE", ""):
        _, send, _ = _run(REVIEW_EMAIL)
    send.assert_called_once()


@pytest.mark.parametrize("bad_code", ["12345", "1234567", "abcdef", "12 456", ""])
def test_off_unless_the_code_is_exactly_six_digits(bad_code):
    with patch.object(auth_service.settings, "REVIEW_ACCOUNT_EMAIL", REVIEW_EMAIL), \
         patch.object(auth_service.settings, "REVIEW_ACCOUNT_CODE", bad_code):
        _, send, _ = _run(REVIEW_EMAIL)
    send.assert_called_once()


def test_off_when_only_the_email_is_set():
    with patch.object(auth_service.settings, "REVIEW_ACCOUNT_EMAIL", REVIEW_EMAIL), \
         patch.object(auth_service.settings, "REVIEW_ACCOUNT_CODE", ""):
        _, send, _ = _run(REVIEW_EMAIL)
    send.assert_called_once()


def _verify(email, user_email):
    """Run verify_magic_link_code with a valid stored code for the given user."""
    user = SimpleNamespace(id=7, email=user_email, is_email_verified=False, is_phone_verified=False)
    record = SimpleNamespace(code_hash=hash_token(REVIEW_CODE), failed_attempts=0, used=False)
    db = MagicMock()
    db.scalar.return_value = record
    with patch.object(auth_service, "get_user_by_email", return_value=user):
        auth_service.verify_magic_link_code(db, email, REVIEW_CODE)
    return user


def test_review_account_skips_the_phone_verification_screen(configured):
    user = _verify(REVIEW_EMAIL, REVIEW_EMAIL)
    assert user.is_email_verified is True
    assert user.is_phone_verified is True


def test_other_users_still_have_to_verify_their_phone(configured):
    user = _verify("customer@example.com", "customer@example.com")
    assert user.is_email_verified is True
    assert user.is_phone_verified is False
