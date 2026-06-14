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


def get_personnel_summary() -> dict[str, Any]:
    all_p = get_all_personnel()
    guards = sum(1 for p in all_p if p.get("role") == "guard")
    vips = sum(1 for p in all_p if p.get("role") == "vip")
    visitors = sum(1 for p in all_p if p.get("role") == "visitor")
    return {
        "total": len(all_p),
        "guards": guards,
        "vips": vips,
        "visitors": visitors,
        "updatedAt": _updated_at,
    }
