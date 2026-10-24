from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship


from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"


    id: Mapped[int] = mapped_column(
        primary_key =True,
        index = True
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # NULL = top-level ("main") category. Set = subcategory of that parent.
    # Kept to one level of nesting by convention (enforced in the service
    # layer, not the schema) to match the Main Category -> Subcategory ->
    # Products browsing structure -- not a general-purpose arbitrary tree.
    parent_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    products = relationship(
        "Product",
        back_populates="category",
    )

    parent = relationship(
        "Category",
        remote_side=[id],
        back_populates="children",
    )

    children = relationship(
        "Category",
        back_populates="parent",
    )

    

