from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    # Null until the code/link is verified: a brand-new sign-in request has no `user` row
    # yet, so this token carries the pending signup's details (below) until verification
    # creates the real user and this gets backfilled.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Set only for a pending (not-yet-verified) brand-new signup, i.e. while user_id is None.
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    pending_first_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pending_last_name: Mapped[str | None] = mapped_column(String(50), nullable=True)

    token_hash: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    code_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    used: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    failed_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User | None"] = relationship(
        "User",
        back_populates="magic_link_tokens",
    )
