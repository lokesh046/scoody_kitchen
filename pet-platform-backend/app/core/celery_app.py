from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "pet_platform_tasks",
    broker=settings.CELERY_REDIS_URL,
    backend=settings.CELERY_REDIS_URL,
    include=["app.tasks.notification_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "check-expired-consultations-every-minute": {
            "task": "app.tasks.notification_tasks.check_and_complete_expired_consultations_task",
            "schedule": 60.0,
        },
    },
)
