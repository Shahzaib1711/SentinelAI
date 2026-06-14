from typing import Self
from urllib.parse import quote_plus

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Set DATABASE_URL to override, or use DB_* vars below.
    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = ""
    db_name: str = "sentinelai"
    db_schema: str = "public"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    default_event_slug: str = "summit-2026"
    firebase_project_id: str | None = None
    google_application_credentials: str | None = None
    firebase_service_account_json: str | None = None

    yolo_enabled: bool = True
    yolo_model: str = "yolov8n.pt"
    yolo_confidence: float = 0.4
    yolo_interval_ms: int = 1000

    face_match_threshold: float = 0.45  # env: FACE_MATCH_THRESHOLD
    default_event_id: str | None = None

    @model_validator(mode="after")
    def build_database_url(self) -> Self:
        if self.database_url:
            return self
        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)
        self.database_url = (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
