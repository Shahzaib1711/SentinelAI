"""In-memory gallery of enrolled staff/VIP face embeddings."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.face_recognition import extract_embedding_from_person_crop, match_score, to_numpy_embedding

logger = logging.getLogger(__name__)


@dataclass
class EnrolledRecord:
    id: str
    name: str
    designation: str
    role: str
    photo_url: str | None
    embedding: np.ndarray


_gallery_by_event: dict[str, list[EnrolledRecord]] = {}
_default_event_id: str | None = None


def set_default_event_id(event_id: str) -> None:
    global _default_event_id
    _default_event_id = event_id


def get_default_event_id() -> str | None:
    return _default_event_id


def resolve_event_id_for_matching(preferred: str | None = None) -> str | None:
    """Event id used for live face matching — falls back to any loaded gallery."""
    if preferred:
        return preferred
    if _default_event_id and _gallery_by_event.get(_default_event_id):
        return _default_event_id
    for event_id, records in _gallery_by_event.items():
        if records:
            return event_id
    return _default_event_id


def get_gallery(event_id: str) -> list[EnrolledRecord]:
    return _gallery_by_event.get(event_id, [])


def set_gallery(event_id: str, records: list[EnrolledRecord]) -> None:
    _gallery_by_event[event_id] = records
    logger.info("Loaded %d enrolled faces for event %s", len(records), event_id)


def add_to_gallery(event_id: str, record: EnrolledRecord) -> None:
    gallery = _gallery_by_event.setdefault(event_id, [])
    gallery[:] = [r for r in gallery if r.id != record.id]
    gallery.append(record)


def remove_from_gallery(event_id: str, person_id: str) -> None:
    gallery = _gallery_by_event.get(event_id, [])
    _gallery_by_event[event_id] = [r for r in gallery if r.id != person_id]


def identify_embedding(
    event_id: str,
    embedding: np.ndarray,
    *,
    threshold: float | None = None,
) -> EnrolledRecord | None:
    threshold = threshold if threshold is not None else settings.face_match_threshold
    gallery = get_gallery(event_id)
    if not gallery:
        return None

    best: EnrolledRecord | None = None
    best_score = threshold

    for record in gallery:
        score = match_score(embedding, record.embedding)
        if score > best_score:
            best_score = score
            best = record

    return best


def identify_person_in_frame(
    event_id: str,
    frame_bgr: Any,
    x_pct: float,
    y_pct: float,
    w_pct: float,
    h_pct: float,
) -> tuple[EnrolledRecord | None, float]:
    embedding = extract_embedding_from_person_crop(frame_bgr, x_pct, y_pct, w_pct, h_pct)
    if embedding is None:
        return None, 0.0

    threshold = settings.face_match_threshold
    gallery = get_gallery(event_id)
    best: EnrolledRecord | None = None
    best_score = threshold

    for record in gallery:
        score = match_score(embedding, record.embedding)
        if score > best_score:
            best_score = score
            best = record

    return best, best_score if best else 0.0


async def reload_gallery_for_event(db: AsyncSession, event_id: str) -> int:
    from app.models.models import EnrolledPerson

    result = await db.execute(
        select(EnrolledPerson).where(
            EnrolledPerson.eventId == event_id,
            EnrolledPerson.active.is_(True),
            EnrolledPerson.embeddingJson.isnot(None),
        )
    )
    rows = result.scalars().all()
    records: list[EnrolledRecord] = []

    for row in rows:
        if not row.embeddingJson:
            continue
        try:
            records.append(
                EnrolledRecord(
                    id=row.id,
                    name=row.name,
                    designation=row.designation,
                    role=row.role.value,
                    photo_url=row.photoUrl,
                    embedding=to_numpy_embedding(row.embeddingJson),
                )
            )
        except Exception as exc:
            logger.warning("Skip invalid embedding for %s: %s", row.id, exc)

    set_gallery(event_id, records)
    return len(records)
