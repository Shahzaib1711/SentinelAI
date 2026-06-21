"""Derive rooms and entrances from wall geometry on floor plans."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def _to_percent(px: float, py: float, w: int, h: int) -> tuple[float, float]:
    return round(px / w * 100, 1), round(py / h * 100, 1)


def _box_to_percent(
    x: float, y: float, bw: float, bh: float, w: int, h: int
) -> dict[str, float]:
    return {
        "x": round(x / w * 100, 1),
        "y": round(y / h * 100, 1),
        "width": round(bw / w * 100, 1),
        "height": round(bh / h * 100, 1),
    }


def build_wall_mask(
    shape: tuple[int, int],
    wall_boxes_px: list[tuple[int, int, int, int]],
    *,
    dilate_px: int = 3,
) -> np.ndarray:
    """Paint detected wall boxes onto a binary mask."""
    h, w = shape
    mask = np.zeros((h, w), dtype=np.uint8)
    for x1, y1, x2, y2 in wall_boxes_px:
        cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)
    if dilate_px > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (dilate_px | 1, dilate_px | 1)
        )
        mask = cv2.dilate(mask, kernel, iterations=1)
    return mask


def free_space_from_wall_boxes(
    shape: tuple[int, int],
    wall_boxes_px: list[tuple[int, int, int, int]],
    *,
    dilate_px: int = 3,
) -> np.ndarray:
    """Derive walkable space by inverting a thick ML wall mask inside the blueprint crop."""
    h, w = shape
    free = np.full((h, w), 255, dtype=np.uint8)
    if not wall_boxes_px:
        return free

    wall_mask = build_wall_mask(shape, wall_boxes_px, dilate_px=dilate_px)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    free[wall_mask > 0] = 0
    return free


def free_space_mask(gray: np.ndarray) -> np.ndarray:
    """Binary mask where walkable / open areas are white."""
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    if float(np.mean(blur)) > 127:
        _, walls = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        _, walls = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    walls = cv2.morphologyEx(walls, cv2.MORPH_CLOSE, kernel, iterations=2)
    return cv2.bitwise_not(walls)


def _axis_wall_lines(profile: np.ndarray, min_gap: int, threshold_ratio: float = 0.35) -> list[int]:
    if profile.size == 0:
        return []
    threshold = float(profile.max()) * threshold_ratio
    lines: list[int] = []
    for i, value in enumerate(profile):
        if value < threshold:
            continue
        if not lines or i - lines[-1] >= min_gap:
            lines.append(i)
    return lines


def extract_rooms_wall_grid(
    wall_mask: np.ndarray,
    free_mask: np.ndarray,
    *,
    offset_x: int = 0,
    offset_y: int = 0,
    full_w: int | None = None,
    full_h: int | None = None,
    min_area_pct: float = 0.04,
    max_rooms: int = 16,
) -> list[dict[str, Any]]:
    """Split rooms using dominant horizontal/vertical wall lines."""
    h, w = wall_mask.shape
    full_w = full_w or w
    full_h = full_h or h
    total = w * h
    if total == 0:
        return []

    min_gap = max(10, int(min(w, h) * 0.045))
    x_lines = _axis_wall_lines(wall_mask.sum(axis=0), min_gap)
    y_lines = _axis_wall_lines(wall_mask.sum(axis=1), min_gap)
    x_bounds = [0] + x_lines + [w]
    y_bounds = [0] + y_lines + [h]

    rooms: list[dict[str, Any]] = []
    for yi in range(len(y_bounds) - 1):
        for xi in range(len(x_bounds) - 1):
            x1, x2 = x_bounds[xi], x_bounds[xi + 1]
            y1, y2 = y_bounds[yi], y_bounds[yi + 1]
            if x2 - x1 < min_gap or y2 - y1 < min_gap:
                continue
            cell = free_mask[y1:y2, x1:x2]
            free_pixels = int(cv2.countNonZero(cell))
            area_pct = free_pixels / ((x2 - x1) * (y2 - y1)) * 100
            if area_pct < 55 or free_pixels / total * 100 < min_area_pct:
                continue
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            px, py = _to_percent(offset_x + cx, offset_y + cy, full_w, full_h)
            box = _box_to_percent(offset_x + x1, offset_y + y1, x2 - x1, y2 - y1, full_w, full_h)
            rooms.append(
                {
                    "id": f"room-{len(rooms) + 1:02d}",
                    "label": f"ROOM-{len(rooms) + 1:02d}",
                    "x": px,
                    "y": py,
                    "width": box["width"],
                    "height": box["height"],
                    "areaPct": round(free_pixels / total * 100, 2),
                }
            )

    rooms.sort(key=lambda r: r["areaPct"], reverse=True)
    for i, room in enumerate(rooms[:max_rooms], start=1):
        room["id"] = f"room-{i:02d}"
        room["label"] = f"ROOM-{i:02d}"
    return rooms[:max_rooms]


def structural_wall_mask(gray: np.ndarray, bgr: np.ndarray | None = None) -> np.ndarray:
    """Extract wall-like ink lines while dropping small text blobs."""
    from app.services.blueprint_preprocess import ink_mask

    binary = ink_mask(gray, bgr)
    h, w = binary.shape
    num, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    min_area = max(16, int(h * w * 0.00002))
    walls = np.zeros_like(binary)

    for label in range(1, num):
        area = int(stats[label, cv2.CC_STAT_AREA])
        bw = int(stats[label, cv2.CC_STAT_WIDTH])
        bh = int(stats[label, cv2.CC_STAT_HEIGHT])
        if area < min_area:
            continue
        long_side = max(bw, bh)
        short_side = max(1, min(bw, bh))
        aspect = long_side / short_side
        # Keep long thin strokes (walls) and medium structural segments.
        is_line = aspect >= 2.8 and long_side >= max(8, int(min(w, h) * 0.03))
        is_wall_chunk = area >= min_area * 4 and long_side >= max(12, int(min(w, h) * 0.05))
        if is_line or is_wall_chunk:
            walls[labels == label] = 255

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    return cv2.morphologyEx(walls, cv2.MORPH_CLOSE, kernel, iterations=1)


def combine_wall_masks(shape: tuple[int, int], *masks: np.ndarray) -> np.ndarray:
    h, w = shape
    combined = np.zeros((h, w), dtype=np.uint8)
    for mask in masks:
        if mask is not None and mask.size:
            combined = cv2.bitwise_or(combined, mask)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    return cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=1)


def free_space_from_walls(wall_mask: np.ndarray) -> np.ndarray:
    """Open pixels inside the blueprint crop that are not classified as walls."""
    free = cv2.bitwise_not(wall_mask)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(free, connectivity=8)
    if num <= 1:
        return free

    h, w = free.shape
    best_label = 1
    best_area = 0
    for label in range(1, num):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area > best_area:
            best_area = area
            best_label = label

    interior = np.zeros_like(free)
    interior[labels == best_label] = 255
    return interior


def _local_maxima(
    dist: np.ndarray, min_value: float, min_sep_px: int, max_peaks: int = 16
) -> list[tuple[int, int]]:
    work = dist.copy()
    h, w = work.shape
    peaks: list[tuple[int, int]] = []

    for _ in range(max_peaks):
        _, max_val, _, max_loc = cv2.minMaxLoc(work)
        if max_val < min_value:
            break
        x, y = max_loc
        peaks.append((int(x), int(y)))
        cv2.circle(work, (x, y), min_sep_px, 0, -1)

    return peaks


def extract_rooms(
    free_mask: np.ndarray,
    *,
    offset_x: int = 0,
    offset_y: int = 0,
    full_w: int | None = None,
    full_h: int | None = None,
    min_area_pct: float = 0.06,
    max_rooms: int = 24,
) -> list[dict[str, Any]]:
    """Label connected free-space regions as rooms."""
    h, w = free_mask.shape
    full_w = full_w or w
    full_h = full_h or h
    total = w * h
    if total == 0:
        return []

    num, labels, stats, centroids = cv2.connectedComponentsWithStats(
        free_mask, connectivity=8
    )
    candidates: list[tuple[float, int]] = []
    for label in range(1, num):
        area = int(stats[label, cv2.CC_STAT_AREA])
        area_pct = area / total * 100
        if area_pct < min_area_pct:
            continue
        candidates.append((area_pct, label))

    candidates.sort(reverse=True)
    rooms: list[dict[str, Any]] = []
    for idx, (_, label) in enumerate(candidates[:max_rooms], start=1):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        bw = int(stats[label, cv2.CC_STAT_WIDTH])
        bh = int(stats[label, cv2.CC_STAT_HEIGHT])
        area_pct = int(stats[label, cv2.CC_STAT_AREA]) / total * 100
        cx, cy = centroids[label]
        px, py = _to_percent(offset_x + cx, offset_y + cy, full_w, full_h)
        box = _box_to_percent(offset_x + x, offset_y + y, bw, bh, full_w, full_h)
        rooms.append(
            {
                "id": f"room-{idx:02d}",
                "label": f"ROOM-{idx:02d}",
                "x": px,
                "y": py,
                "width": box["width"],
                "height": box["height"],
                "areaPct": round(area_pct, 2),
            }
        )
    return rooms


def extract_rooms_watershed(
    free_mask: np.ndarray,
    *,
    offset_x: int = 0,
    offset_y: int = 0,
    full_w: int | None = None,
    full_h: int | None = None,
    min_area_pct: float = 0.06,
    max_rooms: int = 16,
) -> list[dict[str, Any]]:
    """Split a floor plan into rooms using distance-transform peaks (works across door gaps)."""
    h, w = free_mask.shape
    full_w = full_w or w
    full_h = full_h or h
    total = w * h
    if total == 0:
        return []

    work = np.where(free_mask > 0, 255, 0).astype(np.uint8)
    dist = cv2.distanceTransform(work, cv2.DIST_L2, 5)
    if float(dist.max()) <= 0:
        return []

    min_sep = max(10, int(min(w, h) * 0.042))
    min_val = max(4.0, float(dist.max()) * 0.12)
    peaks = _local_maxima(dist, min_val, min_sep, max_peaks=max_rooms)

    if len(peaks) < 2:
        return []

    markers = np.zeros((h, w), dtype=np.int32)
    for idx, (px, py) in enumerate(peaks, start=1):
        markers[py, px] = idx
    markers[work == 0] = -1

    ws_input = cv2.cvtColor(work, cv2.COLOR_GRAY2BGR)
    cv2.watershed(ws_input, markers)

    rooms: list[dict[str, Any]] = []
    for idx in range(1, len(peaks) + 1):
        region = np.where(markers == idx, 255, 0).astype(np.uint8)
        region = cv2.bitwise_and(region, work)
        area = int(cv2.countNonZero(region))
        area_pct = area / total * 100
        if area_pct < min_area_pct:
            continue

        ys, xs = np.where(region > 0)
        if len(xs) == 0:
            continue
        x1, x2 = int(xs.min()), int(xs.max())
        y1, y2 = int(ys.min()), int(ys.max())
        cx = int(xs.mean())
        cy = int(ys.mean())
        px, py = _to_percent(offset_x + cx, offset_y + cy, full_w, full_h)
        box = _box_to_percent(offset_x + x1, offset_y + y1, x2 - x1 + 1, y2 - y1 + 1, full_w, full_h)
        rooms.append(
            {
                "id": f"room-{len(rooms) + 1:02d}",
                "label": f"ROOM-{len(rooms) + 1:02d}",
                "x": px,
                "y": py,
                "width": box["width"],
                "height": box["height"],
                "areaPct": round(area_pct, 2),
            }
        )

    rooms.sort(key=lambda r: r["areaPct"], reverse=True)
    for i, room in enumerate(rooms, start=1):
        room["id"] = f"room-{i:02d}"
        room["label"] = f"ROOM-{i:02d}"
    return rooms[:max_rooms]


def extract_rooms_smart(
    free_mask: np.ndarray,
    wall_mask: np.ndarray | None = None,
    *,
    offset_x: int = 0,
    offset_y: int = 0,
    full_w: int | None = None,
    full_h: int | None = None,
    min_area_pct: float = 0.04,
    max_rooms: int = 16,
) -> tuple[list[dict[str, Any]], str]:
    """Pick the best room split from connected components, watershed, or wall grid."""
    cc = extract_rooms(
        free_mask,
        offset_x=offset_x,
        offset_y=offset_y,
        full_w=full_w,
        full_h=full_h,
        min_area_pct=min_area_pct,
        max_rooms=max_rooms,
    )
    watershed = extract_rooms_watershed(
        free_mask,
        offset_x=offset_x,
        offset_y=offset_y,
        full_w=full_w,
        full_h=full_h,
        min_area_pct=min_area_pct,
        max_rooms=max_rooms,
    )
    grid: list[dict[str, Any]] = []
    if wall_mask is not None and cv2.countNonZero(wall_mask) > 0:
        grid = extract_rooms_wall_grid(
            wall_mask,
            free_mask,
            offset_x=offset_x,
            offset_y=offset_y,
            full_w=full_w,
            full_h=full_h,
            min_area_pct=min_area_pct,
            max_rooms=max_rooms,
        )

    options: list[tuple[str, list[dict[str, Any]]]] = [
        ("connected_components", cc),
        ("watershed", watershed),
        ("wall_grid", grid),
    ]
    valid = [(name, rooms) for name, rooms in options if len(rooms) >= 2]
    if not valid:
        best_name, best = max(options, key=lambda item: len(item[1]))
        return best, best_name

    best_name, best = max(valid, key=lambda item: len(item[1]))
    return best, best_name


def border_entrances(
    free_mask: np.ndarray,
    *,
    offset_x: int = 0,
    offset_y: int = 0,
    full_w: int | None = None,
    full_h: int | None = None,
) -> list[dict[str, Any]]:
    """Find entrance-like points where open space meets the crop border."""
    h, w = free_mask.shape
    full_w = full_w or w
    full_h = full_h or h
    margin = max(2, int(min(w, h) * 0.01))
    points: list[dict[str, Any]] = []

    sides = [
        ("top", range(margin, w - margin), lambda i: (i, margin)),
        ("bottom", range(margin, w - margin), lambda i: (i, h - margin - 1)),
        ("left", range(margin, h - margin), lambda i: (margin, i)),
        ("right", range(margin, h - margin), lambda i: (w - margin - 1, i)),
    ]

    min_run = max(8, int(min(w, h) * 0.04))
    for side_name, indices, coord_fn in sides:
        run: list[tuple[int, int]] = []
        for i in indices:
            x, y = coord_fn(i)
            if free_mask[y, x] > 0:
                run.append((x, y))
            elif run:
                if len(run) >= min_run:
                    mx = int(sum(p[0] for p in run) / len(run))
                    my = int(sum(p[1] for p in run) / len(run))
                    px, py = _to_percent(offset_x + mx, offset_y + my, full_w, full_h)
                    points.append({"x": px, "y": py, "side": side_name})
                run = []
        if run and len(run) >= min_run:
            mx = int(sum(p[0] for p in run) / len(run))
            my = int(sum(p[1] for p in run) / len(run))
            px, py = _to_percent(offset_x + mx, offset_y + my, full_w, full_h)
            points.append({"x": px, "y": py, "side": side_name})

    points.sort(key=lambda p: p["x"])
    for i, pt in enumerate(points, start=1):
        pt["label"] = f"ENTRANCE-{i:02d}"
    return points


def entrances_to_markers(entrances: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert entrance detections to blueprint marker dicts (entrance + exit)."""
    markers: list[dict[str, Any]] = []
    if not entrances:
        return markers

    first = entrances[0]
    markers.append(
        {
            "type": "entrance",
            "x": first["x"],
            "y": first["y"],
            "label": "ENTRANCE-01",
        }
    )

    if len(entrances) > 1:
        last = entrances[-1]
        markers.append(
            {
                "type": "exit",
                "x": last["x"],
                "y": last["y"],
                "label": "EXIT-01",
            }
        )
    else:
        side = first.get("side", "bottom")
        inset = 5.0
        if side == "left":
            gx, gy = first["x"] + inset, first["y"]
        elif side == "right":
            gx, gy = first["x"] - inset, first["y"]
        elif side == "top":
            gx, gy = first["x"], first["y"] + inset
        else:
            gx, gy = first["x"], first["y"] - inset
        markers.append(
            {
                "type": "exit",
                "x": round(max(2.0, min(98.0, gx)), 1),
                "y": round(max(2.0, min(98.0, gy)), 1),
                "label": "EXIT-01",
            }
        )
    return markers


def percent_boxes_to_px(
    boxes: list[dict[str, Any]], w: int, h: int
) -> list[tuple[int, int, int, int]]:
    """Convert percent boxes with top-left origin to pixel xyxy."""
    result: list[tuple[int, int, int, int]] = []
    for box in boxes:
        x1 = int(max(0, box["x"] / 100 * w))
        y1 = int(max(0, box["y"] / 100 * h))
        x2 = int(min(w, x1 + box["width"] / 100 * w))
        y2 = int(min(h, y1 + box["height"] / 100 * h))
        if x2 > x1 and y2 > y1:
            result.append((x1, y1, x2, y2))
    return result


def crop_from_bounds(
    img: np.ndarray, bounds: dict[str, float]
) -> tuple[np.ndarray, int, int, int, int]:
    """Crop image using percent bounds {x,y,width,height} (top-left origin)."""
    h, w = img.shape[:2]
    x0 = int(bounds["x"] / 100 * w)
    y0 = int(bounds["y"] / 100 * h)
    x1 = int(min(w, x0 + bounds["width"] / 100 * w))
    y1 = int(min(h, y0 + bounds["height"] / 100 * h))
    x0 = max(0, x0)
    y0 = max(0, y0)
    if x1 <= x0 or y1 <= y0:
        return img, 0, 0, w, h
    return img[y0:y1, x0:x1], x0, y0, x1 - x0, y1 - y0


def merge_free_and_walls(free: np.ndarray, wall_mask: np.ndarray) -> np.ndarray:
    """Keep open pixels that are not covered by detected walls."""
    combined = free.copy()
    combined[wall_mask > 0] = 0
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)
    return combined
