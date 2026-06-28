from fastapi import APIRouter
from sqlalchemy import text

from app.database import SessionLocal
from app.services.blueprint_detector import blueprint_model_status
from app.services.floor_plan_detector import floor_plan_model_status

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check():
    db_status = "connected"
    db_error: str | None = None
    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = "error"
        db_error = str(exc.__cause__ or exc)[:300]

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "databaseError": db_error,
        "api": "fastapi",
        "blueprintMl": blueprint_model_status(),
        "floorPlanMl": floor_plan_model_status(),
    }
