"""Advise VIP escort routes from blueprint markers and event context — no auto VIP-route detection."""

from __future__ import annotations

import math
from typing import Any

# Approximate meters per blueprint percent unit (typical floor plan scale).
METERS_PER_PCT = 2.5
ESCORT_SPEED_MPS = 1.2

THREAT_BASE_RISK = {
    "low": 8,
    "medium": 18,
    "high": 32,
    "critical": 45,
}


def _dist(a: dict[str, float], b: dict[str, float]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _point(marker: dict[str, Any]) -> dict[str, float]:
    return {"x": float(marker["x"]), "y": float(marker["y"])}


def _lerp(a: dict[str, float], b: dict[str, float], t: float) -> dict[str, float]:
    return {
        "x": round(a["x"] + (b["x"] - a["x"]) * t, 1),
        "y": round(a["y"] + (b["y"] - a["y"]) * t, 1),
    }


def _path_length(waypoints: list[dict[str, float]]) -> float:
    total = 0.0
    for i in range(1, len(waypoints)):
        total += _dist(waypoints[i - 1], waypoints[i])
    return total


def _format_distance(length_pct: float) -> str:
    meters = length_pct * METERS_PER_PCT
    if meters >= 1000:
        return f"{meters / 1000:.1f}km"
    return f"{int(round(meters))}m"


def _format_time(length_pct: float) -> str:
    meters = length_pct * METERS_PER_PCT
    minutes = max(1, round(meters / ESCORT_SPEED_MPS / 60))
    return f"{minutes} min"


def _point_in_blind_spot(x: float, y: float, blind_spots: list[dict[str, Any]]) -> bool:
    for spot in blind_spots:
        sx = float(spot.get("x", 0))
        sy = float(spot.get("y", 0))
        sw = float(spot.get("width", 0))
        sh = float(spot.get("height", 0))
        if sx <= x <= sx + sw and sy <= y <= sy + sh:
            return True
    return False


def _point_risk(
    x: float,
    y: float,
    *,
    markers: list[dict[str, Any]],
    blind_spots: list[dict[str, Any]],
    threat_level: str,
    destination_type: str | None,
) -> float:
    risk = float(THREAT_BASE_RISK.get(threat_level, 18))

    for m in markers:
        mx, my = float(m["x"]), float(m["y"])
        d = math.hypot(x - mx, y - my)
        mtype = m.get("type", "")

        if mtype == "restricted" and destination_type != "restricted":
            if d < 10:
                risk += 28
            elif d < 18:
                risk += 12

        if mtype == "camera":
            if d < 22:
                risk -= 6
            elif d < 35:
                risk -= 2

        if mtype == "guard":
            if d < 12:
                risk -= 10
            elif d < 22:
                risk -= 4

        if mtype == "entrance" and d < 6:
            risk += 8

    if _point_in_blind_spot(x, y, blind_spots):
        risk += 18

    return max(0.0, min(100.0, risk))


def _route_risk(
    waypoints: list[dict[str, float]],
    *,
    markers: list[dict[str, Any]],
    blind_spots: list[dict[str, Any]],
    threat_level: str,
    destination_type: str | None,
) -> int:
    if len(waypoints) < 2:
        return 50

    samples: list[float] = []
    for i in range(len(waypoints) - 1):
        a, b = waypoints[i], waypoints[i + 1]
        for t in (0.0, 0.33, 0.66, 1.0):
            p = _lerp(a, b, t)
            samples.append(
                _point_risk(
                    p["x"],
                    p["y"],
                    markers=markers,
                    blind_spots=blind_spots,
                    threat_level=threat_level,
                    destination_type=destination_type,
                )
            )

    avg = sum(samples) / len(samples)
    length_penalty = min(12, _path_length(waypoints) * 0.08)
    return int(round(min(100, avg + length_penalty)))


def _dedupe_waypoints(
    waypoints: list[dict[str, float]], min_sep: float = 4.0
) -> list[dict[str, float]]:
    if not waypoints:
        return []
    out = [waypoints[0]]
    for pt in waypoints[1:]:
        if _dist(out[-1], pt) >= min_sep:
            out.append(pt)
    if _dist(out[-1], waypoints[-1]) >= 0.1 and out[-1] != waypoints[-1]:
        out.append(waypoints[-1])
    return out


def _avoid_restricted(
    x: float, y: float, restricted: list[dict[str, Any]]
) -> dict[str, float]:
    px, py = x, y
    for zone in restricted:
        zx, zy = float(zone["x"]), float(zone["y"])
        d = math.hypot(px - zx, py - zy)
        if d < 14 and d > 0:
            push = (14 - d) / d
            px += (px - zx) * push * 0.6
            py += (py - zy) * push * 0.6
    return {
        "x": round(max(3.0, min(97.0, px)), 1),
        "y": round(max(3.0, min(97.0, py)), 1),
    }


def _nearest_marker(
    point: dict[str, float],
    markers: list[dict[str, Any]],
    types: set[str],
) -> dict[str, Any] | None:
    candidates = [m for m in markers if m.get("type") in types]
    if not candidates:
        return None
    return min(candidates, key=lambda m: _dist(point, _point(m)))


def _direct_waypoints(start: dict[str, float], end: dict[str, float]) -> list[dict[str, float]]:
    return _dedupe_waypoints(
        [
            start,
            _lerp(start, end, 0.35),
            _lerp(start, end, 0.65),
            end,
        ]
    )


def _secure_waypoints(
    start: dict[str, float],
    end: dict[str, float],
    markers: list[dict[str, Any]],
) -> list[dict[str, float]]:
    mid = _lerp(start, end, 0.5)
    restricted = [m for m in markers if m.get("type") == "restricted"]
    detour = _avoid_restricted(mid["x"], mid["y"], restricted)

    guard = _nearest_marker(mid, markers, {"guard"})
    camera = _nearest_marker(detour, markers, {"camera"})

    waypoints = [start]
    if guard:
        waypoints.append(_point(guard))
    waypoints.append(detour)
    if camera:
        gp = _point(guard) if guard else start
        if _dist(gp, _point(camera)) >= 5:
            waypoints.append(_point(camera))
    waypoints.append(end)
    return _dedupe_waypoints(waypoints)


def _perimeter_waypoints(
    start: dict[str, float],
    end: dict[str, float],
    markers: list[dict[str, Any]],
) -> list[dict[str, float]]:
    restricted = [m for m in markers if m.get("type") == "restricted"]
    edge_x = max(8.0, min(start["x"], end["x"]) - 12)
    edge_y = max(start["y"], end["y"])

    p1 = _avoid_restricted(edge_x, start["y"], restricted)
    p2 = _avoid_restricted(edge_x, (start["y"] + end["y"]) / 2, restricted)
    p3 = _avoid_restricted((start["x"] + end["x"]) / 2, end["y"], restricted)

    return _dedupe_waypoints([start, p1, p2, p3, end])


def build_location_options(markers: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Dropdown options from detected/placed markers (no vip-route)."""
    options: list[dict[str, str]] = []
    for m in markers:
        mtype = m.get("type", "")
        if mtype in ("vip-route", "vip_route"):
            continue
        if mtype not in ("entrance", "exit", "guard", "restricted", "camera"):
            continue
        options.append(
            {
                "value": str(m["id"]),
                "label": str(m.get("label") or mtype.replace("_", " ").title()),
                "type": mtype,
            }
        )
    return options


def _find_marker(markers: list[dict[str, Any]], marker_id: str) -> dict[str, Any] | None:
    for m in markers:
        if str(m.get("id")) == marker_id:
            return m
    return None


def _build_advisories(
    event: dict[str, Any],
    routes: list[dict[str, Any]],
    markers: list[dict[str, Any]],
    start: dict[str, Any],
    destination: dict[str, Any],
) -> list[str]:
    advisories: list[str] = []
    threat = str(event.get("threatLevel", "medium"))
    vip_count = int(event.get("vipCount", 0))
    attendees = int(event.get("attendees", 0))
    security = int(event.get("securityPersonnel", 0))

    cameras = sum(1 for m in markers if m.get("type") == "camera")
    guards = sum(1 for m in markers if m.get("type") == "guard")
    entrances = sum(1 for m in markers if m.get("type") == "entrance")

    if threat in ("high", "critical"):
        advisories.append(
            f"Event threat level is {threat} — avoid direct corridors and maintain guard escort."
        )

    if vip_count > 0:
        advisories.append(
            f"Planning for {vip_count} VIP(s) and {attendees} attendees — stagger convoy departures."
        )

    if security > 0 and vip_count > security * 4:
        advisories.append(
            "Security personnel may be stretched — add guard posts along the recommended route."
        )

    if cameras < 3:
        advisories.append(
            "Limited camera coverage detected on blueprint — perimeter route preferred over direct path."
        )

    if guards == 0:
        advisories.append(
            "No guard posts on blueprint — place guards at entrance before VIP movement."
        )

    if entrances == 0:
        advisories.append(
            "No entrance markers detected — confirm start point manually in Venue Setup."
        )

    safest = next((r for r in routes if r.get("isSafest")), None)
    if safest:
        advisories.append(
            f"Recommended for this event: {safest['name']} "
            f"(risk {safest['riskScore']}/100) from {start.get('label')} to {destination.get('label')}."
        )

    return advisories


def advise_routes(
    *,
    markers: list[dict[str, Any]],
    blind_spots: list[dict[str, Any]],
    event: dict[str, Any],
    start_marker_id: str,
    destination_marker_id: str,
) -> dict[str, Any]:
    """
    Propose escort routes between two blueprint markers using detected infrastructure
    and event parameters. Does not read VIP routes from the image.
    """
    start_m = _find_marker(markers, start_marker_id)
    dest_m = _find_marker(markers, destination_marker_id)

    if not start_m:
        return {"error": "Start location not found", "locations": build_location_options(markers)}
    if not dest_m:
        return {"error": "Destination not found", "locations": build_location_options(markers)}
    if start_marker_id == destination_marker_id:
        return {"error": "Start and destination must differ", "locations": build_location_options(markers)}

    start = _point(start_m)
    end = _point(dest_m)
    threat = str(event.get("threatLevel", "medium"))
    dest_type = str(dest_m.get("type", ""))

    route_defs = [
        ("route-direct", "Route A — Direct", _direct_waypoints(start, end)),
        ("route-secure", "Route B — Secure corridor", _secure_waypoints(start, end, markers)),
        ("route-perimeter", "Route C — Perimeter", _perimeter_waypoints(start, end, markers)),
    ]

    routes: list[dict[str, Any]] = []
    for rid, name, waypoints in route_defs:
        length = _path_length(waypoints)
        risk = _route_risk(
            waypoints,
            markers=markers,
            blind_spots=blind_spots,
            threat_level=threat,
            destination_type=dest_type,
        )
        routes.append(
            {
                "id": rid,
                "name": name,
                "distance": _format_distance(length),
                "estimatedTime": _format_time(length),
                "riskScore": risk,
                "waypoints": waypoints,
                "isSafest": False,
            }
        )

    routes.sort(key=lambda r: r["riskScore"])
    routes[0]["isSafest"] = True

    advisories = _build_advisories(event, routes, markers, start_m, dest_m)

    return {
        "locations": build_location_options(markers),
        "routes": routes,
        "advisories": advisories,
        "event": {
            "name": event.get("name"),
            "threatLevel": threat,
            "vipCount": event.get("vipCount"),
            "attendees": event.get("attendees"),
            "securityPersonnel": event.get("securityPersonnel"),
        },
        "start": {"id": start_m["id"], "label": start_m.get("label"), "type": start_m.get("type")},
        "destination": {
            "id": dest_m["id"],
            "label": dest_m.get("label"),
            "type": dest_m.get("type"),
        },
    }
