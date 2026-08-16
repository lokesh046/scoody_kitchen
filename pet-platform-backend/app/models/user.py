from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func,Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.enums import UserRole

from app.core.database import Base

class User(Base):

    __tablename__ = "user"


    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,

    )


    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    first_name: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    last_name: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    profile_image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    auth_provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="magic_link",
    )

    oauth_sub: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    role: Mapped[UserRole] = mapped_column(
    SQLEnum(
        UserRole,
        name="user_role",
        values_callable=lambda enum: [item.value for item in enum],
    ),
    nullable=False,
    default=UserRole.CUSTOMER
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
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

    pets = relationship(
        "Pet",
        back_populates="user",
        cascade="all, delete-orphan",
    )



    cart = relationship(
    "Cart",
    back_populates="user",
    uselist=False,
    cascade="all, delete-orphan",
    
    )

    orders = relationship(
        "Order",
        back_populates="user",
    )

    doctor_profile = relationship(
        "Doctor",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    magic_link_tokens = relationship(
        "MagicLinkToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )