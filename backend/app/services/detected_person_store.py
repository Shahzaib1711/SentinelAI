"""Persist auto-captured unknown faces to PostgreSQL."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DetectedPerson
from app.services.unknown_faces_gallery import UnknownRecord, should_persist_sighting

logger = logging.getLogger(__name__)


async def persist_unknown_capture(
    db: AsyncSession,
    event_id: str,
    record: UnknownRecord,
    *,
    now_ms: int,
) -> None:
    """Insert new detected person or bump sighting count on re-identification."""
    if record.is_new:
        row = DetectedPerson(
            id=record.id,
            eventId=event_id,
            label=record.label,
            photoUrl=record.photo_url,
            embeddingJson=record.embedding.tolist(),
            cameraId=record.camera_id,
            sightingCount=record.sighting_count,
        )
        db.add(row)
        await db.commit()
        record.is_new = False
        logger.info("Saved new detected person %s (%s)", record.id, record.label)
        return

    if not should_persist_sighting(record.id, now_ms):
        return

    result = await db.execute(
        select(DetectedPerson).where(
            DetectedPerson.id == record.id,
            DetectedPerson.eventId == event_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return

    row.sightingCount = record.sighting_count
    row.lastSeenAt = datetime.now(timezone.utc)
    if record.photo_url and not row.photoUrl:
        row.photoUrl = record.photo_url
    await db.commit()
