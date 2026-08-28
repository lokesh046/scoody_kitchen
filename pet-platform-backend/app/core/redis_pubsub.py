import json
import redis
import redis.asyncio as aioredis
from app.core.config import settings

# Global Redis clients
redis_client = aioredis.from_url(settings.REDIS_URL)
sync_redis_client = redis.from_url(settings.REDIS_URL)

async def publish_notification_async(user_id: int, payload: dict):
    """
    Publishes a notification event to the 'pet_notifications' Redis channel asynchronously.
    """
    message = {
        "user_id": user_id,
        "payload": payload
    }
    await redis_client.publish("pet_notifications", json.dumps(message))

def publish_notification_sync(user_id: int, payload: dict):
    """
    Publishes a notification event to the 'pet_notifications' Redis channel synchronously.
    """
    message = {
        "user_id": user_id,
        "payload": payload
    }
    sync_redis_client.publish("pet_notifications", json.dumps(message))

