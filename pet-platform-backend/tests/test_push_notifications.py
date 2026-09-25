import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.dependencies.auth import get_current_user
from app.main import app
from app.models.enums import UserRole
from app.models.push_token import PushToken
from app.models.user import User
from app.services.push_token_service import (
    delete_push_token,
    get_push_tokens_for_user,
    register_push_token,
)

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_user(db_session, email: str) -> User:
    existing = db_session.scalar(select(User).where(User.email == email))
    if existing:
        db_session.execute(PushToken.__table__.delete().where(PushToken.user_id == existing.id))
        db_session.delete(existing)
        db_session.commit()

    user = User(
        email=email,
        first_name="Push",
        last_name="Test",
        phone=f"+9198760{hash(email) % 100000:05d}",
        role=UserRole.CUSTOMER,
        auth_provider="magic_link",
        is_email_verified=True,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _cleanup(db_session, *users: User) -> None:
    for user in users:
        db_session.execute(PushToken.__table__.delete().where(PushToken.user_id == user.id))
        db_session.delete(user)
    db_session.commit()


def test_register_push_token_creates_then_upserts_by_token(db_session):
    user_a = _make_user(db_session, "push-test-user-a@example.com")
    user_b = _make_user(db_session, "push-test-user-b@example.com")

    try:
        token = "ExponentPushToken[test-token-shared-device]"

        created = register_push_token(db_session, user_a.id, token, "android")
        assert created.user_id == user_a.id
        assert get_push_tokens_for_user(db_session, user_a.id) == [token]

        # Same device, different account logs in — the row should re-point
        # to user_b, not duplicate, and user_a should no longer see it.
        updated = register_push_token(db_session, user_b.id, token, "android")
        assert updated.id == created.id
        assert updated.user_id == user_b.id
        assert get_push_tokens_for_user(db_session, user_a.id) == []
        assert get_push_tokens_for_user(db_session, user_b.id) == [token]
    finally:
        _cleanup(db_session, user_a, user_b)


def test_delete_push_token(db_session):
    user = _make_user(db_session, "push-test-delete@example.com")
    try:
        token = "ExponentPushToken[test-token-to-delete]"
        register_push_token(db_session, user.id, token, "ios")
        assert get_push_tokens_for_user(db_session, user.id) == [token]

        delete_push_token(db_session, token)
        assert get_push_tokens_for_user(db_session, user.id) == []
    finally:
        _cleanup(db_session, user)


def test_push_token_api_register_and_unregister(db_session):
    user = _make_user(db_session, "push-test-api@example.com")
    try:
        app.dependency_overrides[get_current_user] = lambda: user

        res = client.post(
            "/notifications/push-token",
            json={"expo_push_token": "ExponentPushToken[test-api-token]", "platform": "android"},
        )
        assert res.status_code == 204
        assert get_push_tokens_for_user(db_session, user.id) == ["ExponentPushToken[test-api-token]"]

        res = client.request(
            "DELETE",
            "/notifications/push-token",
            json={"expo_push_token": "ExponentPushToken[test-api-token]", "platform": "android"},
        )
        assert res.status_code == 204
        assert get_push_tokens_for_user(db_session, user.id) == []
    finally:
        app.dependency_overrides.clear()
        _cleanup(db_session, user)


def test_send_push_notifications_task_posts_to_expo(monkeypatch):
    from app.tasks.notification_tasks import send_push_notifications_task

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.__enter__.return_value.post.return_value = mock_response

    with patch("httpx.Client", return_value=mock_client):
        result = send_push_notifications_task(
            ["ExponentPushToken[a]", "ExponentPushToken[b]"], "Title", "Body", {"link": "/orders"}
        )

    assert result is True
    post_call = mock_client.__enter__.return_value.post.call_args
    assert post_call.args[0] == "https://exp.host/--/api/v2/push/send"
    sent_messages = post_call.kwargs["json"]
    assert len(sent_messages) == 2
    assert sent_messages[0]["to"] == "ExponentPushToken[a]"
    assert sent_messages[0]["title"] == "Title"
    assert sent_messages[0]["data"] == {"link": "/orders"}


def test_send_push_notifications_task_no_tokens_is_a_noop():
    from app.tasks.notification_tasks import send_push_notifications_task

    with patch("httpx.Client") as mock_client_cls:
        result = send_push_notifications_task([], "Title", "Body")

    assert result is False
    mock_client_cls.assert_not_called()


def test_create_notification_dispatches_push_when_token_registered(db_session):
    user = _make_user(db_session, "push-test-integration@example.com")
    try:
        register_push_token(db_session, user.id, "ExponentPushToken[integration-test]", "android")

        with patch("app.tasks.notification_tasks.send_push_notifications_task") as mock_task:
            from app.services.notification_service import create_notification
            create_notification(db_session, user.id, "New reply", "Support replied", type="SUPPORT", link="/support")

        mock_task.delay.assert_called_once_with(
            ["ExponentPushToken[integration-test]"], "New reply", "Support replied", {"link": "/support"}
        )
    finally:
        _cleanup(db_session, user)
