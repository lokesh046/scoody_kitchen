import hashlib
import hmac

from app.core.config import settings
from app.services.whatsapp_service import verify_webhook_signature


def test_missing_app_secret_rejects_everything(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", None)
    assert verify_webhook_signature(b"{}", None) is False
    assert verify_webhook_signature(b"{}", "sha256=abc") is False


def test_valid_signature_accepted_and_bad_one_rejected(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", "topsecret")
    body = b'{"entry":[]}'
    good = "sha256=" + hmac.new(b"topsecret", body, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(body, good) is True
    assert verify_webhook_signature(body, "sha256=" + "0" * 64) is False
    assert verify_webhook_signature(body, None) is False


def test_changing_phone_through_profile_update_unverifies_it():
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from app.schemas.auth import UserUpdate
    from app.services.auth_service import update_user_profile

    db = MagicMock()
    user = SimpleNamespace(first_name="A", last_name="B", phone="+919876543210", is_phone_verified=True, profile_image_url=None)

    update_user_profile(db, user, UserUpdate(phone="+919876543210"))  # same number, other format of it
    assert user.is_phone_verified is True

    update_user_profile(db, user, UserUpdate(phone="+919999999999"))  # a different number
    assert user.is_phone_verified is False
    assert user.phone == "+919999999999"
