"""Staff / VIP enrollment with face photo registration."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import EnrolledPerson, Event, PersonnelRole
from app.services.enrollment_gallery import (
    EnrolledRecord,
    add_to_gallery,
    reload_gallery_for_event,
    remove_from_gallery,
    set_default_event_id,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/events", tags=["personnel"])


def _db_error_detail(exc: Exception) -> str | None:
    msg = str(exc).lower()
    if "enrolledperson" in msg and ("does not exist" in msg or "undefinedtable" in msg):
        return "Personnel tables are missing. Run: npm run db:push"
    if "personnelrole" in msg and "does not exist" in msg:
        return "Personnel role enum is missing. Run: npm run db:push"
    return None


async def _get_event(db: AsyncSession, slug: str) -> Event:
    result = await db.execute(select(Event).where(Event.slug == slug))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _map_enrolled(row: EnrolledPerson) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "designation": row.designation,
        "role": row.role.value,
        "photoUrl": row.photoUrl,
        "active": row.active,
        "enrolled": row.embeddingJson is not None,
        "createdAt": row.createdAt.isoformat() if row.createdAt else None,
    }


@router.get("/{slug}/personnel/enrolled")
async def list_enrolled(slug: str, db: AsyncSession = Depends(get_db)):
    try:
        event = await _get_event(db, slug)
        result = await db.execute(
            select(EnrolledPerson)
            .where(EnrolledPerson.eventId == event.id)
            .order_by(EnrolledPerson.createdAt.desc())
        )
        rows = result.scalars().all()
        return {"personnel": [_map_enrolled(r) for r in rows]}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("list_enrolled failed for slug=%s", slug)
        hint = _db_error_detail(exc)
        raise HTTPException(
            status_code=503 if hint else 500,
            detail=hint or "Failed to load personnel registry. Restart the API (npm run api:dev).",
        ) from exc


@router.post("/{slug}/personnel/enrolled")
async def enroll_person(slug: str, body: dict, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)

    name = (body.get("name") or "").strip()
    designation = (body.get("designation") or "").strip()
    role_str = (body.get("role") or "staff").strip().lower()
    photo_url = body.get("photoUrl") or body.get("photo")

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not designation:
        raise HTTPException(status_code=400, detail="Designation is required")
    if not photo_url or not isinstance(photo_url, str):
        raise HTTPException(status_code=400, detail="Portrait photo is required")

    try:
        role = PersonnelRole(role_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Role must be guard, vip, staff, or contractor",
        ) from exc

    try:
        from app.services.face_recognition import embedding_from_photo, to_numpy_embedding

        embedding_list, _ = embedding_from_photo(photo_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Face enrollment failed for %s", name)
        raise HTTPException(
            status_code=500,
            detail=(
                "Face processing failed. Ensure the API was restarted after setup and "
                "opencv models can download. Use a clear front-facing portrait."
            ),
        ) from exc

    person = EnrolledPerson(
        id=str(uuid.uuid4()),
        eventId=event.id,
        name=name,
        designation=designation,
        role=role,
        photoUrl=photo_url,
        embeddingJson=embedding_list,
        active=True,
    )
    db.add(person)
    await db.commit()
    await db.refresh(person)

    from app.services.face_recognition import to_numpy_embedding

    add_to_gallery(
        event.id,
        EnrolledRecord(
            id=person.id,
            name=person.name,
            designation=person.designation,
            role=person.role.value,
            photo_url=person.photoUrl,
            embedding=to_numpy_embedding(embedding_list),
        ),
    )
    set_default_event_id(event.id)

    return {"ok": True, "person": _map_enrolled(person)}


@router.delete("/{slug}/personnel/enrolled/{person_id}")
async def delete_enrolled(person_id: str, slug: str, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    result = await db.execute(
        select(EnrolledPerson).where(
            EnrolledPerson.id == person_id,
            EnrolledPerson.eventId == event.id,
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    await db.delete(person)
    await db.commit()
    remove_from_gallery(event.id, person_id)
    return {"ok": True}


@router.post("/{slug}/personnel/enrolled/reload")
async def reload_enrolled_gallery(slug: str, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    count = await reload_gallery_for_event(db, event.id)
    set_default_event_id(event.id)
    return {"ok": True, "loaded": count}


@router.get("/{slug}/personnel/enrolled/status")
async def enrolled_gallery_status(slug: str, db: AsyncSession = Depends(get_db)):
    """Debug: how many enrolled faces are loaded for live matching."""
    from app.services.enrollment_gallery import get_default_event_id, get_gallery

    event = await _get_event(db, slug)
    gallery = get_gallery(event.id)
    return {
        "eventId": event.id,
        "slug": slug,
        "galleryLoaded": len(gallery),
        "defaultEventId": get_default_event_id(),
        "names": [r.name for r in gallery],
    }
