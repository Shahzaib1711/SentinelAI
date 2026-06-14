"""Classify detected persons as guard / VIP / visitor and map to blueprint coordinates."""

from __future__ import annotations

import math
import time
from typing import Any

from app.services.camera_zones import (
    DEFAULT_CAMERA_BLUEPRINT,
    classify_at_point,
)
from app.services.enrollment_gallery import identify_person_in_frame, resolve_event_id_for_matching

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None  # type: ignore[assignment]

# Per-camera simple centroid tracker
_tracks: dict[str, dict[int, dict[str, float]]] = {}
_next_track_id: dict[str, int] = {}
TRACK_MATCH_PCT = 10.0
TRACK_STALE_MS = 4_000

_ROLE_LABELS = {
    "guard": "Guard",
    "vip": "VIP",
    "restricted": "Restricted",
    "entrance": "Entrance",
    "visitor": "Visitor",
}

_ROLE_TYPES = {
    "guard": "guard",
    "vip": "vip",
    "restricted": "person",
    "entrance": "person",
    "visitor": "person",
}


def _centroid(det: dict[str, Any]) -> tuple[float, float]:
    x = float(det.get("x", 0))
    y = float(det.get("y", 0))
    w = float(det.get("width", 15))
    h = float(det.get("height", 20))
    return x + w / 2, y + h / 2


def _foot_point(det: dict[str, Any]) -> tuple[float, float]:
    """Bottom-center of bbox — best proxy for where someone is standing."""
    x = float(det.get("x", 0))
    y = float(det.get("y", 0))
    w = float(det.get("width", 15))
    h = float(det.get("height", 20))
    return x + w / 2, y + h


def _is_standing(det: dict[str, Any]) -> bool:
    w = max(float(det.get("width", 1)), 0.1)
    h = max(float(det.get("height", 1)), 0.1)
    _, foot_y = _foot_point(det)
    aspect = h / w
    # Upright bbox with feet in lower portion of frame ≈ standing
    return aspect >= 1.15 and foot_y >= 45.0


def _assign_track_id(camera_id: str, cx: float, cy: float) -> int:
    now = time.time() * 1000
    tracks = _tracks.setdefault(camera_id, {})

    stale = [tid for tid, t in tracks.items() if now - t["last_seen"] > TRACK_STALE_MS]
    for tid in stale:
        del tracks[tid]

    best_id: int | None = None
    best_dist = TRACK_MATCH_PCT

    for tid, t in tracks.items():
        dist = math.hypot(cx - t["cx"], cy - t["cy"])
        if dist < best_dist:
            best_dist = dist
            best_id = tid

    if best_id is not None:
        tracks[best_id]["cx"] = cx
        tracks[best_id]["cy"] = cy
        tracks[best_id]["last_seen"] = now
        return best_id

    tid = _next_track_id.get(camera_id, 1)
    _next_track_id[camera_id] = tid + 1
    tracks[tid] = {"cx": cx, "cy": cy, "last_seen": now}
    return tid


def map_to_blueprint(
    camera_id: str,
    foot_x: float,
    foot_y: float,
    camera_anchors: dict[str, dict[str, Any]] | None = None,
) -> tuple[float, float, str]:
    """Project frame foot position onto blueprint using camera anchor + FOV offset."""
    anchors = camera_anchors or DEFAULT_CAMERA_BLUEPRINT
    anchor = anchors.get(camera_id, {"x": 50.0, "y": 50.0, "location": camera_id})
    cam_x = float(anchor.get("x", 50))
    cam_y = float(anchor.get("y", 50))
    location = str(anchor.get("location", camera_id))

    # Offset from frame center; scale by approximate FOV reach on blueprint
    fov_scale = 0.35
    bp_x = cam_x + (foot_x - 50.0) * fov_scale
    bp_y = cam_y + (foot_y - 65.0) * fov_scale
    bp_x = round(max(2.0, min(98.0, bp_x)), 1)
    bp_y = round(max(2.0, min(98.0, bp_y)), 1)
    return bp_x, bp_y, location


def enrich_person_detections(
    camera_id: str,
    detections: list[dict[str, Any]],
    *,
    frame_bgr: Any | None = None,
    event_id: str | None = None,
    camera_anchors: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Tag person detections with role, track id, posture, and blueprint position.
    Returns (all_detections, personnel_only).
    """
    enriched: list[dict[str, Any]] = []
    personnel: list[dict[str, Any]] = []
    resolve_event_id = resolve_event_id_for_matching(event_id)

    for det in detections:
        if det.get("type") != "person":
            enriched.append(det)
            continue

        cx, cy = _centroid(det)
        foot_x, foot_y = _foot_point(det)
        zone_role, zone_label = classify_at_point(cx, cy, camera_id)
        track_id = _assign_track_id(camera_id, cx, cy)
        standing = _is_standing(det)
        bp_x, bp_y, cam_location = map_to_blueprint(
            camera_id, foot_x, foot_y, camera_anchors
        )

        role = zone_role
        role_label = _ROLE_LABELS.get(role, "Visitor")
        enrolled_id: str | None = None
        enrolled_name: str | None = None
        designation: str | None = None
        face_match_score = 0.0

        if frame_bgr is not None and resolve_event_id:
            match, face_match_score = identify_person_in_frame(
                resolve_event_id,
                frame_bgr,
                float(det.get("x", 0)),
                float(det.get("y", 0)),
                float(det.get("width", 15)),
                float(det.get("height", 20)),
            )
            if match:
                enrolled_id = match.id
                enrolled_name = match.name
                designation = match.designation
                role = match.role
                role_label = match.name

        track_suffix = "" if enrolled_name else f" #{track_id:02d}"
        posture = "Standing" if standing else "Moving"
        display_label = (
            f"{enrolled_name} · {designation}"
            if enrolled_name and designation
            else f"{role_label}{track_suffix}"
        )

        item = {
            **det,
            "type": _ROLE_TYPES.get(role, "person"),
            "role": role,
            "trackId": track_id,
            "label": display_label,
            "zone": zone_label,
            "posture": posture.lower(),
            "standing": standing,
            "cameraId": camera_id,
            "cameraLocation": cam_location,
            "blueprintX": bp_x,
            "blueprintY": bp_y,
            "enrolledPersonId": enrolled_id,
            "enrolledName": enrolled_name,
            "designation": designation,
            "faceMatchScore": round(face_match_score, 3) if face_match_score else None,
            "identified": enrolled_id is not None,
        }
        enriched.append(item)

        if standing:
            personnel.append(
                {
                    "id": enrolled_id or f"{camera_id}-p{track_id}",
                    "trackId": track_id,
                    "role": role,
                    "label": display_label,
                    "zone": zone_label,
                    "posture": posture.lower(),
                    "confidence": det.get("confidence", 0),
                    "cameraId": camera_id,
                    "cameraLocation": cam_location,
                    "blueprintX": bp_x,
                    "blueprintY": bp_y,
                    "frameX": round(cx, 1),
                    "frameY": round(cy, 1),
                    "enrolledPersonId": enrolled_id,
                    "enrolledName": enrolled_name,
                    "designation": designation,
                    "identified": enrolled_id is not None,
                    "faceMatchScore": round(face_match_score, 3) if face_match_score else None,
                }
            )

    return enriched, personnel
