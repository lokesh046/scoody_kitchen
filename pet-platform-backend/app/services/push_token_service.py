from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.push_token import PushToken


def register_push_token(db: Session, user_id: int, token: str, platform: str) -> PushToken:
    """Upsert by token, not by (user_id, token) — the same physical device
    can only hold one Expo push token at a time. If a different account
    later signs in on the same device, this re-points the existing row to
    the new user_id instead of creating a duplicate, so the previous
    account stops receiving pushes meant for whoever is actually signed in.
    """
    existing = db.scalar(select(PushToken).where(PushToken.expo_push_token == token))
    if existing:
        existing.user_id = user_id
        existing.platform = platform
        db.commit()
        db.refresh(existing)
        return existing

    push_token = PushToken(user_id=user_id, expo_push_token=token, platform=platform)
    db.add(push_token)
    db.commit()
    db.refresh(push_token)
    return push_token


def get_push_tokens_for_user(db: Session, user_id: int) -> list[str]:
    statement = select(PushToken.expo_push_token).where(PushToken.user_id == user_id)
    return list(db.scalars(statement).all())


def delete_push_token(db: Session, token: str) -> None:
    db.execute(delete(PushToken).where(PushToken.expo_push_token == token))
    db.commit()
