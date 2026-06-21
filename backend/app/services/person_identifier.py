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
_track_enrollment: dict[str, dict[int, dict[str, Any]]] = {}
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
    "staff": "person",
    "contractor": "person",
    "restricted": "person",
    "entrance": "person",
    "visitor": "person",
}


def _role_badge(role: str) -> str:
    return {
        "vip": "VIP",
        "guard": "Guard",
        "staff": "Staff",
        "contractor": "Contractor",
    }.get(role, role.title())


def _display_label(name: str, role: str, designation: str | None) -> str:
    badge = _role_badge(role)
    if designation:
        return f"{name} · {designation} · {badge}"
    return f"{name} · {badge}"


def _get_track_enrollment(camera_id: str, track_id: int) -> dict[str, Any] | None:
    return _track_enrollment.get(camera_id, {}).get(track_id)


def _set_track_enrollment(
    camera_id: str,
    track_id: int,
    *,
    enrolled_id: str,
    name: str,
    designation: str,
    role: str,
    score: float,
) -> None:
    _track_enrollment.setdefault(camera_id, {})[track_id] = {
        "enrolled_id": enrolled_id,
        "name": name,
        "designation": designation,
        "role": role,
        "score": score,
    }


def _clear_stale_track_enrollment(camera_id: str, stale_ids: list[int]) -> None:
    bucket = _track_enrollment.get(camera_id)
    if not bucket:
        return
    for tid in stale_ids:
        bucket.pop(tid, None)


def clear_track_enrollment_for_camera(camera_id: str) -> None:
    """Drop sticky face-ID cache when a broadcaster disconnects."""
    _track_enrollment.pop(camera_id, None)


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
    _clear_stale_track_enrollment(camera_id, stale)

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
        enrolled_id: str | None = None
        enrolled_name: str | None = None
        designation: str | None = None
        face_match_score = 0.0
        identified = False

        cached = _get_track_enrollment(camera_id, track_id)
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
                identified = True
                _set_track_enrollment(
                    camera_id,
                    track_id,
                    enrolled_id=match.id,
                    name=match.name,
                    designation=match.designation or "",
                    role=match.role,
                    score=face_match_score,
                )
            elif cached:
                enrolled_id = cached["enrolled_id"]
                enrolled_name = cached["name"]
                designation = cached.get("designation") or None
                role = cached["role"]
                face_match_score = float(cached.get("score", 0))
                identified = True

        if identified and enrolled_name:
            display_label = _display_label(enrolled_name, role, designation)
        else:
            track_suffix = f" #{track_id:02d}"
            display_label = f"{_ROLE_LABELS.get(role, 'Visitor')}{track_suffix}"

        posture = "Standing" if standing else "Moving"
        det_id = (
            f"{camera_id}-enrolled-{enrolled_id}"
            if enrolled_id
            else f"{camera_id}-track-{track_id}"
        )

        item = {
            **det,
            "id": det_id,
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
            "identified": identified,
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
                    "identified": identified,
                    "faceMatchScore": round(face_match_score, 3) if face_match_score else None,
                }
            )

    return enriched, personnel
