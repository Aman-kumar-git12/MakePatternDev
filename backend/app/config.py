import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/dsa_tracker"
    SQLITE_FALLBACK: bool = True
    JWT_SECRET: str = "dsa_tracker_super_secret_jwt_key_2026_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CLIENT_URL: str = "http://localhost:5173"

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()
