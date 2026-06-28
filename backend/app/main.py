from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import SessionLocal
from app.models.models import Event
from app.routers import alerts, events, health, incidents, personnel, webrtc
from app.services.enrollment_gallery import reload_gallery_for_event, set_default_event_id
from app.services.unknown_faces_gallery import reload_gallery_for_event as reload_detected_gallery
from app.services.face_recognition import ensure_models
from app.services.blueprint_detector import blueprint_model_status, preload_blueprint_model
from app.services.floor_plan_detector import floor_plan_model_status, preload_floor_plan_model
from app.services.yolo_detector import preload_model

logger = logging.getLogger(__name__)

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
    if settings.floor_plan_ml_enabled:
        fp_loaded = preload_floor_plan_model(settings.floor_plan_ml_model)
        fp_status = floor_plan_model_status()
        if fp_loaded:
            print(
                f"[SentinelAI] Floor-plan ML ready: {fp_status.get('resolvedPath')}",
                flush=True,
            )
        else:
            print(
                "[SentinelAI] Floor-plan ML not loaded — doors/windows need external weights. "
                "Run: npm run ml:floor-plan:download",
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
                try:
                    await reload_detected_gallery(db, event.id)
                except Exception as detected_exc:
                    logger.warning("Detected persons preload skipped: %s", detected_exc)
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


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(_request: Request, exc: SQLAlchemyError):
    logger.exception("Database error")
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Database unavailable. Verify DATABASE_URL in .env, wake your Neon project "
                "at console.neon.tech, and ensure port 5432 is reachable."
            ),
            "error": str(exc.__cause__ or exc)[:300],
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled API error")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)[:500]},
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
