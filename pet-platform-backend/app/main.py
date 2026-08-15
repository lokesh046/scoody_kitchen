from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
load_dotenv()

from app.core.config import settings
from app.core.database import get_db

from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.doctor import router as doctor_router
from app.api.public_doctors import router as public_doctors_router
from app.api.pets import router as pet_router
from app.api.product import router as product_router
from app.api.categories import router as categories_router
from app.api.inventory import router as inventory_router
from app.api.cart import router as cart_router
from app.api.order import router as orders_router
from app.api.payments import router as payment_router
from app.api.consultations import router as consultations_router


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup cleanup of unverified typo accounts older than 24 hours
    try:
        from app.core.database import SessionLocal
        from app.services.auth_service import cleanup_unverified_users
        db = SessionLocal()
        count = cleanup_unverified_users(db, max_age_hours=24)
        db.close()
    except Exception:
        pass
    yield

from fastapi.middleware.cors import CORSMiddleware

from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter, rate_limit_handler

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API for a pet commerce and pet-care platform",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# Configure CORS Middleware for secure cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        settings.FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(doctor_router)
app.include_router(public_doctors_router)
app.include_router(pet_router)
app.include_router(product_router)
app.include_router(categories_router)
app.include_router(inventory_router)
app.include_router(cart_router)
app.include_router(orders_router)
app.include_router(payment_router)
app.include_router(consultations_router)

if settings.IMAGE_STORAGE_PROVIDER.lower() == "local":
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    from fastapi.staticfiles import StaticFiles
    app.mount(
        f"/{settings.UPLOAD_DIR}",
        StaticFiles(directory=settings.UPLOAD_DIR),
        name=settings.UPLOAD_DIR,
    )

os.makedirs("static", exist_ok=True)
from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory="static"), name="static")



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

