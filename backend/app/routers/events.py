from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import (
    Alert,
    BlindSpot,
    Blueprint,
    BlueprintMarker,
    Camera,
    CameraStatus,
    Event,
    Incident,
    IncidentStatus,
    Recommendation,
    Venue,
)
from app.services.mappers import map_alert, map_camera, map_incident, map_marker_type, to_db_marker_type
from app.services.blueprint_analyzer import analyze_blueprint_image
from app.services.coverage_engine import analyze_coverage
import uuid

router = APIRouter(prefix="/api/v1/events", tags=["events"])

SECURITY_SUMMARIES = [
    {"title": "Perimeter Status", "value": "Secure", "change": 2, "icon": "shield"},
    {"title": "VIP Route Clear", "value": "Active", "change": 0, "icon": "route"},
    {"title": "Guard Deployment", "value": "18/20", "change": -1, "icon": "users"},
    {"title": "Response Time", "value": "2.4 min", "change": -12, "icon": "clock"},
]


async def _get_event(db: AsyncSession, slug: str) -> Event:
    result = await db.execute(select(Event).where(Event.slug == slug))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.get("/{slug}/dashboard")
async def get_dashboard(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Event)
        .where(Event.slug == slug)
        .options(
            selectinload(Event.cameras),
            selectinload(Event.alerts),
            selectinload(Event.activeThreats),
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    cameras_online = sum(1 for c in event.cameras if c.status == CameraStatus.online)
    active_alerts = sum(1 for a in event.alerts if not a.acknowledged)

    return {
        "kpis": {
            "threatLevel": event.threatLevel.value,
            "securityScore": event.securityScore,
            "activeAlerts": active_alerts,
            "camerasOnline": cameras_online,
            "totalCameras": len(event.cameras),
        },
        "threatTrend": event.threatTrendJson,
        "riskDistribution": event.riskDistributionJson,
        "activeThreats": [
            {
                "id": t.externalId,
                "type": t.type,
                "location": t.location,
                "level": t.level.value,
                "detectedAt": t.detectedAt.isoformat(),
                "confidence": t.confidence,
            }
            for t in event.activeThreats
        ],
        "recentAlerts": [map_alert(a) for a in sorted(event.alerts, key=lambda x: x.timestamp, reverse=True)[:5]],
        "securitySummaries": SECURITY_SUMMARIES,
    }


@router.get("/{slug}/cameras")
async def get_cameras(slug: str, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    result = await db.execute(
        select(Camera).where(Camera.eventId == event.id).order_by(Camera.id)
    )
    cameras = result.scalars().all()
    return {"cameras": [map_camera(c) for c in cameras]}


@router.get("/{slug}/incidents")
async def get_incidents(slug: str, status: str | None = None, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    query = select(Incident).where(Incident.eventId == event.id).order_by(Incident.time.desc())
    if status and status != "all":
        query = query.where(Incident.status == IncidentStatus(status))
    result = await db.execute(query)
    incidents = result.scalars().all()
    return {"incidents": [map_incident(i) for i in incidents]}


@router.get("/{slug}/alerts")
async def get_alerts(slug: str, active: bool = False, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    query = select(Alert).where(Alert.eventId == event.id).order_by(Alert.timestamp.desc())
    if active:
        query = query.where(Alert.acknowledged.is_(False))
    result = await db.execute(query)
    alerts = result.scalars().all()
    return {"alerts": [map_alert(a) for a in alerts]}


@router.get("/{slug}/blueprint")
async def get_blueprint(slug: str, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    result = await db.execute(
        select(Venue)
        .where(Venue.eventId == event.id)
        .options(
            selectinload(Venue.blueprints).selectinload(Blueprint.markers),
            selectinload(Venue.blueprints).selectinload(Blueprint.blindSpots),
        )
    )
    venue = result.scalar_one_or_none()
    if not venue or not venue.blueprints:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    bp = sorted(venue.blueprints, key=lambda b: b.createdAt, reverse=True)[0]
    return {
        "venue": {
            "name": venue.name,
            "floorLevel": venue.floorLevel,
        },
        "blueprint": {
            "id": bp.id,
            "name": bp.name,
            "type": bp.type,
            "storageUrl": bp.storageUrl,
            "firebasePath": bp.firebasePath,
            "coveragePct": bp.coveragePct,
            "vulnerabilityScore": bp.vulnerabilityScore,
            "markers": [
                {
                    "id": m.id,
                    "type": map_marker_type(m.type),
                    "x": m.x,
                    "y": m.y,
                    "label": m.label,
                }
                for m in bp.markers
            ],
            "blindSpots": [
                {
                    "id": b.id,
                    "x": b.x,
                    "y": b.y,
                    "width": b.width,
                    "height": b.height,
                    "severity": b.severity.value,
                    "description": b.description,
                }
                for b in bp.blindSpots
            ],
        }
    }


@router.post("/{slug}/blueprint")
async def update_blueprint(slug: str, body: dict, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    result = await db.execute(
        select(Venue)
        .where(Venue.eventId == event.id)
        .options(selectinload(Venue.blueprints))
    )
    venue = result.scalar_one_or_none()
    if not venue or not venue.blueprints:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    bp = sorted(venue.blueprints, key=lambda b: b.createdAt, reverse=True)[0]
    action = body.get("action")

    if action == "auto-detect":
        replace = body.get("replace", True)
        image_source = body.get("storageUrl") or bp.storageUrl
        if not image_source:
            raise HTTPException(
                status_code=400,
                detail="Upload a blueprint image before running auto-detection",
            )

        result = analyze_blueprint_image(image_source)
        detected = result.get("markers", [])

        if replace:
            await db.execute(delete(BlueprintMarker).where(BlueprintMarker.blueprintId == bp.id))

        saved: list[dict] = []
        for det in detected:
            marker_id = str(uuid.uuid4())
            marker = BlueprintMarker(
                id=marker_id,
                blueprintId=bp.id,
                type=to_db_marker_type(det["type"]),
                x=float(det["x"]),
                y=float(det["y"]),
                label=str(det["label"]),
            )
            db.add(marker)
            saved.append(
                {
                    "id": marker_id,
                    "type": det["type"],
                    "x": float(det["x"]),
                    "y": float(det["y"]),
                    "label": str(det["label"]),
                }
            )

        await db.commit()
        return {"ok": True, "markers": saved, "summary": result.get("summary", {})}

    if action == "add-marker":
        marker = BlueprintMarker(
            id=str(uuid.uuid4()),
            blueprintId=bp.id,
            type=to_db_marker_type(body["type"]),
            x=body["x"],
            y=body["y"],
            label=body["label"],
        )
        db.add(marker)
        await db.commit()
        await db.refresh(marker)
        return {
            "marker": {
                "id": marker.id,
                "type": map_marker_type(marker.type),
                "x": marker.x,
                "y": marker.y,
                "label": marker.label,
            }
        }

    if action == "update-storage":
        bp.storageUrl = body.get("storageUrl")
        bp.firebasePath = body.get("firebasePath")
        if body.get("name"):
            bp.name = body["name"]
        if body.get("type"):
            bp.type = body["type"]
        await db.commit()
        return {"ok": True, "blueprintId": bp.id}

    if action == "delete-marker":
        marker_id = body.get("markerId")
        if not marker_id:
            raise HTTPException(status_code=400, detail="markerId required")
        result = await db.execute(
            select(BlueprintMarker).where(
                BlueprintMarker.id == marker_id,
                BlueprintMarker.blueprintId == bp.id,
            )
        )
        marker = result.scalar_one_or_none()
        if not marker:
            raise HTTPException(status_code=404, detail="Marker not found")
        await db.delete(marker)
        await db.commit()
        return {"ok": True}

    raise HTTPException(status_code=400, detail="Unknown action")


@router.post("/{slug}/coverage/analyze")
async def analyze_event_coverage(slug: str, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    result = await db.execute(
        select(Venue)
        .where(Venue.eventId == event.id)
        .options(
            selectinload(Venue.blueprints).selectinload(Blueprint.markers),
            selectinload(Venue.blueprints).selectinload(Blueprint.blindSpots),
        )
    )
    venue = result.scalar_one_or_none()
    if not venue or not venue.blueprints:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    bp = sorted(venue.blueprints, key=lambda b: b.createdAt, reverse=True)[0]
    markers = [
        {
            "id": m.id,
            "type": map_marker_type(m.type),
            "x": m.x,
            "y": m.y,
            "label": m.label,
        }
        for m in bp.markers
    ]
    analysis = analyze_coverage(markers)

    bp.coveragePct = analysis["coveragePercentage"]
    bp.vulnerabilityScore = analysis["vulnerabilityScore"]

    await db.execute(delete(BlindSpot).where(BlindSpot.blueprintId == bp.id))

    for spot in analysis["blindSpots"]:
        db.add(
            BlindSpot(
                id=str(uuid.uuid4()),
                blueprintId=bp.id,
                x=spot["x"],
                y=spot["y"],
                width=spot["width"],
                height=spot["height"],
                severity=spot["severity"],
                description=spot["description"],
            )
        )

    await db.commit()

    rec_result = await db.execute(
        select(Recommendation).where(Recommendation.eventId == event.id)
    )
    recommendations = rec_result.scalars().all()

    return {
        "metrics": {
            "coveragePercentage": analysis["coveragePercentage"],
            "blindSpotsFound": analysis["blindSpotsFound"],
            "vulnerabilityScore": analysis["vulnerabilityScore"],
        },
        "coverageAreas": analysis["coverageAreas"],
        "blindSpots": analysis["blindSpots"],
        "recommendations": [
            {
                "id": r.id,
                "type": r.type.value,
                "title": r.title,
                "description": r.description,
                "priority": r.priority.value,
                "location": r.location,
            }
            for r in recommendations
        ],
    }
