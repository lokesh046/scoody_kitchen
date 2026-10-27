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
    # The beat task below runs 96 times a day in a worker that otherwise
    # lives forever, so anything that leaks slowly accumulates for the life of
    # the container. Recycling the child process caps that.
    worker_max_tasks_per_child=500,
    beat_schedule={
        "check-expired-consultations-every-minute": {
            "task": "app.tasks.notification_tasks.check_and_complete_expired_consultations_task",
            # Every 15 min, not every minute: a query each minute kept the Neon
            # database awake 24/7. Consultations auto-complete after a 15 min grace
            # period, so this adds at most one extra interval of delay.
            "schedule": 900.0,
        },
        "cleanup-unverified-users-every-6-hours": {
            "task": "app.tasks.notification_tasks.cleanup_unverified_users_task",
            "schedule": 21600.0,
        },
    },
)
