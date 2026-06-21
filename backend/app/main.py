from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models.models import Event
from app.routers import alerts, events, health, incidents, personnel, webrtc
from app.services.enrollment_gallery import reload_gallery_for_event, set_default_event_id
from app.services.face_recognition import ensure_models
from app.services.blueprint_detector import blueprint_model_status, preload_blueprint_model
from app.services.yolo_detector import preload_model

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.yolo_enabled:
        preload_model(settings.yolo_model)
    if settings.blueprint_ml_enabled:
        loaded = preload_blueprint_model(settings.blueprint_ml_model)
        status = blueprint_model_status()
        if loaded:
            print(
                f"[SentinelAI] Blueprint ML ready: {status.get('resolvedPath')}",
                flush=True,
            )
        else:
            print(
                "[SentinelAI] Blueprint ML not loaded — auto-detect will use OpenCV. "
                "Run: npm run ml:blueprint:deploy",
                flush=True,
            )
    try:
        ensure_models()
        async with SessionLocal() as db:
            result = await db.execute(
                select(Event).where(Event.slug == settings.default_event_slug)
            )
            event = result.scalar_one_or_none()
            if event:
                await reload_gallery_for_event(db, event.id)
                set_default_event_id(event.id)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning("Enrollment gallery preload skipped: %s", exc)
    yield


app = FastAPI(
    title="SentinelAI API",
    description="Blueprint-aware security intelligence backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(events.router)
app.include_router(incidents.router)
app.include_router(alerts.router)
app.include_router(webrtc.router)
app.include_router(personnel.router)


@app.get("/")
async def root():
    return {"service": "SentinelAI API", "docs": "/docs", "health": "/api/health"}
