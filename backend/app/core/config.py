from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SISKA"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/siska"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI API
    AI_API_URL: str = "https://elsann-api-absensi.hf.space"
    DEVICE_ID: str = "stb-01"
    DEVICE_TOKEN: str = "87654321"

    # ML API Admin credentials (temporary integration)
    ML_ADMIN_USERNAME: str = ""
    ML_ADMIN_PASSWORD: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 5 * 1024 * 1024  # 5MB

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
