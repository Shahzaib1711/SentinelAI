"""Staff / VIP enrollment with face photo registration."""

from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import DetectedPerson, EnrolledPerson, Event, PersonnelRole
from app.services.enrollment_gallery import (
    EnrolledRecord,
    add_to_gallery,
    reload_gallery_for_event,
    remove_from_gallery,
    set_default_event_id,
    update_gallery_record,
)
from app.services.unknown_faces_gallery import reload_gallery_for_event as reload_detected_gallery
from app.services.unknown_faces_gallery import remove_from_gallery as remove_detected_from_gallery
from app.services.bulk_enrollment import (
    RosterParseError,
    _data_url_from_bytes,
    _ensure_csv_field_limit,
    parse_roster_file,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/events", tags=["personnel"])


def _db_error_detail(exc: Exception) -> str | None:
    msg = str(exc).lower()
    if "enrolledperson" in msg and ("does not exist" in msg or "undefinedtable" in msg):
        return "Personnel tables are missing. Run: npm run db:push"
    if "detectedperson" in msg and ("does not exist" in msg or "undefinedtable" in msg):
        return "Detected persons table is missing. Run: npm run db:push"
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


def _map_enrolled_brief(row: EnrolledPerson) -> dict:
    """Lightweight row for bulk import responses (no base64 photo payload)."""
    return {
        "id": row.id,
        "name": row.name,
        "designation": row.designation,
        "role": row.role.value,
        "enrolled": row.embeddingJson is not None,
    }


def _extract_face_embedding(photo_url: str) -> list[float]:
    from app.services.face_recognition import embedding_from_photo

    embedding_list, _ = embedding_from_photo(photo_url)
    return embedding_list


async def _persist_enrolled_person(
    db: AsyncSession,
    event: Event,
    *,
    name: str,
    designation: str,
    role: PersonnelRole,
    photo_url: str,
) -> EnrolledPerson:
    from app.services.face_recognition import to_numpy_embedding

    embedding_list = await asyncio.to_thread(_extract_face_embedding, photo_url)

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
    await db.flush()

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
    return person


async def _run_bulk_enroll(
    slug: str,
    file: UploadFile,
    db: AsyncSession,
) -> dict:
    event = await _get_event(db, slug)
    filename = file.filename or "roster.docx"
    content = await file.read()
    _ensure_csv_field_limit()

    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Roster file must be under 50MB")

    try:
        parsed = await asyncio.to_thread(parse_roster_file, filename, content)
    except RosterParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Roster parse failed for %s", filename)
        raise HTTPException(
            status_code=400,
            detail=f"Could not read roster file: {exc}",
        ) from exc

    if not parsed:
        raise HTTPException(status_code=400, detail="No people found in roster document.")

    results: list[dict] = []
    enrolled_people: list[EnrolledPerson] = []

    for entry in parsed:
        try:
            role = PersonnelRole(entry.role)
        except ValueError:
            results.append(
                {
                    "name": entry.name,
                    "row": entry.row_index,
                    "status": "error",
                    "error": f"Invalid role '{entry.role}' — use guard, vip, staff, or contractor",
                }
            )
            continue

        photo_url = _data_url_from_bytes(entry.photo_bytes, entry.photo_mime)
        try:
            person = await _persist_enrolled_person(
                db,
                event,
                name=entry.name,
                designation=entry.designation,
                role=role,
                photo_url=photo_url,
            )
            await db.commit()
            await db.refresh(person)
            enrolled_people.append(person)
            results.append(
                {
                    "name": entry.name,
                    "row": entry.row_index,
                    "status": "ok",
                    "personId": person.id,
                }
            )
        except ValueError as exc:
            await db.rollback()
            results.append(
                {
                    "name": entry.name,
                    "row": entry.row_index,
                    "status": "error",
                    "error": str(exc),
                }
            )
        except Exception:
            await db.rollback()
            logger.exception("Bulk enroll failed for %s", entry.name)
            results.append(
                {
                    "name": entry.name,
                    "row": entry.row_index,
                    "status": "error",
                    "error": "Face processing failed for this portrait",
                }
            )

    ok_count = sum(1 for r in results if r["status"] == "ok")
    fail_count = len(results) - ok_count

    return {
        "ok": ok_count > 0,
        "parsed": len(parsed),
        "enrolled": ok_count,
        "failed": fail_count,
        "results": results,
        "personnel": [_map_enrolled_brief(p) for p in enrolled_people],
    }


def _map_detected(row: DetectedPerson) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "photoUrl": row.photoUrl,
        "cameraId": row.cameraId,
        "sightingCount": row.sightingCount,
        "firstSeenAt": row.firstSeenAt.isoformat() if row.firstSeenAt else None,
        "lastSeenAt": row.lastSeenAt.isoformat() if row.lastSeenAt else None,
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


@router.post("/{slug}/personnel/enrolled/bulk")
async def bulk_enroll_personnel(
    slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Import roster document — must be registered before /{person_id} routes."""
    try:
        return await _run_bulk_enroll(slug, file, db)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Bulk enrollment failed for slug=%s", slug)
        raise HTTPException(
            status_code=500,
            detail=f"Bulk import failed: {exc}",
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
        person = await _persist_enrolled_person(
            db,
            event,
            name=name,
            designation=designation,
            role=role,
            photo_url=photo_url,
        )
        await db.commit()
        await db.refresh(person)
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

    return {"ok": True, "person": _map_enrolled(person)}


@router.patch("/{slug}/personnel/enrolled/{person_id}")
async def update_enrolled(
    person_id: str, slug: str, body: dict, db: AsyncSession = Depends(get_db)
):
    """Update enrolled person metadata (e.g. promote to VIP) for live recognition."""
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

    if "name" in body and body["name"]:
        person.name = str(body["name"]).strip()
    if "designation" in body and body["designation"]:
        person.designation = str(body["designation"]).strip()
    if "role" in body and body["role"]:
        try:
            person.role = PersonnelRole(str(body["role"]).strip().lower())
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="Role must be guard, vip, staff, or contractor",
            ) from exc

    await db.commit()
    await db.refresh(person)

    update_gallery_record(
        event.id,
        person.id,
        name=person.name,
        designation=person.designation,
        role=person.role.value,
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
    detected_count = await reload_detected_gallery(db, event.id)
    set_default_event_id(event.id)
    return {"ok": True, "loaded": count, "detectedLoaded": detected_count}


@router.get("/{slug}/personnel/detected")
async def list_detected(slug: str, db: AsyncSession = Depends(get_db)):
    try:
        event = await _get_event(db, slug)
        result = await db.execute(
            select(DetectedPerson)
            .where(DetectedPerson.eventId == event.id)
            .order_by(DetectedPerson.lastSeenAt.desc())
        )
        rows = result.scalars().all()
        return {"detected": [_map_detected(r) for r in rows]}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("list_detected failed for slug=%s", slug)
        hint = _db_error_detail(exc)
        raise HTTPException(
            status_code=503 if hint else 500,
            detail=hint or "Failed to load detected persons.",
        ) from exc


@router.delete("/{slug}/personnel/detected/{person_id}")
async def delete_detected(person_id: str, slug: str, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    result = await db.execute(
        select(DetectedPerson).where(
            DetectedPerson.id == person_id,
            DetectedPerson.eventId == event.id,
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Detected person not found")

    await db.delete(person)
    await db.commit()
    remove_detected_from_gallery(event.id, person_id)
    return {"ok": True}


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
