from datetime import datetime
from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ContactInquiry(Base):
    """A message sent from the public Contact page (Get in touch)."""
    __tablename__ = "contact_inquiries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    reason: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # general | sales | promotion | investment | partnership | other
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")  # new | handled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
