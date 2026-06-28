"""Greedy camera placement to maximize floor-plan coverage and close blind spots."""

from __future__ import annotations

import math
from typing import Any

from app.services.coverage_engine import _cell_covered

GRID_STEP = 5
CAMERA_RADIUS = 28.0
CAMERA_ANGLE = 110.0
TARGET_COVERAGE_PCT = 86
MAX_PROPOSED_CAMERAS = 14
MIN_SEPARATION = 8.0


def _center(box: dict[str, Any]) -> dict[str, float]:
    return {
        "x": round(float(box.get("x", 0)) + float(box.get("width", 0)) / 2, 1),
        "y": round(float(box.get("y", 0)) + float(box.get("height", 0)) / 2, 1),
    }


def _dist(a: dict[str, float], b: dict[str, float]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _facing_degrees(cx: float, cy: float, tx: float, ty: float) -> float:
    return round((math.degrees(math.atan2(ty - cy, tx - cx)) + 360) % 360, 1)


def _floor_cells(bounds: dict[str, Any] | None, step: int = GRID_STEP) -> list[tuple[float, float]]:
    if bounds and bounds.get("width", 0) > 5:
        x0 = max(2.0, float(bounds["x"]))
        y0 = max(2.0, float(bounds["y"]))
        x1 = min(98.0, x0 + float(bounds["width"]))
        y1 = min(98.0, y0 + float(bounds["height"]))
    else:
        x0, y0, x1, y1 = 5.0, 5.0, 95.0, 95.0

    cells: list[tuple[float, float]] = []
    x = x0 + step / 2
    while x < x1:
        y = y0 + step / 2
        while y < y1:
            cells.append((round(x, 1), round(y, 1)))
            y += step
        x += step
    return cells


def _camera_area(x: float, y: float, facing: float) -> dict[str, float]:
    return {
        "x": x,
        "y": y,
        "radius": CAMERA_RADIUS,
        "angle": CAMERA_ANGLE,
        "facing": facing,
    }


def _markers_to_areas(markers: list[dict[str, Any]]) -> list[dict[str, float]]:
    areas: list[dict[str, float]] = []
    for m in markers:
        if m.get("type") != "camera":
            continue
        areas.append(
            _camera_area(
                float(m["x"]),
                float(m["y"]),
                float(m.get("facing", 90.0)),
            )
        )
    return areas


def _coverage_pct(cells: list[tuple[float, float]], areas: list[dict[str, float]]) -> float:
    if not cells:
        return 0.0
    covered = sum(1 for x, y in cells if _cell_covered(x, y, areas))
    return round(covered / len(cells) * 100, 1)


def _uncovered_cells(
    cells: list[tuple[float, float]], areas: list[dict[str, float]]
) -> list[tuple[float, float]]:
    return [(x, y) for x, y in cells if not _cell_covered(x, y, areas)]


def _centroid(points: list[tuple[float, float]]) -> tuple[float, float]:
    if not points:
        return 50.0, 50.0
    return (
        sum(p[0] for p in points) / len(points),
        sum(p[1] for p in points) / len(points),
    )


def _too_close(x: float, y: float, others: list[dict[str, float]], min_sep: float) -> bool:
    return any(_dist({"x": x, "y": y}, o) < min_sep for o in others)


def _candidate_positions(
    bounds: dict[str, Any] | None,
    blind_spots: list[dict[str, Any]],
    doors: list[dict[str, Any]],
    uncovered: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    candidates: list[tuple[float, float]] = []
    seen: set[tuple[float, float]] = set()

    def add(x: float, y: float) -> None:
        x, y = round(max(3.0, min(97.0, x)), 1), round(max(3.0, min(97.0, y)), 1)
        key = (x, y)
        if key not in seen:
            seen.add(key)
            candidates.append(key)

    if bounds and bounds.get("width", 0) > 5:
        bx, by, bw, bh = (
            float(bounds["x"]),
            float(bounds["y"]),
            float(bounds["width"]),
            float(bounds["height"]),
        )
        inset = max(4.0, min(bw, bh) * 0.08)
        for fx in (0.15, 0.5, 0.85):
            for fy in (0.15, 0.5, 0.85):
                add(bx + bw * fx, by + bh * fy)
        add(bx + inset, by + inset)
        add(bx + bw - inset, by + inset)
        add(bx + inset, by + bh - inset)
        add(bx + bw - inset, by + bh - inset)
        add(bx + bw / 2, by + inset)
        add(bx + bw / 2, by + bh - inset)
        add(bx + inset, by + bh / 2)
        add(bx + bw - inset, by + bh / 2)

    for spot in blind_spots[:8]:
        c = _center(spot)
        add(c["x"], c["y"])
        w, h = float(spot.get("width", 8)), float(spot.get("height", 8))
        add(c["x"] - w * 0.3, c["y"])
        add(c["x"] + w * 0.3, c["y"])
        add(c["x"], c["y"] - h * 0.3)
        add(c["x"], c["y"] + h * 0.3)

    for door in doors[:10]:
        c = _center(door)
        add(c["x"], c["y"])
        add(c["x"], max(5.0, c["y"] - 6))
        add(c["x"], min(95.0, c["y"] + 6))

    for x, y in uncovered[:: max(1, len(uncovered) // 24)]:
        add(x, y)

    return candidates


def _best_placement(
    *,
    candidates: list[tuple[float, float]],
    existing_areas: list[dict[str, float]],
    uncovered: list[tuple[float, float]],
    placed_points: list[dict[str, float]],
    focus_x: float,
    focus_y: float,
) -> tuple[float, float, float, int] | None:
    best: tuple[float, float, float, int] | None = None

    for px, py in candidates:
        if _too_close(px, py, placed_points, MIN_SEPARATION):
            continue

        facings = [
            _facing_degrees(px, py, focus_x, focus_y),
        ]
        if uncovered:
            ux, uy = _centroid(uncovered)
            facings.append(_facing_degrees(px, py, ux, uy))
        for offset in (0, 45, 90, 135, 180, 225, 270, 315):
            facings.append(float(offset))

        for facing in facings:
            cam = _camera_area(px, py, facing)
            gain = 0
            for x, y in uncovered:
                if _cell_covered(x, y, existing_areas + [cam]) and not _cell_covered(
                    x, y, existing_areas
                ):
                    gain += 1
            if best is None or gain > best[3]:
                best = (px, py, facing, gain)

    return best


def propose_cameras_for_coverage(
    *,
    markers: list[dict[str, Any]],
    blind_spots: list[dict[str, Any]],
    layout: dict[str, Any] | None,
    min_cameras: int = 0,
    target_coverage_pct: float = TARGET_COVERAGE_PCT,
    max_cameras: int = MAX_PROPOSED_CAMERAS,
) -> list[dict[str, Any]]:
    """
    Iteratively place cameras to cover the blueprint footprint and eliminate blind zones.
    Each proposal includes facing angle for accurate coverage simulation.
    """
    bounds = (layout or {}).get("blueprintBounds")
    doors = (layout or {}).get("doors") or []
    cells = _floor_cells(bounds)
    if not cells:
        return []

    existing_areas = _markers_to_areas(markers)
    placed_points = [
        {"x": float(m["x"]), "y": float(m["y"])}
        for m in markers
        if m.get("type") in ("camera", "guard")
    ]

    proposals: list[dict[str, Any]] = []
    cam_num = sum(1 for m in markers if m.get("type") == "camera") + 1
    areas = list(existing_areas)

    if bounds:
        focus_x = float(bounds["x"]) + float(bounds["width"]) / 2
        focus_y = float(bounds["y"]) + float(bounds["height"]) / 2
    else:
        focus_x, focus_y = 50.0, 50.0

    while len(proposals) < max_cameras:
        uncovered = _uncovered_cells(cells, areas)
        pct = _coverage_pct(cells, areas)

        if pct >= target_coverage_pct and len(proposals) >= min_cameras:
            break
        if not uncovered and len(proposals) >= min_cameras:
            break

        candidates = _candidate_positions(bounds, blind_spots, doors, uncovered)
        best = _best_placement(
            candidates=candidates,
            existing_areas=areas,
            uncovered=uncovered,
            placed_points=placed_points,
            focus_x=focus_x,
            focus_y=focus_y,
        )

        if best is None or best[3] <= 0:
            if len(proposals) >= min_cameras:
                break
            px = round(20 + len(proposals) * 18, 1)
            py = round(25 + len(proposals) * 12, 1)
            facing = _facing_degrees(px, py, focus_x, focus_y)
            gain = 0
        else:
            px, py, facing, gain = best

        if _too_close(px, py, placed_points, MIN_SEPARATION):
            if len(proposals) >= min_cameras:
                break
            continue

        cam_area = _camera_area(px, py, facing)
        areas.append(cam_area)
        placed_points.append({"x": px, "y": py})

        new_pct = _coverage_pct(cells, areas)
        reason = (
            f"Venue coverage camera — adds ~{gain} grid cells "
            f"(plan coverage {new_pct}%, {CAMERA_ANGLE:.0f}° FOV facing {facing:.0f}°)"
        )
        if blind_spots and gain > 0:
            reason += "; overlaps sightlines to close blind zones"

        proposals.append(
            {
                "type": "camera",
                "x": px,
                "y": py,
                "facing": facing,
                "angle": CAMERA_ANGLE,
                "radius": CAMERA_RADIUS,
                "label": f"CAM-{cam_num:02d}",
                "reason": reason,
                "proposed": True,
            }
        )
        cam_num += 1

        if best is not None and best[3] <= 2 and pct >= target_coverage_pct - 5:
            break

    return proposals


def coverage_summary_for_markers(
    markers: list[dict[str, Any]], layout: dict[str, Any] | None
) -> dict[str, Any]:
    """Quick coverage stats using the same grid + FOV model as placement."""
    cells = _floor_cells((layout or {}).get("blueprintBounds"))
    areas = _markers_to_areas(markers)
    uncovered = _uncovered_cells(cells, areas)
    return {
        "coveragePercentage": _coverage_pct(cells, areas),
        "uncoveredCells": len(uncovered),
        "totalCells": len(cells),
    }
