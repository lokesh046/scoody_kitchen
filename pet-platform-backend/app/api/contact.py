from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.dependencies.auth import require_role
from app.models.contact_inquiry import ContactInquiry
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.contact import ContactInquiryCreate, ContactInquiryResponse
from app.services.email_service import send_contact_inquiry_email

router = APIRouter(prefix="/contact", tags=["Contact"])


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def send_contact_inquiry(request: Request, payload: ContactInquiryCreate, db: Session = Depends(get_db)):
    """Public: anyone can send a message from the Get in touch page."""
    if payload.website:
        # Honeypot filled in: pretend it worked so the bot learns nothing, and store nothing.
        return {"ok": True}
    inquiry = ContactInquiry(
        reason=payload.reason,
        name=payload.name,
        email=str(payload.email).lower(),
        phone=payload.phone,
        notes=payload.notes,
    )
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)
    send_contact_inquiry_email(inquiry)
    return {"ok": True}


@router.get("/all", response_model=list[ContactInquiryResponse])
def list_contact_inquiries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    return db.scalars(select(ContactInquiry).order_by(ContactInquiry.created_at.desc())).all()
