from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import SupportTicketCategory, SupportTicketStatus


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional — lets a ticket about a specific order link back to it (e.g.
    # "damaged item", "wrong item shipped") without forcing every ticket
    # (account issues, general questions) to have one. A ticket links to at
    # most one of order_id/consultation_id — enforced in support_service.py,
    # not the DB, since either can legitimately be NULL together.
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Same idea as order_id, for tickets about a specific vet consultation
    # (e.g. "the doctor never joined the call").
    consultation_id: Mapped[int | None] = mapped_column(
        ForeignKey("consultations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    subject: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    category: Mapped[SupportTicketCategory] = mapped_column(
        SQLEnum(
            SupportTicketCategory,
            name="support_ticket_category",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=SupportTicketCategory.OTHER,
        nullable=False,
        index=True,
    )

    status: Mapped[SupportTicketStatus] = mapped_column(
        SQLEnum(
            SupportTicketStatus,
            name="support_ticket_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=SupportTicketStatus.OPEN,
        nullable=False,
        index=True,
    )

    assigned_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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

    # Stamped to now() whenever that side fetches the ticket's detail view —
    # NULL means "never opened it". A ticket is "unread" for a participant
    # when a message from the OTHER side is newer than their own timestamp
    # here. admin_last_read_at is shared across all admins (not per-admin),
    # matching how assigned_admin_id already treats support as a small,
    # shared team rather than needing per-agent read state.
    customer_last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    admin_last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    customer = relationship("User", foreign_keys=[customer_id])
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])
    order = relationship("Order")
    consultation = relationship("Consultation")
    messages = relationship(
        "SupportMessage",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="SupportMessage.created_at",
    )
