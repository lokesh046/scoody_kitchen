from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.order import OrderStatus

if TYPE_CHECKING:
    from app.models.order import Order


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[OrderStatus] = mapped_column(
        SQLEnum(
            OrderStatus,
            name="order_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="status_history",
    )
