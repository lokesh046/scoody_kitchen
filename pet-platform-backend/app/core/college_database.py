from urllib.parse import urlparse, urlunparse
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

# Deriving the connection URL dynamically from settings safely
url_parts = list(urlparse(settings.DATABASE_URL))
if url_parts[2] == "/neondb":
    url_parts[2] = "/college_db"
college_db_url = urlunparse(url_parts)

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
