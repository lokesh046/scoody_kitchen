from pydantic_settings import BaseSettings, SettingsConfigDict

class Setting(BaseSettings):
    APP_NAME: str = "PET PLATFORM API"
    DEBUG: bool = False

    DATABASE_URL: str = ""

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256" # default algorithm

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

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )



settings = Setting()