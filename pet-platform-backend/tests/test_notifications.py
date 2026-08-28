import pytest
from unittest.mock import MagicMock
from app.models.notification import Notification
from app.models.user import User
from app.services.notification_service import (
    create_notification,
    get_user_notifications,
    get_unread_notifications_count,
    mark_as_read,
    mark_all_read,
)


def test_create_notification():
    db = MagicMock()
    user_id = 42
    title = "Test Title"
    message = "Test Message"

    notification = create_notification(db, user_id, title, message, "ORDER")

    assert notification.user_id == user_id
    assert notification.title == title
    assert notification.message == message
    assert notification.type == "ORDER"
    assert notification.is_read is False
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_get_user_notifications():
    db = MagicMock()
    user_id = 42

    mock_notif_1 = Notification(id=1, user_id=user_id, title="N1", message="M1", is_read=False)
    mock_notif_2 = Notification(id=2, user_id=user_id, title="N2", message="M2", is_read=True)

    db.scalars.return_value.all.return_value = [mock_notif_1, mock_notif_2]

    res = get_user_notifications(db, user_id)
    assert len(res) == 2
    assert res[0].title == "N1"
    assert res[1].title == "N2"


def test_get_unread_notifications_count():
    db = MagicMock()
    user_id = 42
    db.scalar.return_value = 5

    count = get_unread_notifications_count(db, user_id)
    assert count == 5


def test_mark_as_read():
    db = MagicMock()
    user_id = 42
    notification_id = 99

    mock_notif = Notification(id=notification_id, user_id=user_id, title="N", message="M", is_read=False)
    db.scalar.return_value = mock_notif

    res = mark_as_read(db, user_id, notification_id)
    assert res is not None
    assert res.is_read is True
    db.commit.assert_called_once()


def test_mark_all_read():
    db = MagicMock()
    user_id = 42

    mock_result = MagicMock()
    mock_result.rowcount = 3
    db.execute.return_value = mock_result

    count = mark_all_read(db, user_id)
    assert count == 3
    db.commit.assert_called_once()


def test_dispatch_order_notifications_task(monkeypatch):
    mock_db = MagicMock()
    mock_user = MagicMock()
    mock_user.email = "ganesh@example.com"
    mock_user.first_name = "Ganesh"
    mock_db.get.return_value = mock_user

    monkeypatch.setattr("app.tasks.notification_tasks.SessionLocal", lambda: mock_db)

    mock_create_notif = MagicMock()
    monkeypatch.setattr("app.tasks.notification_tasks.create_notification", mock_create_notif)

    mock_send_email = MagicMock()
    monkeypatch.setattr("app.tasks.notification_tasks.send_order_update_email", mock_send_email)

    from app.tasks.notification_tasks import dispatch_order_notifications_task
    result = dispatch_order_notifications_task(user_id=10, title="Order Confirmed", message="Updated details")

    assert result is True
    mock_db.get.assert_called_once_with(mock_db.get.call_args[0][0], 10)
    mock_create_notif.assert_called_once()
    mock_send_email.assert_called_once_with(
        to_email="ganesh@example.com",
        first_name="Ganesh",
        title="Order Confirmed",
        message="Updated details"
    )


def test_broadcast_global_notification_task(monkeypatch):
    mock_db = MagicMock()
    mock_users = [User(id=1, is_active=True), User(id=2, is_active=True)]
    mock_db.scalars.return_value.all.return_value = mock_users
    monkeypatch.setattr("app.tasks.notification_tasks.SessionLocal", lambda: mock_db)

    mock_create_notif = MagicMock()
    monkeypatch.setattr("app.tasks.notification_tasks.create_notification", mock_create_notif)

    from app.tasks.notification_tasks import broadcast_global_notification_task
    result = broadcast_global_notification_task(title="Global Alert", message="System maintenance")

    assert result is True
    assert mock_create_notif.call_count == 2


def test_notify_admins_task(monkeypatch):
    mock_db = MagicMock()
    from app.models.enums import UserRole
    mock_admins = [User(id=3, role=UserRole.ADMIN, is_active=True)]
    mock_db.scalars.return_value.all.return_value = mock_admins
    monkeypatch.setattr("app.tasks.notification_tasks.SessionLocal", lambda: mock_db)

    mock_create_notif = MagicMock()
    monkeypatch.setattr("app.tasks.notification_tasks.create_notification", mock_create_notif)

    from app.tasks.notification_tasks import notify_admins_task
    result = notify_admins_task(title="Admin Alert", message="New order details")

    assert result is True
    assert mock_create_notif.call_count == 1
