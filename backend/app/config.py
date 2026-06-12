from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://sentinel:sentinel_dev@localhost:5432/sentinelai"
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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
