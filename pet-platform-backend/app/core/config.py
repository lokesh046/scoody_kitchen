from pydantic_settings import BaseSettings, SettingsConfigDict

class Setting(BaseSettings):
    APP_NAME: str = "PET PLATFORM API"
    DEBUG: bool = False

    DATABASE_URL: str = ""

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256" # default algorithm

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 # 30 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7 # 7 days

    model_config = SettingsConfigDict(env_file=".env",
    extra ="ignore")



settings = Setting()