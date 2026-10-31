import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.models.enums import UserRole
from app.models.user import User
from app.services import account_deletion_service as svc
from app.services.auth_service import create_tokens


def _user(role=UserRole.CUSTOMER, **kw):
    u = User(id=7, email="pet.parent@example.com", first_name="Asha", role=role, auth_provider="google", is_active=True)
    u.password_hash = "secret-hash"
    for k, v in kw.items():
        setattr(u, k, v)
    return u


def _db(open_orders=0, open_consults=0):
    db = MagicMock()
    db.query.return_value.filter.return_value.count.side_effect = [open_orders, open_consults]
    return db


def test_doctor_and_admin_accounts_cannot_self_delete():
    for role in (UserRole.DOCTOR, UserRole.ADMIN):
        with pytest.raises(svc.DeletionNotAllowed):
            svc.request_deletion(_db(), _user(role=role))


def test_open_order_blocks_deletion():
    with pytest.raises(svc.DeletionNotAllowed, match="order"):
        svc.request_deletion(_db(open_orders=1), _user())


def test_open_consultation_blocks_deletion():
    with pytest.raises(svc.DeletionNotAllowed, match="consultation"):
        svc.request_deletion(_db(open_consults=1), _user())


def test_request_schedules_purge_after_grace_period_and_signs_out():
    db, user = _db(), _user()
    before = datetime.now(timezone.utc)
    purge_on = svc.request_deletion(db, user)
    assert timedelta(days=14, hours=23) < purge_on - before < timedelta(days=15, minutes=1)
    assert user.deletion_scheduled_for == purge_on and user.deletion_requested_at is not None
    assert user.is_active is True  # kept active so signing in can cancel
    db.commit.assert_called()


def test_cancel_clears_pending_deletion_but_not_a_finished_one():
    user = _user(deletion_requested_at=datetime.now(timezone.utc), deletion_scheduled_for=datetime.now(timezone.utc))
    assert svc.cancel_pending_deletion(MagicMock(), user) is True
    assert user.deletion_scheduled_for is None and user.deletion_requested_at is None

    done = _user(deleted_at=datetime.now(timezone.utc), deletion_scheduled_for=datetime.now(timezone.utc))
    assert svc.cancel_pending_deletion(MagicMock(), done) is False


def test_sign_in_cancels_deletion_but_token_refresh_does_not():
    pending = datetime.now(timezone.utc) + timedelta(days=10)
    user = _user(deletion_scheduled_for=pending)
    with patch("app.services.account_deletion_service.cancel_pending_deletion") as cancel:
        create_tokens(MagicMock(), user, cancels_deletion=False)
        cancel.assert_not_called()
        create_tokens(MagicMock(), user)
        cancel.assert_called_once()


def test_purge_refuses_to_delete_anything_without_an_archive_key():
    db = MagicMock()
    with patch.object(svc.settings, "ACCOUNT_ARCHIVE_KEY", ""):
        assert svc.purge_due_accounts(db) == 0
    db.query.assert_not_called()


def test_snapshot_never_contains_the_password_hash():
    snap = svc.build_snapshot(MagicMock(), _user())
    assert "password_hash" not in json.dumps(snap, default=str)
    assert snap["user"]["email"] == "pet.parent@example.com"


def test_archive_is_encrypted_and_readable_only_with_the_key():
    key = Fernet.generate_key().decode()
    db, user = MagicMock(), _user(phone="+919999999999")
    with patch.object(svc.settings, "ACCOUNT_ARCHIVE_KEY", key):
        svc._write_archive(db, user)
        archive = db.add.call_args[0][0]
        assert b"pet.parent@example.com" not in archive.payload
        assert svc.read_archive(archive)["user"]["phone"] == "+919999999999"
        assert archive.expires_at - datetime.now(timezone.utc) < timedelta(days=svc.settings.ACCOUNT_ARCHIVE_MAX_DAYS, minutes=1)
    with patch.object(svc.settings, "ACCOUNT_ARCHIVE_KEY", Fernet.generate_key().decode()):
        with pytest.raises(Exception):
            svc.read_archive(archive)


def test_deleting_an_account_needs_a_recent_sign_in():
    from app.api.auth import _require_recent_sign_in
    import jwt as pyjwt
    from app.core.config import settings

    def req(iat):
        payload = {"sub": "7", "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}
        if iat is not None:
            payload["iat"] = iat
        r = MagicMock()
        r.cookies = {}
        r.headers = {"Authorization": "Bearer " + pyjwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)}
        return r

    now = datetime.now(timezone.utc)
    _require_recent_sign_in(req(now - timedelta(minutes=2)))  # fine
    for stale in (now - timedelta(minutes=30), None):
        with pytest.raises(HTTPException) as exc:
            _require_recent_sign_in(req(stale))
        assert exc.value.status_code == 403
