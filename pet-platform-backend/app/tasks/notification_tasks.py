import httpx

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User
from app.services.notification_service import create_notification
from app.services.email_service import send_order_update_email
import logging

logger = logging.getLogger(__name__)

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"


@celery_app.task(name="app.tasks.notification_tasks.send_push_notifications_task")
def send_push_notifications_task(
    tokens: list[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """Fires a batch push via Expo's push API. Runs as its own Celery task
    (called from create_notification) so a slow or failing push send never
    delays the request that triggered the underlying notification — losing
    a push is a missed alert, not a correctness problem, so failures here
    are logged and swallowed rather than retried or surfaced upstream.
    """
    if not tokens:
        return False

    messages = [
        {"to": token, "title": title, "body": body, "data": data or {}, "sound": "default"}
        for token in tokens
    ]
    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(
                EXPO_PUSH_API_URL,
                json=messages,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            response.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Failed to send push notifications: {e}")
        return False


@celery_app.task(name="app.tasks.notification_tasks.dispatch_order_notifications_task")
def dispatch_order_notifications_task(user_id: int, title: str, message: str, link: str | None = None) -> bool:
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
            type="ORDER",
            link=link
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
def broadcast_global_notification_task(title: str, message: str, link: str | None = None) -> bool:
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
                    type="SYSTEM",
                    link=link
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


@celery_app.task(name="app.tasks.notification_tasks.check_and_complete_expired_consultations_task")
def check_and_complete_expired_consultations_task() -> int:
    """
    Background worker task to automatically finalize consultations that have passed their duration + grace period.
    """
    from app.services.consultation_service import auto_complete_expired_consultations
    db = SessionLocal()
    try:
        completed = auto_complete_expired_consultations(db)
        if completed:
            logger.info(f"Auto-completed {len(completed)} expired consultations: {completed}")
        return len(completed)
    except Exception as e:
        logger.error(f"Error in check_and_complete_expired_consultations_task: {e}", exc_info=True)
        return 0
    finally:
        db.close()


@celery_app.task(name="app.tasks.notification_tasks.dispatch_consultation_booking_confirmed_task")
def dispatch_consultation_booking_confirmed_task(
    consultation_id: int,
    amount_paid: float,
    payment_id: str,
) -> bool:
    """
    Background worker task to dispatch the payment receipt invoice email and in-app notifications
    asynchronously without delaying the booking response to the user.
    """
    from app.models.consultation import Consultation
    from app.models.doctor import Doctor
    from app.models.pet import Pet
    from app.services.email_service import send_consultation_invoice_email

    logger.info(f"Running dispatch_consultation_booking_confirmed_task for consultation_id={consultation_id}")
    db = SessionLocal()
    try:
        consultation = db.get(Consultation, consultation_id)
        if not consultation:
            logger.error(f"Consultation #{consultation_id} not found.")
            return False

        customer = db.get(User, consultation.customer_id)
        doctor = db.get(Doctor, consultation.doctor_id)
        pet = db.get(Pet, consultation.pet_id)

        doctor_user = db.get(User, doctor.user_id) if doctor and doctor.user_id else None
        doctor_name = f"{doctor_user.first_name} {doctor_user.last_name}".strip() if doctor_user else f"Specialist #{doctor.id if doctor else ''}"
        specialization = doctor.specialization if doctor else "General Veterinary Nutrition"
        pet_name = pet.name if pet else "Companion Patient"
        customer_name = f"{customer.first_name} {customer.last_name}".strip() if customer else "Pet Parent"

        # Format scheduled time
        scheduled_at_str = consultation.scheduled_at.strftime("%A, %b %d, %Y at %I:%M %p UTC")

        # 1. Create In-App Notification for Customer
        create_notification(
            db=db,
            user_id=consultation.customer_id,
            title="🩺 Consultation Confirmed & Paid",
            message=f"Your appointment with Dr. {doctor_name} for 🐾 {pet_name} on {scheduled_at_str} is confirmed. Payment ID: {payment_id}",
            type="CONSULTATION",
            link="/consultations",
        )

        # 2. Create In-App Notification for Doctor (if doctor user exists)
        if doctor and doctor.user_id:
            create_notification(
                db=db,
                user_id=doctor.user_id,
                title="🩺 New Consultation Booked",
                message=f"Patient 🐾 {pet_name} ({customer_name}) has booked and paid for a consultation on {scheduled_at_str}.",
                type="CONSULTATION",
                link="/doctor/dashboard",
            )

        # 3. Send Consultation Payment Receipt & Invoice Email to Customer
        if customer and customer.email:
            send_consultation_invoice_email(
                to_email=customer.email,
                customer_name=customer_name,
                doctor_name=doctor_name,
                specialization=specialization,
                pet_name=pet_name,
                scheduled_at_str=scheduled_at_str,
                amount_paid=amount_paid,
                payment_id=payment_id,
                consultation_id=consultation.id,
                meeting_link=f"{settings.FRONTEND_URL.rstrip('/')}/consultations/room/{consultation.id}",
            )

        logger.info(f"Successfully processed background booking confirmation for consultation #{consultation_id}")
        return True
    except Exception as e:
        logger.error(f"Error in dispatch_consultation_booking_confirmed_task: {e}", exc_info=True)
        return False
    finally:
        db.close()

