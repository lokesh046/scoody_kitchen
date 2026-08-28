from pydantic_settings import BaseSettings, SettingsConfigDict

class Setting(BaseSettings):
    APP_NAME: str = "PET PLATFORM API"
    DEBUG: bool = False

    DATABASE_URL: str = ""
    REDIS_URL: str = "redis://localhost:6379/0"

     # Per-worker-process pool size. Total connections opened against Postgres
    # is roughly WEB_CONCURRENCY x (DB_POOL_SIZE + DB_MAX_OVERFLOW), so keep
    # this low when running multiple Gunicorn/Uvicorn workers. Check your
    # Postgres max_connections before raising these.
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 5

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256" # default algorithm


  # Internal service-to-service auth (used by pet-platform-mcp-server only —
    # never exposed to customer-facing clients).
    INTERNAL_SERVICE_API_KEY: str | None = None
    MCP_INTERNAL_SECRET: str | None = None
    CHATBOT_INTERNAL_SECRET: str | None = None

    
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 # 30 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7 # 7 days

    # Image Storage Configuration
    IMAGE_STORAGE_PROVIDER: str = "local"  # local, cloudinary, s3, etc.
    UPLOAD_DIR: str = "uploads"
    BASE_URL: str = "http://127.0.0.1:8000"

    # Cloud Storage placeholders
    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None

    # Google OAuth 2.0 / OIDC
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_IDS: list[str] = []

    # SMTP & Email Settings
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM: str | None = None
    FRONTEND_URL: str = "http://127.0.0.1:8000"

    # EasyPost Shipping Configuration
    EASYPOST_API_KEY: str | None = None
    EASYPOST_WEBHOOK_SECRET: str | None = None
    EASYPOST_ENABLED: bool = False

    # Shiprocket Shipping Configuration
    SHIPPING_PROVIDER: str = "easypost"
    SHIPROCKET_EMAIL: str | None = None
    SHIPROCKET_PASSWORD: str | None = None
    SHIPROCKET_ENABLED: bool = False
    SHIPROCKET_WEBHOOK_TOKEN: str | None = None

    # Razorpay Configuration
    RAZORPAY_KEY_ID: str | None = None
    RAZORPAY_KEY_SECRET: str | None = None
    RAZORPAY_WEBHOOK_SECRET: str | None = None

    # Firebase Admin SDK Configuration
    FIREBASE_CREDENTIALS_PATH: str = "firebase-service-account.json"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )



settings = Setting()