from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class FAQ(Base):
    __tablename__ = "faqs"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )
    question: Mapped[str] = mapped_column(String(300), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    # Which page shows this question: home, shop, pets or vet.
    page: Mapped[str] = mapped_column(String(20), default="home", server_default="home", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
