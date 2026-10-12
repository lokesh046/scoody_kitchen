from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class BlogPost(Base):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), nullable=False, unique=True, index=True)
    excerpt: Mapped[str] = mapped_column(String(300), nullable=True)
    content_html: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    primary_keyword: Mapped[str | None] = mapped_column(String(200), nullable=True)
    keywords: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma-separated, used for internal-linking lookups
    meta_description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)  # draft | published
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
