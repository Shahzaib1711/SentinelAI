"""Per-camera frame zones for guard / VIP / entrance role classification."""

from __future__ import annotations

from typing import Any, Literal

ZoneRole = Literal["guard", "vip", "entrance"]

# Normalized rectangles (0–100) on the camera frame.
# Person centroid inside a zone inherits that role (highest priority wins).
_ZONE_PRIORITY: dict[ZoneRole, int] = {
    "vip": 4,
    "guard": 3,
    "entrance": 1,
}

CAMERA_ZONES: dict[str, list[dict[str, Any]]] = {
    "CAM-01": [
        {"role": "guard", "label": "Main Entrance Post", "x": 5, "y": 55, "width": 35, "height": 40},
        {"role": "entrance", "label": "North Gate Entry", "x": 35, "y": 60, "width": 35, "height": 35},
    ],
    "CAM-02": [
        {"role": "guard", "label": "Lobby Security Desk", "x": 8, "y": 50, "width": 30, "height": 45},
        {"role": "vip", "label": "VIP Reception", "x": 55, "y": 35, "width": 35, "height": 50},
    ],
    "CAM-03": [
        {"role": "vip", "label": "VIP Lounge", "x": 30, "y": 25, "width": 45, "height": 55},
        {"role": "guard", "label": "VIP Lounge Entry", "x": 5, "y": 40, "width": 28, "height": 50},
    ],
    "CAM-04": [
        {"role": "guard", "label": "Parking Perimeter", "x": 10, "y": 45, "width": 35, "height": 45},
        {"role": "entrance", "label": "Vehicle Gate", "x": 50, "y": 55, "width": 40, "height": 35},
    ],
    "CAM-05": [
        {"role": "guard", "label": "Hall Security", "x": 5, "y": 30, "width": 25, "height": 65},
        {"role": "vip", "label": "Speaker Stage Wing", "x": 60, "y": 20, "width": 35, "height": 60},
    ],
    "CAM-06": [
        {"role": "guard", "label": "Service Entrance Post", "x": 8, "y": 50, "width": 32, "height": 42},
        {"role": "entrance", "label": "South Gate", "x": 40, "y": 55, "width": 38, "height": 38},
    ],
}

# Blueprint anchor for each camera (percent of floor plan). Updated from DB when available.
DEFAULT_CAMERA_BLUEPRINT: dict[str, dict[str, float | str]] = {
    "CAM-01": {"x": 15.0, "y": 20.0, "location": "Main Entrance"},
    "CAM-02": {"x": 45.0, "y": 15.0, "location": "Central Lobby"},
    "CAM-03": {"x": 75.0, "y": 25.0, "location": "VIP Lounge"},
    "CAM-04": {"x": 30.0, "y": 55.0, "location": "Parking Sector A"},
    "CAM-05": {"x": 60.0, "y": 60.0, "location": "Conference Hall"},
    "CAM-06": {"x": 85.0, "y": 50.0, "location": "Service Entrance"},
}


def point_in_zone(cx: float, cy: float, zone: dict[str, Any]) -> bool:
    zx, zy = float(zone["x"]), float(zone["y"])
    zw, zh = float(zone["width"]), float(zone["height"])
    return zx <= cx <= zx + zw and zy <= cy <= zy + zh


def classify_at_point(cx: float, cy: float, camera_id: str) -> tuple[str, str]:
    """Return (role, zone_label). role is visitor if no zone matches."""
    zones = CAMERA_ZONES.get(camera_id, [])
    best_role = "visitor"
    best_label = "Open Area"
    best_priority = 0

    for zone in zones:
        if not point_in_zone(cx, cy, zone):
            continue
        role = zone["role"]
        priority = _ZONE_PRIORITY.get(role, 0)
        if priority > best_priority:
            best_priority = priority
            best_role = role
            best_label = str(zone.get("label", role))

    return best_role, best_label
