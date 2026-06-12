from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import alerts, events, health, incidents, webrtc
from app.services.yolo_detector import preload_model


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.yolo_enabled:
        preload_model(settings.yolo_model)
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


@app.get("/")
async def root():
    return {"service": "SentinelAI API", "docs": "/docs", "health": "/api/health"}
