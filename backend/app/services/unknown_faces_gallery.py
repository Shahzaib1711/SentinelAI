"""In-memory gallery of auto-captured unknown faces (not enrolled staff/VIPs)."""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.face_recognition import match_score, to_numpy_embedding

logger = logging.getLogger(__name__)

_LABEL_RE = re.compile(r"Visitor #(\d+)", re.IGNORECASE)


@dataclass
class UnknownRecord:
    id: str
    label: str
    photo_url: str | None
    embedding: np.ndarray
    camera_id: str | None = None
    sighting_count: int = 1
    is_new: bool = field(default=False, repr=False)


_gallery_by_event: dict[str, list[UnknownRecord]] = {}
_label_seq_by_event: dict[str, int] = {}
# Throttle DB updates for repeat sightings (person_id -> last persist ms)
_last_persist_ms: dict[str, int] = {}
PERSIST_INTERVAL_MS = 30_000


def get_gallery(event_id: str) -> list[UnknownRecord]:
    return _gallery_by_event.get(event_id, [])


def set_gallery(event_id: str, records: list[UnknownRecord]) -> None:
    _gallery_by_event[event_id] = records
    max_seq = 0
    for record in records:
        match = _LABEL_RE.search(record.label)
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    _label_seq_by_event[event_id] = max_seq
    logger.info("Loaded %d detected faces for event %s", len(records), event_id)


def _next_label(event_id: str) -> str:
    seq = _label_seq_by_event.get(event_id, 0) + 1
    _label_seq_by_event[event_id] = seq
    return f"Visitor #{seq:04d}"


def identify_unknown(
    event_id: str,
    embedding: np.ndarray,
    *,
    threshold: float | None = None,
) -> UnknownRecord | None:
    threshold = threshold if threshold is not None else settings.face_match_threshold
    gallery = get_gallery(event_id)
    if not gallery:
        return None

    best: UnknownRecord | None = None
    best_score = threshold

    for record in gallery:
        score = match_score(embedding, record.embedding)
        if score > best_score:
            best_score = score
            best = record

    return best


def resolve_or_register_unknown(
    event_id: str,
    embedding: np.ndarray,
    *,
    photo_url: str | None = None,
    camera_id: str | None = None,
) -> UnknownRecord:
    """
  Match against known unknowns or create a new captured identity.
  Returns record with is_new=True when a brand-new person was registered.
  """
    existing = identify_unknown(event_id, embedding)
    if existing:
        existing.sighting_count += 1
        if photo_url and not existing.photo_url:
            existing.photo_url = photo_url
        return existing

    record = UnknownRecord(
        id=str(uuid.uuid4()),
        label=_next_label(event_id),
        photo_url=photo_url,
        embedding=embedding,
        camera_id=camera_id,
        sighting_count=1,
        is_new=True,
    )
    gallery = _gallery_by_event.setdefault(event_id, [])
    gallery.append(record)
    return record


def should_persist_sighting(person_id: str, now_ms: int) -> bool:
    last = _last_persist_ms.get(person_id, 0)
    if now_ms - last < PERSIST_INTERVAL_MS:
        return False
    _last_persist_ms[person_id] = now_ms
    return True


def remove_from_gallery(event_id: str, person_id: str) -> None:
    gallery = _gallery_by_event.get(event_id, [])
    _gallery_by_event[event_id] = [r for r in gallery if r.id != person_id]
    _last_persist_ms.pop(person_id, None)


async def reload_gallery_for_event(db: AsyncSession, event_id: str) -> int:
    from app.models.models import DetectedPerson

    result = await db.execute(
        select(DetectedPerson).where(DetectedPerson.eventId == event_id)
    )
    rows = result.scalars().all()
    records: list[UnknownRecord] = []

    for row in rows:
        try:
            records.append(
                UnknownRecord(
                    id=row.id,
                    label=row.label,
                    photo_url=row.photoUrl,
                    embedding=to_numpy_embedding(row.embeddingJson),
                    camera_id=row.cameraId,
                    sighting_count=row.sightingCount,
                )
            )
        except Exception as exc:
            logger.warning("Skip invalid detected embedding for %s: %s", row.id, exc)

    set_gallery(event_id, records)
    return len(records)
