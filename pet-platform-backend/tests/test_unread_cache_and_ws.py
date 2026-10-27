import asyncio
from unittest.mock import MagicMock

import jwt

from app.core.cache import cache
from app.core.config import settings
from app.services import notification_service as ns


def _db_returning(count):
    db = MagicMock()
    db.scalar.return_value = count
    return db


def setup_function(_):
    cache.clear_prefix("notif:unread:")


def test_unread_count_hits_database_once_then_cache():
    db = _db_returning(3)
    assert ns.get_unread_notifications_count(db, 901) == 3
    assert ns.get_unread_notifications_count(db, 901) == 3
    assert ns.get_unread_notifications_count(db, 901) == 3
    assert db.scalar.call_count == 1


def test_zero_unread_is_cached_too():
    db = _db_returning(0)
    assert ns.get_unread_notifications_count(db, 902) == 0
    assert ns.get_unread_notifications_count(db, 902) == 0
    assert db.scalar.call_count == 1


def test_counts_are_per_user():
    assert ns.get_unread_notifications_count(_db_returning(1), 903) == 1
    assert ns.get_unread_notifications_count(_db_returning(7), 904) == 7


def test_mark_all_read_clears_cached_count():
    db = _db_returning(5)
    assert ns.get_unread_notifications_count(db, 905) == 5
    db.execute.return_value = MagicMock(rowcount=5)
    ns.mark_all_read(db, 905)
    db.scalar.return_value = 0
    assert ns.get_unread_notifications_count(db, 905) == 0


def test_creating_a_notification_clears_cached_count(monkeypatch):
    monkeypatch.setattr(ns, "get_push_tokens_for_user", lambda db, uid: [])
    monkeypatch.setattr(ns, "publish_notification_sync", lambda *a, **k: None)
    db = _db_returning(2)
    assert ns.get_unread_notifications_count(db, 906) == 2
    ns.create_notification(db, 906, "t", "m")
    db.scalar.return_value = 3
    assert ns.get_unread_notifications_count(db, 906) == 3


def _token(sub, token_type="access", secret=None):
    return jwt.encode({"sub": str(sub), "type": token_type}, secret or settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def test_websocket_token_valid_returns_user_id_without_database():
    from app.api.notification import get_websocket_user_id
    assert asyncio.run(get_websocket_user_id(_token(42))) == 42


def test_websocket_rejects_missing_wrong_type_and_bad_signature():
    from app.api.notification import get_websocket_user_id
    assert asyncio.run(get_websocket_user_id(None)) is None
    assert asyncio.run(get_websocket_user_id(_token(42, "refresh"))) is None
    assert asyncio.run(get_websocket_user_id(_token(42, secret="not-the-secret-not-the-secret-123456"))) is None
    assert asyncio.run(get_websocket_user_id("garbage")) is None


def test_websocket_rejects_revoked_token():
    from app.api.notification import get_websocket_user_id
    from app.core.security import hash_token
    token = _token(43)
    cache.set(f"blacklist:access:{hash_token(token)}", "revoked", ttl_seconds=60)
    assert asyncio.run(get_websocket_user_id(token)) is None
