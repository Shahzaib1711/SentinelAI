"""Merge Sentinel blueprint ML + architectural floor-plan ML detections."""

from __future__ import annotations

from typing import Any


def _box_area(box: dict[str, Any]) -> float:
    return float(box.get("width", 0)) * float(box.get("height", 0))


def _box_center(box: dict[str, Any]) -> tuple[float, float]:
    return (
        float(box.get("x", 0)) + float(box.get("width", 0)) / 2,
        float(box.get("y", 0)) + float(box.get("height", 0)) / 2,
    )


def _boxes_overlap(a: dict[str, Any], b: dict[str, Any], min_dist_pct: float = 2.0) -> bool:
    ax, ay = _box_center(a)
    bx, by = _box_center(b)
    dist = ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5
    if dist >= min_dist_pct:
        return False
    aw, ah = float(a.get("width", 0)), float(a.get("height", 0))
    bw, bh = float(b.get("width", 0)), float(b.get("height", 0))
    return abs(aw - bw) < 4.0 and abs(ah - bh) < 4.0


def merge_boxes(
    *groups: list[dict[str, Any]],
    min_dist_pct: float = 2.0,
) -> list[dict[str, Any]]:
    """Keep highest-confidence box when detections overlap."""
    combined: list[dict[str, Any]] = []
    for group in groups:
        combined.extend(group)
    combined.sort(key=lambda b: b.get("confidence", 0), reverse=True)

    kept: list[dict[str, Any]] = []
    for box in combined:
        if any(_boxes_overlap(box, k, min_dist_pct) for k in kept):
            continue
        kept.append(box)
    return kept


def count_fused_objects(fused: dict[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for bucket in ("walls", "doors", "columns", "windows", "railings", "dimensions"):
        for item in fused.get(bucket) or []:
            label = str(item.get("label") or bucket)
            counts[label] = counts.get(label, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: kv[0].lower()))


def fuse_layout_detections(
    sentinel: dict[str, Any],
    floor_plan: dict[str, Any],
) -> dict[str, Any]:
    """Combine both models into one detection payload for structure analysis."""
    walls = merge_boxes(
        sentinel.get("walls") or [],
        floor_plan.get("walls") or [],
        min_dist_pct=1.8,
    )
    doors = merge_boxes(floor_plan.get("doors") or [], min_dist_pct=1.2)
    columns = merge_boxes(floor_plan.get("columns") or [], min_dist_pct=1.5)
    windows = merge_boxes(floor_plan.get("windows") or [], min_dist_pct=1.5)
    railings = merge_boxes(floor_plan.get("railings") or [], min_dist_pct=1.2)
    dimensions = merge_boxes(floor_plan.get("dimensions") or [], min_dist_pct=1.0)

    bounds = sentinel.get("blueprint_bounds")
    if bounds and _box_area(bounds) >= 88.0:
        bounds = None

    return {
        "blueprint_bounds": bounds,
        "walls": walls,
        "doors": doors,
        "columns": columns,
        "windows": windows,
        "railings": railings,
        "dimensions": dimensions,
        "objectCounts": count_fused_objects(
            {
                "walls": walls,
                "doors": doors,
                "columns": columns,
                "windows": windows,
                "railings": railings,
                "dimensions": dimensions,
            }
        ),
        "sources": {
            "sentinelWalls": len(sentinel.get("walls") or []),
            "floorPlanWalls": len(floor_plan.get("walls") or []),
            "doors": len(doors),
            "columns": len(columns),
            "windows": len(windows),
            "railings": len(railings),
        },
    }


def doors_to_markers(doors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Place an entrance icon at each detected door (center of box)."""
    markers: list[dict[str, Any]] = []
    door_idx = 0
    sliding_idx = 0
    for door in sorted(doors, key=lambda d: d.get("confidence", 0), reverse=True):
        cx = round(float(door["x"]) + float(door["width"]) / 2, 1)
        cy = round(float(door["y"]) + float(door["height"]) / 2, 1)
        cls = str(door.get("class") or door.get("label") or "door").strip().lower()
        if cls == "sliding door":
            sliding_idx += 1
            label = f"SLIDING-{sliding_idx:02d}"
        else:
            door_idx += 1
            label = f"DOOR-{door_idx:02d}"
        markers.append({"type": "entrance", "x": cx, "y": cy, "label": label})
    return markers


def doors_to_entrances(doors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Entrance points for layout metadata (same centers as door markers)."""
    entrances: list[dict[str, Any]] = []
    for marker in doors_to_markers(doors):
        entrances.append(
            {
                "x": marker["x"],
                "y": marker["y"],
                "label": marker["label"],
                "source": "ml_door",
            }
        )
    return entrances
