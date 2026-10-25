import json
import asyncio
import logging
from app.core.redis_pubsub import redis_client
from app.core.websocket_manager import manager

logger = logging.getLogger(__name__)

async def redis_notifications_listener():
    """
    Subscribes to 'pet_notifications' Redis channel in the background
    and pushes received payloads to active WebSocket clients on this server.
    """
    logger.info("Initializing background Redis Pub/Sub notification listener...")
    while True:
        pubsub = redis_client.pubsub()
        try:
            await pubsub.subscribe("pet_notifications")
            logger.info("Successfully subscribed to Redis channel: pet_notifications")

            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        user_id = int(data["user_id"])
                        payload = data["payload"]
                        logger.info(f"[Redis Listener] Fetched notification from Redis channel for user {user_id}: {payload}")
                        # Forward to the memory websocket connections on this server process
                        await manager.send_personal_message(user_id, payload)
                    except Exception as e:
                        logger.error(f"Error parsing Redis notification payload: {e}")

        except asyncio.CancelledError:
            logger.info("Redis notifications listener task cancelled. Unsubscribing...")
            raise
        except Exception as e:
            logger.error(f"Redis Pub/Sub connection lost, reconnecting in 5 seconds... Error: {e}")
            await asyncio.sleep(5)
        finally:
            # Every reconnect used to build a fresh pubsub and abandon the old
            # one, so each dropped Redis connection leaked a socket and its
            # reader task for the life of the process. Closing here runs on
            # reconnect and on cancellation alike.
            try:
                await pubsub.aclose()
            except Exception:
                pass
