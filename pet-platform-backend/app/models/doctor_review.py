from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DoctorReview(Base):
    __tablename__ = "doctor_reviews"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    consultation_id: Mapped[int] = mapped_column(
        ForeignKey("consultations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    consultation = relationship("Consultation")
    doctor = relationship("Doctor", back_populates="reviews")
    customer = relationship("User")
