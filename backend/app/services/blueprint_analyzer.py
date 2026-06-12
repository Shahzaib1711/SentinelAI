"""Auto-detect security markers on uploaded floor-plan images (OpenCV)."""

from __future__ import annotations

import base64
import logging
import math
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

ANALYSIS_WIDTH = 1200
MIN_CAMERA_DISTANCE_PCT = 14.0
MAX_CAMERAS = 6
EDGE_MARGIN_PCT = 6.0


def _decode_image(source: str) -> np.ndarray | None:
    try:
        payload = source.split(",", 1)[1] if "," in source else source
        raw = base64.b64decode(payload)
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception as exc:
        logger.warning("Blueprint image decode failed: %s", exc)
        return None


def _to_percent(px: float, py: float, w: int, h: int) -> tuple[float, float]:
    return round(px / w * 100, 1), round(py / h * 100, 1)


def _distance_pct(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _content_crop(gray: np.ndarray) -> tuple[np.ndarray, int, int, int, int]:
    """Crop to the inked floor-plan region, ignoring outer white margins."""
    _, ink = cv2.threshold(gray, 242, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    ink = cv2.dilate(ink, kernel, iterations=2)
    coords = cv2.findNonZero(ink)
    if coords is None:
        h, w = gray.shape
        return gray, 0, 0, w, h

    x, y, cw, ch = cv2.boundingRect(coords)
    pad = max(6, int(min(cw, ch) * 0.015))
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(gray.shape[1], x + cw + pad)
    y1 = min(gray.shape[0], y + ch + pad)
    return gray[y0:y1, x0:x1], x0, y0, x1 - x0, y1 - y0


def _map_to_full_percent(
    px: float, py: float, x0: int, y0: int, full_w: int, full_h: int
) -> tuple[float, float]:
    return _to_percent(x0 + px, y0 + py, full_w, full_h)


def _inside_content(px: float, py: float, w: int, h: int, margin_pct: float) -> bool:
    mx = w * (margin_pct / 100)
    my = h * (margin_pct / 100)
    return mx <= px <= w - mx and my <= py <= h - my


def _free_space_mask(gray: np.ndarray) -> np.ndarray:
    """Binary mask where walkable / open areas are white."""
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Floor plans are usually light background with dark walls.
    if float(np.mean(blur)) > 127:
        _, walls = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        _, walls = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    walls = cv2.morphologyEx(walls, cv2.MORPH_CLOSE, kernel, iterations=2)
    free = cv2.bitwise_not(walls)

    # Keep largest connected interior region.
    num, labels, stats, _ = cv2.connectedComponentsWithStats(free, connectivity=8)
    if num <= 1:
        return free

    h, w = free.shape
    border_touch = set()
    for label in range(1, num):
        ys, xs = np.where(labels == label)
        if len(xs) == 0:
            continue
        if (
            xs.min() <= 1
            or ys.min() <= 1
            or xs.max() >= w - 2
            or ys.max() >= h - 2
        ):
            border_touch.add(label)

    best_label = 1
    best_area = 0
    for label in range(1, num):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if label in border_touch and area > best_area:
            best_area = area
            best_label = label

    if best_area == 0:
        best_label = int(1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]))

    interior = np.zeros_like(free)
    interior[labels == best_label] = 255
    return interior


def _local_maxima(dist: np.ndarray, min_value: float, min_sep_px: int) -> list[tuple[int, int]]:
    d = dist.copy()
    h, w = d.shape
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (min_sep_px | 1, min_sep_px | 1))
    peaks: list[tuple[int, int]] = []

    for _ in range(MAX_CAMERAS + 4):
        _, max_val, _, max_loc = cv2.minMaxLoc(d)
        if max_val < min_value:
            break
        x, y = max_loc
        peaks.append((x, y))
        cv2.circle(d, (x, y), min_sep_px, 0, -1)

    return peaks


def _border_access_points(free: np.ndarray, w: int, h: int) -> list[tuple[float, float, str]]:
    """Find entrance-like points where open space meets the image border."""
    margin = max(2, int(min(w, h) * 0.01))
    points: list[tuple[float, float, str]] = []

    sides = [
        ("top", range(margin, w - margin), lambda i: (i, margin)),
        ("bottom", range(margin, w - margin), lambda i: (i, h - margin - 1)),
        ("left", range(margin, h - margin), lambda i: (margin, i)),
        ("right", range(margin, h - margin), lambda i: (w - margin - 1, i)),
    ]

    for side_name, indices, coord_fn in sides:
        run: list[tuple[int, int]] = []
        for i in indices:
            x, y = coord_fn(i)
            if free[y, x] > 0:
                run.append((x, y))
            elif run:
                if len(run) >= max(8, int(len(indices) * 0.04)):
                    mx = int(sum(p[0] for p in run) / len(run))
                    my = int(sum(p[1] for p in run) / len(run))
                    px, py = _to_percent(mx, my, w, h)
                    points.append((px, py, side_name))
                run = []
        if run and len(run) >= max(8, int(len(indices) * 0.04)):
            mx = int(sum(p[0] for p in run) / len(run))
            my = int(sum(p[1] for p in run) / len(run))
            px, py = _to_percent(mx, my, w, h)
            points.append((px, py, side_name))

    return points


def analyze_blueprint_image(source: str) -> dict[str, Any]:
    """
    Detect cameras, entrances, exits, guard posts, restricted zones, and VIP route
    from a floor-plan image (data URL or raw base64).
    """
    img = _decode_image(source)
    if img is None:
        return {"markers": [], "summary": {"error": "Could not decode image"}}

    h0, w0 = img.shape[:2]
    scale = ANALYSIS_WIDTH / w0 if w0 > ANALYSIS_WIDTH else 1.0
    if scale != 1.0:
        img = cv2.resize(img, (int(w0 * scale), int(h0 * scale)), interpolation=cv2.INTER_AREA)

    full_h, full_w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    crop_gray, x0, y0, cw, ch = _content_crop(gray)
    free = _free_space_mask(crop_gray)

    dist = cv2.distanceTransform(free, cv2.DIST_L2, 5)
    min_sep = max(24, int(min(cw, ch) * (MIN_CAMERA_DISTANCE_PCT / 100)))
    min_dist_val = max(10.0, float(dist.max()) * 0.3)
    peaks = _local_maxima(dist, min_dist_val, min_sep)
    peaks = [
        (x, y)
        for x, y in peaks
        if _inside_content(float(x), float(y), cw, ch, EDGE_MARGIN_PCT)
    ]

    markers: list[dict[str, Any]] = []

    # Cameras at aisle / room centers (distance-transform peaks inside the drawing).
    for i, (x, y) in enumerate(peaks[:MAX_CAMERAS]):
        px, py = _map_to_full_percent(float(x), float(y), x0, y0, full_w, full_h)
        markers.append(
            {
                "type": "camera",
                "x": px,
                "y": py,
                "label": f"CAM-{i + 1:02d}",
            }
        )

    access_crop = _border_access_points(free, cw, ch)
    access: list[tuple[float, float, str]] = []
    for px_pct, py_pct, side in access_crop:
        lx = (px_pct / 100.0) * cw
        ly = (py_pct / 100.0) * ch
        fx, fy = _map_to_full_percent(lx, ly, x0, y0, full_w, full_h)
        access.append((fx, fy, side))
    access.sort(key=lambda p: p[0])

    if access:
        ex, ey, _ = access[0]
        markers.append({"type": "entrance", "x": ex, "y": ey, "label": "ENTRANCE-01"})
    if len(access) > 1:
        ex, ey, _ = access[-1]
        markers.append({"type": "exit", "x": ex, "y": ey, "label": "EXIT-01"})
    elif access:
        ex, ey, side = access[0]
        offset = 5.0
        if side in ("left", "right"):
            gx = ex + (offset if side == "left" else -offset)
            gy = ey
        else:
            gx = ex
            gy = ey + (offset if side == "top" else -offset)
        markers.append(
            {
                "type": "exit",
                "x": round(max(2.0, min(98.0, gx)), 1),
                "y": round(max(2.0, min(98.0, gy)), 1),
                "label": "EXIT-01",
            }
        )

    # Restricted zone = deepest interior point (stage / secure core).
    if peaks:
        rx, ry = peaks[0]
        rpx, rpy = _map_to_full_percent(float(rx), float(ry), x0, y0, full_w, full_h)
        markers.append(
            {
                "type": "restricted",
                "x": rpx,
                "y": rpy,
                "label": "RESTRICTED-VIP",
            }
        )

    # Guard post just inside the main entrance.
    if access:
        ex, ey, side = access[0]
        inset = 4.0
        if side == "left":
            gx, gy = ex + inset, ey
        elif side == "right":
            gx, gy = ex - inset, ey
        elif side == "top":
            gx, gy = ex, ey + inset
        else:
            gx, gy = ex, ey - inset
        markers.append(
            {
                "type": "guard",
                "x": round(max(2.0, min(98.0, gx)), 1),
                "y": round(max(2.0, min(98.0, gy)), 1),
                "label": "GUARD-01",
            }
        )

    # VIP route waypoints: entrance → mid → restricted core.
    entrance_pt = next((m for m in markers if m["type"] == "entrance"), None)
    restricted_pt = next((m for m in markers if m["type"] == "restricted"), None)
    if entrance_pt and restricted_pt:
        mid_x = (entrance_pt["x"] + restricted_pt["x"]) / 2
        mid_y = (entrance_pt["y"] + restricted_pt["y"]) / 2
        route_points = [
            (entrance_pt["x"], entrance_pt["y"]),
            (mid_x, mid_y),
            (restricted_pt["x"], restricted_pt["y"]),
        ]
        for i, (vx, vy) in enumerate(route_points, start=1):
            markers.append(
                {
                    "type": "vip-route",
                    "x": round(vx, 1),
                    "y": round(vy, 1),
                    "label": f"VIP-{i}",
                }
            )

    summary = {
        "imageWidth": full_w,
        "imageHeight": full_h,
        "contentCrop": {"x": x0, "y": y0, "width": cw, "height": ch},
        "cameras": sum(1 for m in markers if m["type"] == "camera"),
        "entrances": sum(1 for m in markers if m["type"] == "entrance"),
        "method": "opencv_distance_transform",
    }

    return {"markers": markers, "summary": summary}
