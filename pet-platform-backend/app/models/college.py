import datetime
from sqlalchemy import Integer, String, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.college_database import CollegeBase

class College(CollegeBase):
    __tablename__ = "colleges"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )
    state: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    address_line1: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )
    address_line2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )
    city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )
    district: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )
    pin_code: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True
    )
    last_updated: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        server_default="true",
        default=True,
        nullable=False
    )
