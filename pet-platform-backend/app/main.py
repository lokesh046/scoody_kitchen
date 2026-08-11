from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
load_dotenv()

from app.core.config import settings
from app.core.database import get_db



app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API for a pet commerce and pet-care platform",
)


@app.get("/")
def root():
    return {
        "message": f"{settings.APP_NAME} is running!",
        "version":"1.0.0"
    }


@app.get('/health')
def get_health():
    return{
        "Status":"healthy",
        "message":"system is running"
    }


@app.get("/health/db")
def database_health(db:Session = Depends(get_db)):
    result = db.execute(text("select 1"))

    return {
        "database": "connected",
        "result": result.scalar()
    }

