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

    # Neon: set DATABASE_URL from console.neon.tech (pooled). DIRECT_URL for Prisma migrations.
    # Or use DB_* for local Docker Postgres.
    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = ""
    db_name: str = "sentinelai"
    db_schema: str = "public"
    db_sslmode: str | None = None  # require for Neon; disable for local Docker
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    default_event_slug: str = "summit-2026"

    yolo_enabled: bool = True
    yolo_model: str = "yolov8n.pt"
    yolo_confidence: float = 0.4
    yolo_interval_ms: int = 100  # env: YOLO_INTERVAL_MS — 100ms ≈ 10 FPS detection

    face_match_threshold: float = 0.45  # env: FACE_MATCH_THRESHOLD
    default_event_id: str | None = None

    blueprint_ml_enabled: bool = True
    blueprint_ml_model: str = "backend/app/models/sentinel_blueprint.pt"
    blueprint_ml_confidence: float = 0.10
    blueprint_ml_imgsz: int = 1280

    floor_plan_ml_enabled: bool = True
    floor_plan_ml_model: str = "backend/app/models/floor_plan_best.pt"
    floor_plan_ml_confidence: float = 0.25
    floor_plan_ml_imgsz: int = 1280

    # Security planning chat — OpenAI-compatible LLM (falls back to regex if unset)
    llm_enabled: bool = True
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_timeout_s: float = 45.0

    @model_validator(mode="after")
    def build_database_url(self) -> Self:
        if self.database_url and self.database_url.strip():
            return self
        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)
        url = (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )
        sslmode = self.db_sslmode
        if not sslmode and "neon.tech" in self.db_host:
            sslmode = "require"
        if sslmode:
            url = f"{url}?sslmode={sslmode}"
        self.database_url = url
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
