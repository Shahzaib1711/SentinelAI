"""In-memory store of live personnel positions across all camera feeds."""

from __future__ import annotations

import time
from typing import Any

_personnel_by_camera: dict[str, list[dict[str, Any]]] = {}
_updated_at: int = 0


def update_camera_personnel(camera_id: str, personnel: list[dict[str, Any]]) -> None:
    global _updated_at
    _personnel_by_camera[camera_id] = personnel
    _updated_at = int(time.time() * 1000)


def clear_camera_personnel(camera_id: str) -> None:
    _personnel_by_camera.pop(camera_id, None)


def get_all_personnel() -> list[dict[str, Any]]:
    all_people: list[dict[str, Any]] = []
    for camera_id, people in _personnel_by_camera.items():
        for p in people:
            all_people.append({**p, "cameraId": camera_id})
    return all_people


def _unique_by_enrollment(people: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Count each enrolled or captured person once; keep anonymous tracks per camera."""
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for p in people:
        enrolled_id = p.get("enrolledPersonId")
        detected_id = p.get("detectedPersonId")
        identity_key = enrolled_id or detected_id
        if identity_key:
            if identity_key in seen:
                continue
            seen.add(identity_key)
        unique.append(p)
    return unique


def get_personnel_summary() -> dict[str, Any]:
    all_p = get_all_personnel()
    unique_p = _unique_by_enrollment(all_p)
    guards = sum(1 for p in unique_p if p.get("role") == "guard")
    vips = sum(1 for p in unique_p if p.get("role") == "vip")
    visitors = sum(1 for p in unique_p if p.get("role") not in ("guard", "vip"))
    return {
        "total": len(unique_p),
        "guards": guards,
        "vips": vips,
        "visitors": visitors,
        "updatedAt": _updated_at,
    }
