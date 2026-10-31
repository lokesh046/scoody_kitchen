import hashlib
import time
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.models.enums import UserRole
from app.models.user import User
from app.services import auth_service
from app.services.auth_service import authenticate_apple_user

BUNDLE = "com.scooby.kitchen"
_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _token(key=_KEY, **overrides):
    now = int(time.time())
    claims = {"iss": "https://appleid.apple.com", "aud": BUNDLE, "sub": "001234.abc", "iat": now, "exp": now + 600,
              "email": "Asha@Example.com", "email_verified": "true"}
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})


@pytest.fixture(autouse=True)
def apple_keys():
    jwks = SimpleNamespace(get_signing_key_from_jwt=lambda _t: SimpleNamespace(key=_KEY.public_key()))
    with patch.object(auth_service, "_get_apple_jwks_client", return_value=jwks), \
         patch.object(auth_service.settings, "APPLE_CLIENT_IDS", [BUNDLE]):
        yield


def _db(*lookups):
    """db.scalar answers, in order: lookup by Apple id, then by email (as the service asks)."""
    db = MagicMock()
    db.scalar.side_effect = list(lookups)
    return db


def test_new_person_is_signed_up_with_apple_details():
    db = _db(None, None, None)
    user = authenticate_apple_user(db, _token(), first_name="Asha", last_name="Rao")
    assert user.email == "asha@example.com" and user.auth_provider == "apple"
    assert user.oauth_sub == "001234.abc" and user.first_name == "Asha" and user.role == UserRole.CUSTOMER
    assert user.is_email_verified is True
    db.add.assert_called_once()


def test_returning_apple_user_is_found_by_apple_id_even_with_a_relay_email():
    existing = User(id=5, email="x@privaterelay.appleid.com", auth_provider="apple", oauth_sub="001234.abc", is_active=True)
    db = _db(existing)
    user = authenticate_apple_user(db, _token(email="other@privaterelay.appleid.com"))
    assert user is existing
    db.add.assert_not_called()


def test_existing_email_account_is_linked_only_when_apple_vouches_for_the_email():
    existing = User(id=9, email="asha@example.com", auth_provider="magic_link", oauth_sub=None, is_active=True)
    user = authenticate_apple_user(_db(None, existing), _token())
    assert user is existing and existing.oauth_sub == "001234.abc" and existing.auth_provider == "magic_link"

    # Not verified: must not take over the existing account.
    unverified = _db(None, User(id=9, email="asha@example.com", is_active=True))
    with pytest.raises(ValueError, match="already exists"):
        authenticate_apple_user(unverified, _token(email_verified="false"))


@pytest.mark.parametrize("bad", [
    {"aud": "com.someone.else"},
    {"iss": "https://evil.example.com"},
    {"exp": int(time.time()) - 60},
])
def test_wrong_audience_issuer_or_expired_token_is_rejected(bad):
    with pytest.raises(ValueError, match="Invalid Apple identity token"):
        authenticate_apple_user(_db(None), _token(**bad))


def test_token_signed_with_someone_elses_key_is_rejected():
    with pytest.raises(ValueError, match="Invalid Apple identity token"):
        authenticate_apple_user(_db(None), _token(key=_OTHER_KEY))


def test_nonce_must_match_when_the_token_carries_one():
    raw = "random-nonce-123"
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    authenticate_apple_user(_db(None, None, None), _token(nonce=hashed), nonce=raw)      # hashed form
    authenticate_apple_user(_db(None, None, None), _token(nonce=raw), nonce=raw)         # plain form
    for supplied in (None, "different"):
        with pytest.raises(ValueError, match="nonce"):
            authenticate_apple_user(_db(None), _token(nonce=hashed), nonce=supplied)


def test_new_person_without_a_shared_email_gets_a_clear_message():
    with pytest.raises(ValueError, match="did not share an email"):
        authenticate_apple_user(_db(None), _token(email=None))


def test_inactive_account_cannot_sign_in():
    existing = User(id=5, email="a@b.com", auth_provider="apple", oauth_sub="001234.abc", is_active=False)
    with pytest.raises(ValueError, match="inactive"):
        authenticate_apple_user(_db(existing), _token())


def test_not_configured_server_refuses():
    with patch.object(auth_service.settings, "APPLE_CLIENT_IDS", []):
        with pytest.raises(ValueError, match="not configured"):
            authenticate_apple_user(_db(), _token())
