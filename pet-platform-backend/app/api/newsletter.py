from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.models.newsletter import NewsletterSubscriber
from app.schemas.newsletter import NewsletterSubscribeRequest, NewsletterSubscriberResponse
from app.services.email_service import send_newsletter_welcome_email

router = APIRouter(prefix="/newsletter", tags=["Newsletter"])


@router.post("/subscribe", response_model=NewsletterSubscriberResponse, status_code=status.HTTP_201_CREATED)
def subscribe(payload: NewsletterSubscribeRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(NewsletterSubscriber).where(NewsletterSubscriber.email == payload.email))
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            send_newsletter_welcome_email(payload.email)
        return existing

    subscriber = NewsletterSubscriber(email=payload.email, source=payload.source)
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    send_newsletter_welcome_email(payload.email)
    return subscriber


@router.get("/all", response_model=list[NewsletterSubscriberResponse])
def get_all_subscribers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    stmt = select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc())
    return db.scalars(stmt).all()


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscriber(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    subscriber = db.get(NewsletterSubscriber, id)
    if not subscriber:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscriber not found")
    db.delete(subscriber)
    db.commit()
