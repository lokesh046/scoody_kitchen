from datetime import datetime

from sqlalchemy import DateTime, String, Text, func 
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

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    products = relationship(
        "Product",
        back_populates="category",
    )

    

