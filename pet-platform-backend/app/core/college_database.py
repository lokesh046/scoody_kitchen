from urllib.parse import urlparse, urlunparse
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

def build_college_db_url(database_url: str, override: str = "") -> str:
    """The colleges list lives in its own database. An explicit COLLEGE_DATABASE_URL wins;
    otherwise the old convention applies: the main URL with a database named `neondb` swapped for
    `college_db`. Without either, the main database would be searched and the table not found."""
    if override:
        return override
    parts = list(urlparse(database_url))
    if parts[2] == "/neondb":
        parts[2] = "/college_db"
    return urlunparse(parts)


college_db_url = build_college_db_url(settings.DATABASE_URL, settings.COLLEGE_DATABASE_URL)

college_engine = create_engine(
    college_db_url,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=3600,
    pool_pre_ping=True,
)

CollegeSessionLocal = sessionmaker(autocommit=False, bind=college_engine)

class CollegeBase(DeclarativeBase):
    pass

def get_college_db():
    db = CollegeSessionLocal()
    try:
        yield db
    finally:
        db.close()
