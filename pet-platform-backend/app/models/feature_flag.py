from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="general", nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # What clients should render in this feature's place while it's disabled:
    # "hide" (vanish entirely, the historical/default behavior), "coming_soon"
    # (a feature that doesn't exist yet — builds anticipation), or
    # "unavailable" (a real feature that's temporarily off, e.g. mid-incident
    # or over budget — telling users it was never built would be misleading).
    fallback_behavior: Mapped[str] = mapped_column(String(20), default="hide", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
