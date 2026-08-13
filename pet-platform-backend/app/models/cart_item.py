from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func, UniqueConstraint 
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CartItem(Base):
    __tablename__ = "cart_items"

    __table_args__ = (
    UniqueConstraint(
        "cart_id",
        "product_id",
        name="uq_cart_product",
    ),
)

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    cart_id: Mapped[int] = mapped_column(
        ForeignKey("carts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
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

    cart = relationship(
        "Cart",
        back_populates="items",
    )

    product = relationship(
        "Product",
    )