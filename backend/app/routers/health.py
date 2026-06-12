import os

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "connected",
        "firebase": bool(os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") or os.getenv("FIREBASE_PROJECT_ID")),
        "api": "fastapi",
    }
