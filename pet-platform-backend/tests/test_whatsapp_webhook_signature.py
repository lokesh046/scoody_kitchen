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
