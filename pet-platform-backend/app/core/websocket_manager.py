import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Maps user_id (int) to a list of active WebSocket connections
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        print(f"[WS Manager] User {user_id} connected. Active connections: {len(self.active_connections[user_id])}")
        logger.info(f"[WS Manager] User {user_id} connected. Active connections: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        print(f"[WS Manager] User {user_id} disconnected.")
        logger.info(f"[WS Manager] User {user_id} disconnected.")

    async def send_personal_message(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            connections = list(self.active_connections[user_id])
            logger.info(f"[WS Manager] Sending personal message to user {user_id} over {len(connections)} connections.")
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"[WS Manager] Failed to send JSON to user {user_id}: {e}")
                    self.disconnect(user_id, connection)
        else:
            logger.warning(f"[WS Manager] Attempted to send message to user {user_id}, but no active WebSocket connections found.")


manager = ConnectionManager()
