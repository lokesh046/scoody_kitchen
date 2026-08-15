from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import HealthRecordType


class HealthRecord(Base):
    __tablename__ = "health_records"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    pet_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    doctor_id: Mapped[int | None] = mapped_column(
        ForeignKey("doctors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    consultation_id: Mapped[int | None] = mapped_column(
        ForeignKey("consultations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    record_type: Mapped[HealthRecordType] = mapped_column(
        SQLEnum(
            HealthRecordType,
            name="health_record_type",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=HealthRecordType.GENERAL,
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    symptoms: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    clinical_findings: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    diagnosis: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    treatment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    medications: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    follow_up_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    pet = relationship("Pet")
    doctor = relationship("Doctor")
    consultation = relationship("Consultation")
