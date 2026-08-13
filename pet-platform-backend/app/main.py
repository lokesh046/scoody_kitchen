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
from app.api.pets import router as pet_router
from app.api.product import router as product_router
from app.api.categories import router as categories_router
from app.api.inventory import router as inventory_router
from app.api.cart import router as cart_router
from app.api.order import router as orders_router
from app.api.payments import router as payment_router


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API for a pet commerce and pet-care platform",
)


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(pet_router)
app.include_router(product_router)
app.include_router(categories_router)
app.include_router(inventory_router)
app.include_router(cart_router)
app.include_router(orders_router)
app.include_router(payment_router)

if settings.IMAGE_STORAGE_PROVIDER.lower() == "local":
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    from fastapi.staticfiles import StaticFiles
    app.mount(
        f"/{settings.UPLOAD_DIR}",
        StaticFiles(directory=settings.UPLOAD_DIR),
        name=settings.UPLOAD_DIR,
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

