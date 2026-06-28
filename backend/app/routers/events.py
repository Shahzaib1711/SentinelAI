from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import (
    ActiveThreat,
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
    RiskZone,
    ThreatLevel,
    Venue,
)
from app.services.mappers import map_alert, map_camera, map_incident, map_marker_type, to_db_marker_type
from app.services.blueprint_analyzer import analyze_blueprint_image
from app.services.coverage_engine import analyze_coverage
from app.services.security_planner import build_security_plan
from app.services.threat_intelligence import build_threat_intelligence
from app.services.personnel_store import get_all_personnel, get_personnel_summary
from app.services.enrollment_gallery import reload_gallery_for_event, set_default_event_id
from app.services.unknown_faces_gallery import reload_gallery_for_event as reload_detected_gallery
import re
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/api/v1/events", tags=["events"])

SECURITY_SUMMARIES = [
    {"title": "Perimeter Status", "value": "Secure", "change": 2, "icon": "shield"},
    {"title": "VIP Route Clear", "value": "Active", "change": 0, "icon": "route"},
    {"title": "Guard Deployment", "value": "18/20", "change": -1, "icon": "users"},
    {"title": "Response Time", "value": "2.4 min", "change": -12, "icon": "clock"},
]


def _coerce_threat_level(value: str | ThreatLevel) -> ThreatLevel:
    if isinstance(value, ThreatLevel):
        return value
    try:
        return ThreatLevel(str(value).lower())
    except ValueError:
        return ThreatLevel.medium


async def _get_event(db: AsyncSession, slug: str) -> Event:
    result = await db.execute(select(Event).where(Event.slug == slug))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


class CreateEventBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    venueName: str = Field(min_length=1, max_length=200)
    eventDate: str
    slug: str | None = Field(default=None, max_length=80)
    floorLevel: str = Field(default="L1", max_length=40)
    threatLevel: str = "medium"
    vipCount: int = Field(default=0, ge=0)
    attendees: int = Field(default=0, ge=0)
    securityPersonnel: int = Field(default=0, ge=0)


def _parse_event_date(value: str) -> datetime:
    raw = value.strip()
    if len(raw) == 10:
        raw = f"{raw}T00:00:00"
    dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (slug[:55] or "event").strip("-")


async def _unique_slug(db: AsyncSession, base: str) -> str:
    slug = base
    suffix = 2
    while True:
        result = await db.execute(select(Event.id).where(Event.slug == slug).limit(1))
        if result.scalar_one_or_none() is None:
            return slug
        slug = f"{base}-{suffix}"
        suffix += 1


def _event_summary(
    event: Event,
    *,
    has_floor_plan: bool = False,
    floor_level: str | None = None,
    blueprint_id: str | None = None,
) -> dict:
    return {
        "id": event.id,
        "slug": event.slug,
        "name": event.name,
        "venueName": event.venueName,
        "eventDate": event.eventDate.isoformat(),
        "threatLevel": event.threatLevel.value,
        "securityScore": event.securityScore,
        "vipCount": event.vipCount,
        "attendees": event.attendees,
        "securityPersonnel": event.securityPersonnel,
        "hasFloorPlan": has_floor_plan,
        "floorLevel": floor_level,
        "blueprintId": blueprint_id,
    }


@router.get("")
async def list_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Event)
        .options(selectinload(Event.venue).selectinload(Venue.blueprints))
        .order_by(Event.createdAt.desc())
    )
    events = result.scalars().all()
    items: list[dict] = []
    for event in events:
        has_floor_plan = False
        floor_level = None
        blueprint_id = None
        if event.venue:
            floor_level = event.venue.floorLevel
            if event.venue.blueprints:
                bp = sorted(event.venue.blueprints, key=lambda b: b.createdAt, reverse=True)[0]
                blueprint_id = bp.id
                has_floor_plan = bool(bp.storageUrl)
        items.append(
            _event_summary(
                event,
                has_floor_plan=has_floor_plan,
                floor_level=floor_level,
                blueprint_id=blueprint_id,
            )
        )
    return {"events": items}


@router.post("")
async def create_event(body: CreateEventBody, db: AsyncSession = Depends(get_db)):
    base_slug = _slugify(body.slug or body.name)
    slug = await _unique_slug(db, base_slug)
    event_id = str(uuid.uuid4())
    venue_id = str(uuid.uuid4())
    blueprint_id = str(uuid.uuid4())

    event = Event(
        id=event_id,
        slug=slug,
        name=body.name.strip(),
        venueName=body.venueName.strip(),
        eventDate=_parse_event_date(body.eventDate),
        threatLevel=_coerce_threat_level(body.threatLevel),
        securityScore=75,
        vipCount=body.vipCount,
        attendees=body.attendees,
        securityPersonnel=body.securityPersonnel,
    )
    venue = Venue(
        id=venue_id,
        eventId=event_id,
        name=body.venueName.strip(),
        floorLevel=body.floorLevel.strip() or "L1",
    )
    blueprint = Blueprint(
        id=blueprint_id,
        venueId=venue_id,
        name="Main Floor Plan",
        type="floor_plan",
        coveragePct=0,
        vulnerabilityScore=100,
    )

    db.add(event)
    db.add(venue)
    db.add(blueprint)
    await db.commit()

    try:
        await reload_gallery_for_event(db, event_id)
        await reload_detected_gallery(db, event_id)
        set_default_event_id(event_id)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning(
            "Event %s created; gallery preload skipped: %s", slug, exc
        )

    return {
        "ok": True,
        "event": _event_summary(
            event,
            has_floor_plan=False,
            floor_level=venue.floorLevel,
            blueprint_id=blueprint_id,
        ),
    }


@router.get("/{slug}")
async def get_event(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Event)
        .where(Event.slug == slug)
        .options(selectinload(Event.venue).selectinload(Venue.blueprints))
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    has_floor_plan = False
    floor_level = None
    blueprint_id = None
    if event.venue:
        floor_level = event.venue.floorLevel
        if event.venue.blueprints:
            bp = sorted(event.venue.blueprints, key=lambda b: b.createdAt, reverse=True)[0]
            blueprint_id = bp.id
            has_floor_plan = bool(bp.storageUrl)

    return {
        "event": _event_summary(
            event,
            has_floor_plan=has_floor_plan,
            floor_level=floor_level,
            blueprint_id=blueprint_id,
        )
    }


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


class CreateIncidentBody(BaseModel):
    location: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    threatLevel: str = "medium"
    assignedTo: str = Field(default="Unassigned", max_length=200)
    status: str = "open"
    cameraId: str | None = None


@router.get("/{slug}/incidents")
async def get_incidents(slug: str, status: str | None = None, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, slug)
    query = select(Incident).where(Incident.eventId == event.id).order_by(Incident.time.desc())
    if status and status != "all":
        query = query.where(Incident.status == IncidentStatus(status))
    result = await db.execute(query)
    incidents = result.scalars().all()
    return {"incidents": [map_incident(i) for i in incidents]}


@router.post("/{slug}/incidents")
async def create_incident(
    slug: str, body: CreateIncidentBody, db: AsyncSession = Depends(get_db)
):
    event = await _get_event(db, slug)

    if body.cameraId:
        cam_result = await db.execute(
            select(Camera).where(Camera.id == body.cameraId, Camera.eventId == event.id)
        )
        if cam_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Camera not found for this event")

    incident_id = f"INC-{datetime.now(timezone.utc).strftime('%Y')}-{uuid.uuid4().hex[:4].upper()}"
    incident = Incident(
        id=incident_id,
        eventId=event.id,
        time=datetime.now(timezone.utc),
        location=body.location.strip(),
        threatLevel=_coerce_threat_level(body.threatLevel),
        status=IncidentStatus(body.status),
        description=body.description.strip(),
        assignedTo=body.assignedTo.strip() or "Unassigned",
        cameraId=body.cameraId,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return {"incident": map_incident(incident)}


@router.get("/{slug}/threat-intelligence")
async def get_threat_intelligence(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Event)
        .where(Event.slug == slug)
        .options(
            selectinload(Event.riskZones),
            selectinload(Event.activeThreats),
            selectinload(Event.incidents),
            selectinload(Event.alerts),
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    intel = build_threat_intelligence(
        risk_distribution_json=event.riskDistributionJson,
        risk_zones=list(event.riskZones),
        active_threats=list(event.activeThreats),
        incidents=list(event.incidents),
        alerts=list(event.alerts),
    )
    return {"intelligence": intel}


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

        result = analyze_blueprint_image(
            image_source,
            confidence=body.get("confidence"),
            labels=body.get("labels"),
        )
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
        return {
            "ok": True,
            "markers": saved,
            "layout": result.get("layout", {}),
            "summary": result.get("summary", {}),
        }

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


@router.get("/{slug}/personnel/live")
async def get_live_personnel(slug: str, db: AsyncSession = Depends(get_db)):
    await _get_event(db, slug)
    return {
        "summary": get_personnel_summary(),
        "personnel": get_all_personnel(),
    }


@router.post("/{slug}/security/plan")
async def create_security_plan(slug: str, body: dict, db: AsyncSession = Depends(get_db)):
    """
    Read the uploaded floor plan, apply operator instructions, and produce a
    blueprint security analysis with guard/camera deployment proposals.
    """
    result = await db.execute(
        select(Event)
        .where(Event.slug == slug)
        .options(
            selectinload(Event.venue).selectinload(Venue.blueprints).selectinload(Blueprint.markers),
            selectinload(Event.venue).selectinload(Venue.blueprints).selectinload(Blueprint.blindSpots),
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    venue = event.venue
    if not venue or not venue.blueprints:
        raise HTTPException(status_code=404, detail="Blueprint not found — upload a floor plan in Venue Setup")

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
    blind_spots = [
        {
            "x": b.x,
            "y": b.y,
            "width": b.width,
            "height": b.height,
            "severity": b.severity.value,
            "description": b.description,
        }
        for b in bp.blindSpots
    ]

    try:
        plan = build_security_plan(
            image_source=bp.storageUrl,
            existing_markers=markers,
            existing_blind_spots=blind_spots,
            event={
                "name": event.name,
                "threatLevel": event.threatLevel.value,
                "vipCount": event.vipCount,
                "attendees": event.attendees,
                "securityPersonnel": event.securityPersonnel,
            },
            instructions=str(body.get("instructions") or ""),
        )
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception("Security plan generation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Security planning failed: {exc}",
        ) from exc

    if body.get("persist"):
        for proposal in plan.get("proposedGuards", []) + plan.get("proposedCameras", []):
            marker = BlueprintMarker(
                id=str(uuid.uuid4()),
                blueprintId=bp.id,
                type=to_db_marker_type(proposal["type"]),
                x=float(proposal["x"]),
                y=float(proposal["y"]),
                label=str(proposal.get("label", proposal["type"].upper())),
            )
            db.add(marker)

        simulated = markers + [
            {"type": g["type"], "x": g["x"], "y": g["y"], "id": f"p{i}"}
            for i, g in enumerate(plan.get("proposedGuards", []))
        ] + [
            {
                "type": c["type"],
                "x": c["x"],
                "y": c["y"],
                "id": f"c{i}",
                "facing": c.get("facing", 90.0),
                "angle": c.get("angle", 90.0),
                "radius": c.get("radius", 22.0),
            }
            for i, c in enumerate(plan.get("proposedCameras", []))
        ]
        bounds = (plan.get("layout") or {}).get("blueprintBounds")
        analysis = analyze_coverage(simulated, bounds)
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
                    severity=_coerce_threat_level(spot["severity"]),
                    description=spot["description"],
                )
            )
        await db.commit()
        plan["persisted"] = True

    return {"ok": True, "plan": plan}


async def _load_blueprint_context(db: AsyncSession, slug: str):
    """Shared loader for security planning endpoints."""
    result = await db.execute(
        select(Event)
        .where(Event.slug == slug)
        .options(
            selectinload(Event.venue).selectinload(Venue.blueprints).selectinload(Blueprint.markers),
            selectinload(Event.venue).selectinload(Venue.blueprints).selectinload(Blueprint.blindSpots),
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    venue = event.venue
    if not venue or not venue.blueprints:
        raise HTTPException(status_code=404, detail="Blueprint not found — upload a floor plan in Venue Setup")

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
    blind_spots = [
        {
            "x": b.x,
            "y": b.y,
            "width": b.width,
            "height": b.height,
            "severity": b.severity.value,
            "description": b.description,
        }
        for b in bp.blindSpots
    ]
    event_ctx = {
        "name": event.name,
        "threatLevel": event.threatLevel.value,
        "vipCount": event.vipCount,
        "attendees": event.attendees,
        "securityPersonnel": event.securityPersonnel,
    }
    return event, bp, markers, blind_spots, event_ctx


@router.post("/{slug}/security/plan/chat")
async def security_plan_chat(slug: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Chat with the security agent to refine guard deployment and coverage."""
    event, bp, markers, blind_spots, event_ctx = await _load_blueprint_context(db, slug)

    message = str(body.get("message") or "").strip()
    history = body.get("history") or []
    if not isinstance(history, list):
        history = []

    result = process_security_chat(
        message,
        history,
        base_instructions=str(body.get("instructions") or ""),
        image_source=bp.storageUrl,
        existing_markers=markers,
        existing_blind_spots=blind_spots,
        event=event_ctx,
        previous_plan=body.get("previousPlan"),
    )

    if body.get("persist") and result.get("plan"):
        plan = result["plan"]
        for proposal in plan.get("proposedGuards", []) + plan.get("proposedCameras", []):
            marker = BlueprintMarker(
                id=str(uuid.uuid4()),
                blueprintId=bp.id,
                type=to_db_marker_type(proposal["type"]),
                x=float(proposal["x"]),
                y=float(proposal["y"]),
                label=str(proposal.get("label", proposal["type"].upper())),
            )
            db.add(marker)

        simulated = markers + [
            {"type": g["type"], "x": g["x"], "y": g["y"], "id": f"p{i}"}
            for i, g in enumerate(plan.get("proposedGuards", []))
        ] + [
            {
                "type": c["type"],
                "x": c["x"],
                "y": c["y"],
                "id": f"c{i}",
                "facing": c.get("facing", 90.0),
                "angle": c.get("angle", 90.0),
                "radius": c.get("radius", 22.0),
            }
            for i, c in enumerate(plan.get("proposedCameras", []))
        ]
        bounds = (plan.get("layout") or {}).get("blueprintBounds")
        analysis = analyze_coverage(simulated, bounds)
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
                    severity=_coerce_threat_level(spot["severity"]),
                    description=spot["description"],
                )
            )
        await db.commit()
        result["persisted"] = True

    return {"ok": True, **result}
