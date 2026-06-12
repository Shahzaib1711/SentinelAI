"""Rule-based camera coverage and blind-spot analysis on blueprint markers."""

from __future__ import annotations

import math
from typing import Any


def _cell_covered(x: float, y: float, areas: list[dict[str, float]]) -> bool:
    for area in areas:
        dx = x - area["x"]
        dy = y - area["y"]
        dist = math.sqrt(dx * dx + dy * dy)
        if dist > area["radius"]:
            continue
        angle = math.degrees(math.atan2(dy, dx))
        facing = area.get("facing", 90.0)
        half = area.get("angle", 90.0) / 2
        delta = (angle - facing + 180) % 360 - 180
        if abs(delta) <= half:
            return True
    return False


def _cluster_blind_cells(cells: list[tuple[int, int]], step: int) -> list[dict[str, Any]]:
    if not cells:
        return []

    cell_set = set(cells)
    visited: set[tuple[int, int]] = set()
    clusters: list[list[tuple[int, int]]] = []

    for cell in cells:
        if cell in visited:
            continue
        stack = [cell]
        group: list[tuple[int, int]] = []
        while stack:
            cur = stack.pop()
            if cur in visited or cur not in cell_set:
                continue
            visited.add(cur)
            group.append(cur)
            cx, cy = cur
            for nx, ny in ((cx - step, cy), (cx + step, cy), (cx, cy - step), (cx, cy + step)):
                if (nx, ny) in cell_set and (nx, ny) not in visited:
                    stack.append((nx, ny))
        if group:
            clusters.append(group)

    clusters.sort(key=len, reverse=True)
    blind_spots: list[dict[str, Any]] = []
    severities = ["critical", "high", "medium"]

    for i, group in enumerate(clusters[:5]):
        xs = [c[0] for c in group]
        ys = [c[1] for c in group]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        severity = severities[min(i, len(severities) - 1)]
        blind_spots.append(
            {
                "id": f"bs-auto-{i + 1}",
                "x": float(min_x),
                "y": float(min_y),
                "width": float(max(max_x - min_x + step, step * 2)),
                "height": float(max(max_y - min_y + step, step * 2)),
                "severity": severity,
                "description": f"Uncovered area ({len(group)} grid cells) — insufficient camera overlap",
            }
        )

    return blind_spots


def analyze_coverage(markers: list[dict[str, Any]]) -> dict[str, Any]:
    coverage_areas: list[dict[str, float]] = []
    for m in markers:
        if m["type"] != "camera":
            continue
        coverage_areas.append(
            {
                "id": f"cov-{m['id']}",
                "cameraId": m.get("label", m["id"]),
                "x": float(m["x"]),
                "y": float(m["y"]),
                "radius": 22.0,
                "angle": 90.0,
                "facing": 90.0,
            }
        )

    step = 6
    uncovered_cells: list[tuple[int, int]] = []
    total = 0

    for x in range(5, 96, step):
        for y in range(5, 96, step):
            total += 1
            if not _cell_covered(float(x), float(y), coverage_areas):
                uncovered_cells.append((x, y))

    coverage_percentage = round(((total - len(uncovered_cells)) / total) * 100) if total else 0
    blind_spots = _cluster_blind_cells(uncovered_cells, step)

    if not blind_spots and uncovered_cells:
        blind_spots = [
            {
                "id": "bs-auto-1",
                "x": 38.0,
                "y": 38.0,
                "width": 12.0,
                "height": 10.0,
                "severity": "high",
                "description": "Corridor junction — insufficient camera overlap",
            }
        ]

    vulnerability_score = min(
        100,
        round(len(uncovered_cells) * 0.8 + (100 - coverage_percentage) * 0.5),
    )

    return {
        "coveragePercentage": coverage_percentage,
        "blindSpotsFound": len(blind_spots),
        "vulnerabilityScore": vulnerability_score,
        "coverageAreas": coverage_areas,
        "blindSpots": blind_spots,
    }
