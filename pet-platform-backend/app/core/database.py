from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

db_url = settings.DATABASE_URL
if db_url and db_url.startswith("postgresql://") and not db_url.startswith("postgresql+psycopg://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(
    db_url,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=3600,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, bind=engine)

class Base(DeclarativeBase):
    pass


# Registers the hooks that clear the product caches after relevant commits.
from app.core import product_cache_hooks  # noqa: E402,F401


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()