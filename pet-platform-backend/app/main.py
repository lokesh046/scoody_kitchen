# Force IPv4 DNS resolution to prevent IPv6 hangs on this system
import socket
orig_getaddrinfo = socket.getaddrinfo
def forced_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if family in (socket.AF_UNSPEC, 0):
        family = socket.AF_INET
    return orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = forced_ipv4_getaddrinfo

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
from app.api.internal import router as internal_router
from app.api.doctor_applications import router as doctor_applications_router
from app.api.colleges import router as colleges_router
from app.api.banner import router as banners_router
from app.api.notification import router as notification_router

from contextlib import asynccontextmanager
from app.core.redis_listener import redis_notifications_listener
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify secure internal endpoint credentials on startup
    missing_secrets = []
    if not settings.INTERNAL_SERVICE_API_KEY:
        missing_secrets.append("INTERNAL_SERVICE_API_KEY")
    if not settings.MCP_INTERNAL_SECRET:
        missing_secrets.append("MCP_INTERNAL_SECRET")
    if not settings.CHATBOT_INTERNAL_SECRET:
        missing_secrets.append("CHATBOT_INTERNAL_SECRET")

    if missing_secrets:
        raise RuntimeError(
            f"Security Error: The following internal API security keys are not configured in your environment: "
            f"{', '.join(missing_secrets)}. Running in this state exposes internal endpoints to the public!"
        )

    # Initialize Firebase Admin SDK
    try:
        import firebase_admin
        from firebase_admin import credentials
        
        creds_path = settings.FIREBASE_CREDENTIALS_PATH
        if os.path.exists(creds_path):
            cred = credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred)
            print("Successfully initialized Firebase Admin SDK.")
        else:
            print(f"Warning: Firebase credentials file not found at {creds_path}. Firebase Auth will not be available.")
    except Exception as e:
        print(f"Failed to initialize Firebase Admin SDK: {e}")

    # Startup cleanup of unverified typo accounts older than 24 hours
    try:
        from app.core.database import SessionLocal
        from app.services.auth_service import cleanup_unverified_users
        db = SessionLocal()
        count = cleanup_unverified_users(db, max_age_hours=24)
        db.close()
    except Exception:
        pass

    # Start the background Redis notification channel listener
    listener_task = asyncio.create_task(redis_notifications_listener())

    yield

    # Shutdown: cancel the listener task cleanly
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass

from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter, rate_limit_handler

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API for a pet commerce and pet-care platform",
    lifespan=lifespan,
)

# GZip response compression middleware (compresses responses > 1KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)

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


import logging
import json
logger = logging.getLogger(__name__)

def redact_sensitive_keys(data):
    if isinstance(data, dict):
        return {
            k: "[REDACTED]" if any(word in k.lower() for word in ["password", "token", "secret", "otp", "key", "card", "cvv"])
            else redact_sensitive_keys(v)
            for k, v in data.items()
        }
    elif isinstance(data, list):
        return [redact_sensitive_keys(item) for item in data]
    return data

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.warning("422 Request Validation Error - Errors: %s", exc.errors())
    try:
        body = await request.body()
        if body:
            body_str = body.decode("utf-8")
            try:
                body_json = json.loads(body_str)
                redacted_json = redact_sensitive_keys(body_json)
                logger.warning("422 Request Validation Error - Body: %s", redacted_json)
            except Exception:
                logger.warning("422 Request Validation Error - Raw Body: [REDACTED FOR SECURITY]")
    except Exception:
        pass
    from fastapi.encoders import jsonable_encoder
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(exc.errors())},
    )


from app.api.webhooks import router as webhooks_router

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
app.include_router(webhooks_router)
app.include_router(internal_router)
app.include_router(doctor_applications_router)
app.include_router(colleges_router)
app.include_router(banners_router)
app.include_router(notification_router)

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

