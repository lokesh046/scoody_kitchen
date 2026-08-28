from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.user import User
from app.services.notification_service import create_notification
from app.services.email_service import send_order_update_email
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notification_tasks.dispatch_order_notifications_task")
def dispatch_order_notifications_task(user_id: int, title: str, message: str) -> bool:
    logger.info(f"Running dispatch_order_notifications_task for user_id={user_id}")
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user:
            logger.error(f"User {user_id} not found. Cannot send notifications.")
            return False

        # 1. Create In-App Notification (Database & WebSocket)
        create_notification(
            db=db,
            user_id=user_id,
            title=title,
            message=message,
            type="ORDER"
        )

        # 2. Send operational email alert
        if user.email:
            send_order_update_email(
                to_email=user.email,
                first_name=user.first_name,
                title=title,
                message=message
            )

        return True
    except Exception as e:
        logger.error(f"Error in dispatch_order_notifications_task: {e}")
        return False
    finally:
        db.close()


@celery_app.task(name="app.tasks.notification_tasks.broadcast_global_notification_task")
def broadcast_global_notification_task(title: str, message: str) -> bool:
    logger.info("Running broadcast_global_notification_task for all active users")
    from sqlalchemy import select
    db = SessionLocal()
    try:
        statement = select(User).where(User.is_active == True)
        users = list(db.scalars(statement).all())
        logger.info(f"Broadcasting to {len(users)} active users")
        for user in users:
            try:
                create_notification(
                    db=db,
                    user_id=user.id,
                    title=title,
                    message=message,
                    type="SYSTEM"
                )
            except Exception as e:
                logger.error(f"Failed to create notification for user {user.id}: {e}")
        return True
    except Exception as e:
        logger.error(f"Error in broadcast_global_notification_task: {e}")
        return False
    finally:
        db.close()


@celery_app.task(name="app.tasks.notification_tasks.notify_admins_task")
def notify_admins_task(title: str, message: str) -> bool:
    logger.info("Running notify_admins_task for all admin users")
    from sqlalchemy import select
    from app.models.enums import UserRole
    db = SessionLocal()
    try:
        statement = select(User).where(User.is_active == True, User.role == UserRole.ADMIN)
        admins = list(db.scalars(statement).all())
        logger.info(f"Notifying {len(admins)} admin users")
        for admin in admins:
            try:
                create_notification(
                    db=db,
                    user_id=admin.id,
                    title=title,
                    message=message,
                    type="SYSTEM"
                )
            except Exception as e:
                logger.error(f"Failed to create notification for admin {admin.id}: {e}")
        return True
    except Exception as e:
        logger.error(f"Error in notify_admins_task: {e}")
        return False
    finally:
        db.close()
