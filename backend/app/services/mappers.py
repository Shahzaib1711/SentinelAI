from app.models.models import Alert, Camera, Incident, MarkerType


def map_camera(c: Camera) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "location": c.location,
        "status": c.status.value if hasattr(c.status, "value") else c.status,
        "coverage": c.coverage,
        "useWebRTC": c.useWebRTC,
        "feedUrl": c.streamUrl,
    }


def map_alert(a: Alert) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "level": a.level.value if hasattr(a.level, "value") else a.level,
        "location": a.location,
        "timestamp": a.timestamp.isoformat(),
        "acknowledged": a.acknowledged,
    }


def map_incident(i: Incident) -> dict:
    return {
        "id": i.id,
        "time": i.time.isoformat(),
        "location": i.location,
        "threatLevel": i.threatLevel.value if hasattr(i.threatLevel, "value") else i.threatLevel,
        "status": i.status.value if hasattr(i.status, "value") else i.status,
        "description": i.description,
        "assignedTo": i.assignedTo,
        "cameraId": i.cameraId,
        "resolution": i.resolution,
    }


def map_marker_type(marker_type: MarkerType) -> str:
    if marker_type == MarkerType.vip_route:
        return "vip-route"
    return marker_type.value if hasattr(marker_type, "value") else str(marker_type)


def to_db_marker_type(marker_type: str) -> MarkerType:
    if marker_type == "vip-route":
        return MarkerType.vip_route
    return MarkerType(marker_type)
