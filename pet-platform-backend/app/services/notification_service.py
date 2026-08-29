import asyncio
from datetime import datetime, UTC
from sqlalchemy import select, func, update
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.core.redis_pubsub import publish_notification_async, publish_notification_sync


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: str = "SYSTEM",
    link: str | None = None
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        is_read=False,
        link=link
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Format the payload for WebSocket
    created_at_dt = notification.created_at or datetime.now(UTC)
    payload = {
        "id": notification.id or 0,
        "title": notification.title,
        "message": notification.message,
        "type": notification.type,
        "is_read": notification.is_read,
        "link": notification.link,
        "created_at": created_at_dt.isoformat()
    }

    # Publish notification to Redis Pub/Sub channel
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(publish_notification_async(user_id, payload))
    except RuntimeError:
        # Fallback to sync publisher when no event loop is running (e.g. Celery workers / DB scripts)
        try:
            publish_notification_sync(user_id, payload)
        except Exception:
            pass

    return notification


def get_user_notifications(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20
) -> list[Notification]:
    statement = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_unread_notifications_count(db: Session, user_id: int) -> int:
    statement = (
        select(func.count(Notification.id))
        .where(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
    )
    return db.scalar(statement) or 0


def mark_as_read(db: Session, user_id: int, notification_id: int) -> Notification | None:
    statement = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user_id
    )
    notification = db.scalar(statement)
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_read(db: Session, user_id: int) -> int:
    statement = (
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
        .values(is_read=True)
    )
    result = db.execute(statement)
    db.commit()
    return getattr(result, "rowcount", 0)
