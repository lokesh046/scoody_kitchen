from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class DoctorApplication(Base):
    __tablename__ = "doctor_applications"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        unique=False,
        nullable=False,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )

    phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    specialization: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )

    qualification: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    experience_years: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    consultation_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    license_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    degree_start_year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    degree_end_year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    nationality: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    education_history: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    clinic_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    clinic_address: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    clinic_city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    clinic_state: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    aadhaar_card_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    pan_card_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    medical_certificate_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False,
        index=True,
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

    user = relationship(
        "User",
        back_populates="doctor_applications",
    )
