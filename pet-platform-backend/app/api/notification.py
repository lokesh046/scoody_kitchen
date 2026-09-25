from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import jwt
from app.core.database import get_db, SessionLocal
from app.dependencies.auth import get_current_user, require_admin
from app.models.user import User
from app.core.config import settings
from app.core.websocket_manager import manager
from app.schemas.notification import NotificationResponse, NotificationUnreadCountResponse, PushTokenRegister
from app.services.notification_service import (
    get_user_notifications,
    get_unread_notifications_count,
    mark_as_read,
    mark_all_read,
)
from app.services.push_token_service import register_push_token, delete_push_token
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


class BroadcastRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=500)
    link: str | None = Field(default=None, max_length=255)


@router.post("/broadcast", status_code=status.HTTP_202_ACCEPTED)
def send_broadcast_notification(
    payload: BroadcastRequest,
    current_admin: User = Depends(require_admin)
):
    try:
        from app.tasks.notification_tasks import broadcast_global_notification_task
        broadcast_global_notification_task.delay(payload.title, payload.message, payload.link)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue broadcast task: {e}"
        )
    return {"message": "Announcement broadcast task has been queued successfully."}


async def get_websocket_user(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if user_id is None or token_type != "access":
            return None

        user = db.get(User, int(user_id))
        if user is None or not user.is_active:
            return None
        return user
    except Exception:
        return None


@router.post("/push-token", status_code=status.HTTP_204_NO_CONTENT)
def register_my_push_token(
    payload: PushTokenRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    register_push_token(db, current_user.id, payload.expo_push_token, payload.platform)


@router.delete("/push-token", status_code=status.HTTP_204_NO_CONTENT)
def unregister_my_push_token(
    payload: PushTokenRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Deletes by token value alone, not scoped to current_user — deliberate:
    # this runs on logout, and if a race let another account's registration
    # briefly own this device's token, the logging-out user should still be
    # able to clear it rather than keep receiving pushes for an account
    # they're no longer signed into.
    delete_push_token(db, payload.expo_push_token)


@router.get("", response_model=list[NotificationResponse])
def list_my_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_notifications(db, current_user.id, skip=skip, limit=limit)


@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
def get_my_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = get_unread_notifications_count(db, current_user.id)
    return {"count": count}


@router.patch("/read-all")
def mark_my_notifications_read_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    modified = mark_all_read(db, current_user.id)
    return {"message": f"Successfully marked {modified} notifications as read."}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_my_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = mark_as_read(db, current_user.id, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(None),
):
    # Verify the user inside a localized short-lived database context block
    with SessionLocal() as db:
        user = await get_websocket_user(db, token)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = user.id

    # Session is closed immediately as context manager exits, releasing the connection.
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep connection open waiting for ping/pong frames
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
