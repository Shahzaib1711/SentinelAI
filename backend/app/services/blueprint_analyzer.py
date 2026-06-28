"""Extract structure from uploaded floor plans: bounds, walls, entrances.
"""

from __future__ import annotations

import base64
import logging
from typing import Any

import cv2
import numpy as np

from app.config import settings
from app.services.blueprint_fusion import doors_to_entrances, doors_to_markers, fuse_layout_detections
from app.services.blueprint_rooms import (
    border_entrances,
    build_wall_mask,
    combine_wall_masks,
    crop_from_bounds,
    entrances_to_markers,
    free_space_mask,
    free_space_from_walls,
    percent_boxes_to_px,
    structural_wall_mask,
)

logger = logging.getLogger(__name__)

ANALYSIS_WIDTH = 1200


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


def _resize_for_analysis(img: np.ndarray) -> tuple[np.ndarray, int, int]:
    h0, w0 = img.shape[:2]
    scale = ANALYSIS_WIDTH / w0 if w0 > ANALYSIS_WIDTH else 1.0
    if scale != 1.0:
        img = cv2.resize(img, (int(w0 * scale), int(h0 * scale)), interpolation=cv2.INTER_AREA)
    full_h, full_w = img.shape[:2]
    return img, full_w, full_h


def _content_crop_bounds(gray: np.ndarray, full_w: int, full_h: int) -> dict[str, float]:
    """OpenCV fallback for blueprint bounds when ML does not detect one."""
    _, ink = cv2.threshold(gray, 242, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    ink = cv2.dilate(ink, kernel, iterations=2)
    coords = cv2.findNonZero(ink)
    if coords is None:
        return {"x": 0.0, "y": 0.0, "width": 100.0, "height": 100.0}

    x, y, cw, ch = cv2.boundingRect(coords)
    pad = max(6, int(min(cw, ch) * 0.015))
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(gray.shape[1], x + cw + pad)
    y1 = min(gray.shape[0], y + ch + pad)
    return {
        "x": round(x0 / full_w * 100, 1),
        "y": round(y0 / full_h * 100, 1),
        "width": round((x1 - x0) / full_w * 100, 1),
        "height": round((y1 - y0) / full_h * 100, 1),
    }


def _clean_bounds(bounds: dict[str, Any]) -> dict[str, float]:
    return {
        "x": float(bounds["x"]),
        "y": float(bounds["y"]),
        "width": float(bounds["width"]),
        "height": float(bounds["height"]),
    }


def _choose_bounds(
    gray: np.ndarray,
    full_w: int,
    full_h: int,
    ml_bounds: dict[str, Any] | None,
) -> dict[str, float]:
    """Prefer ink-based crop when the ML blueprint box covers nearly the whole image."""
    content = _content_crop_bounds(gray, full_w, full_h)
    if not ml_bounds:
        return content

    ml = _clean_bounds(ml_bounds)
    ml_area = ml["width"] * ml["height"]
    content_area = content["width"] * content["height"]

    if ml_area >= 88.0:
        return content
    if content_area < ml_area * 0.92:
        return ml
    return content


def _walls_in_crop(
    walls: list[dict[str, Any]],
    full_w: int,
    full_h: int,
    x0: int,
    y0: int,
    cw: int,
    ch: int,
) -> list[tuple[int, int, int, int]]:
    wall_px = percent_boxes_to_px(walls, full_w, full_h)
    crop_walls: list[tuple[int, int, int, int]] = []
    for a, b, c, d in wall_px:
        ix1 = max(0, a - x0)
        iy1 = max(0, b - y0)
        ix2 = min(cw, c - x0)
        iy2 = min(ch, d - y0)
        if ix2 - ix1 >= 2 and iy2 - iy1 >= 2:
            crop_walls.append((ix1, iy1, ix2, iy2))
    return crop_walls


def _analyze_structure(
    img: np.ndarray,
    full_w: int,
    full_h: int,
    *,
    blueprint_bounds: dict[str, float] | None,
    walls: list[dict[str, Any]],
    method: str,
    doors: list[dict[str, Any]] | None = None,
    columns: list[dict[str, Any]] | None = None,
    windows: list[dict[str, Any]] | None = None,
    railings: list[dict[str, Any]] | None = None,
    dimensions: list[dict[str, Any]] | None = None,
    object_counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    bounds = _choose_bounds(gray, full_w, full_h, blueprint_bounds)

    crop_bgr, x0, y0, cw, ch = crop_from_bounds(img, bounds)
    crop_gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    crop_walls = _walls_in_crop(walls, full_w, full_h, x0, y0, cw, ch)
    dilate_px = max(2, int(min(cw, ch) * 0.003))

    opencv_free = free_space_mask(crop_gray)
    opencv_walls = cv2.bitwise_not(opencv_free)
    structural = structural_wall_mask(crop_gray, crop_bgr)
    ml_mask = (
        build_wall_mask((ch, cw), crop_walls, dilate_px=dilate_px)
        if crop_walls
        else np.zeros((ch, cw), dtype=np.uint8)
    )
    wall_mask = combine_wall_masks((ch, cw), opencv_walls, structural, ml_mask)
    free = free_space_from_walls(wall_mask)

    door_list = doors or []
    if door_list:
        entrances = doors_to_entrances(door_list)
        markers = doors_to_markers(door_list)
    else:
        entrances = border_entrances(
            free, offset_x=x0, offset_y=y0, full_w=full_w, full_h=full_h
        )
        markers = entrances_to_markers(entrances)

    layout = {
        "blueprintBounds": bounds,
        "walls": walls,
        "entrances": entrances,
        "doors": door_list,
        "columns": columns or [],
        "windows": windows or [],
        "railings": railings or [],
        "dimensions": dimensions or [],
        "objectCounts": object_counts or {},
    }
    summary = {
        "imageWidth": full_w,
        "imageHeight": full_h,
        "method": method,
        "wallCount": len(walls),
        "wallsInCrop": len(crop_walls),
        "entranceCount": len(entrances),
        "doorCount": len(door_list),
        "columnCount": len(columns or []),
        "windowCount": len(windows or []),
        "railingCount": len(railings or []),
        "markersSaved": len(markers),
        "objectCounts": object_counts or {},
    }
    if blueprint_bounds and blueprint_bounds.get("confidence") is not None:
        summary["blueprintConfidence"] = blueprint_bounds["confidence"]

    return {"markers": markers, "layout": layout, "summary": summary}


def _analyze_opencv(img: np.ndarray, full_w: int, full_h: int) -> dict[str, Any]:
    return _analyze_structure(
        img, full_w, full_h, blueprint_bounds=None, walls=[], method="opencv_structure"
    )


def _layout_score(summary: dict[str, Any]) -> float:
    """Heuristic quality — mAP on the training set does not guarantee good layouts."""
    walls_in_crop = int(summary.get("wallsInCrop") or summary.get("wallCount") or 0)
    doors = int(summary.get("doorCount") or 0)
    entrances = int(summary.get("entranceCount") or 0)

    score = 0.0
    score += min(walls_in_crop, 80) * 0.12
    score += min(entrances, 6) * 1.5
    score += min(doors, 12) * 2.5
    return score


def _opencv_fallback_hint(*, weights_missing: bool, ml_ran: bool) -> str:
    if weights_missing:
        return (
            "Sentinel ML weights not found. Run: npm run ml:blueprint:deploy "
            "and npm run ml:floor-plan:download then restart the API."
        )
    if ml_ran:
        return (
            "ML did not produce a useful layout on this image (common with CAD exports, "
            "photos, or styles unlike the training set). Using OpenCV geometry instead."
        )
    return (
        "Using OpenCV geometry. For better wall detection, export a high-contrast PNG/JPG "
        "floor plan or fine-tune the model on your plan style."
    )


def analyze_blueprint_image(
    source: str,
    *,
    confidence: float | None = None,
    labels: list[str] | None = None,
) -> dict[str, Any]:
    """
    Detect blueprint bounds, walls, doors, and entrance/exit points.
    Fuses Sentinel blueprint YOLO + architectural floor-plan YOLO when available;
    falls back to OpenCV geometry.
    """
    img = _decode_image(source)
    if img is None:
        return {
            "markers": [],
            "layout": {},
            "summary": {"error": "Could not decode image"},
        }

    img, full_w, full_h = _resize_for_analysis(img)

    weights_missing = True
    ml_ran = False
    ml_status: dict[str, Any] = {}
    floor_status: dict[str, Any] = {}

    if settings.blueprint_ml_enabled:
        from app.services.blueprint_detector import (
            blueprint_model_status,
            detect_layout_ml,
            model_available,
        )
        from app.services.floor_plan_detector import (
            detect_floor_plan_ml,
            floor_plan_model_status,
            model_available as floor_plan_available,
        )
        from app.services.floor_plan_labels import DEFAULT_ACTIVE_LABELS, normalize_label

        active_labels = (
            frozenset(normalize_label(x) for x in labels)
            if labels
            else DEFAULT_ACTIVE_LABELS
        )
        detect_conf = confidence

        ml_status = blueprint_model_status()
        floor_status = floor_plan_model_status()
        weights_missing = not model_available()
        opencv_result = _analyze_opencv(img, full_w, full_h)

        sentinel_available = model_available()
        external_available = (
            settings.floor_plan_ml_enabled and floor_plan_available()
        )

        if sentinel_available or external_available:
            try:
                ml_ran = True
                sentinel = (
                    detect_layout_ml(img)
                    if sentinel_available
                    else {"blueprint_bounds": None, "walls": []}
                )
                floor_plan = (
                    detect_floor_plan_ml(
                        img,
                        confidence=detect_conf,
                        active_labels=active_labels,
                    )
                    if external_available
                    else {
                        "walls": [],
                        "doors": [],
                        "columns": [],
                        "windows": [],
                        "railings": [],
                        "dimensions": [],
                        "objectCounts": {},
                    }
                )
                fused = fuse_layout_detections(sentinel, floor_plan)

                has_layout = bool(
                    fused.get("blueprint_bounds")
                    or fused.get("walls")
                    or fused.get("doors")
                    or fused.get("columns")
                )
                if has_layout:
                    method = "fused_ml" if external_available else "ml_yolo_blueprint_v6"
                    fused_result = _analyze_structure(
                        img,
                        full_w,
                        full_h,
                        blueprint_bounds=fused.get("blueprint_bounds"),
                        walls=fused.get("walls", []),
                        doors=fused.get("doors", []),
                        columns=fused.get("columns", []),
                        windows=fused.get("windows", []),
                        railings=fused.get("railings", []),
                        dimensions=fused.get("dimensions", []),
                        object_counts=fused.get("objectCounts"),
                        method=method,
                    )
                    fused_result["summary"]["mlModel"] = ml_status.get("resolvedPath")
                    fused_result["summary"]["floorPlanModel"] = floor_status.get("resolvedPath")
                    fused_result["summary"]["detectionConfidence"] = (
                        detect_conf if detect_conf is not None else floor_status.get("confidence")
                    )
                    fused_result["summary"]["fusion"] = fused.get("sources", {})

                    fused_score = _layout_score(fused_result["summary"])
                    cv_score = _layout_score(opencv_result["summary"])
                    if cv_score > fused_score + 1.0 and not fused.get("doors"):
                        logger.info(
                            "Fused ML weaker than OpenCV (fused=%.1f cv=%.1f) — using OpenCV",
                            fused_score,
                            cv_score,
                        )
                        opencv_result["summary"]["fallback"] = "opencv"
                        opencv_result["summary"]["mlModel"] = ml_status.get("resolvedPath")
                        opencv_result["summary"]["floorPlanModel"] = floor_status.get(
                            "resolvedPath"
                        )
                        opencv_result["summary"]["mlRejected"] = True
                        opencv_result["summary"]["fusedScore"] = round(fused_score, 1)
                        opencv_result["summary"]["opencvScore"] = round(cv_score, 1)
                        opencv_result["summary"]["hint"] = _opencv_fallback_hint(
                            weights_missing=False, ml_ran=True
                        )
                        return opencv_result

                    fused_result["summary"]["fusedScore"] = round(fused_score, 1)
                    fused_result["summary"]["opencvScore"] = round(cv_score, 1)
                    return fused_result

                logger.info("Blueprint ML returned no layout — falling back to OpenCV")
            except Exception as exc:
                ml_ran = True
                logger.warning("Blueprint fusion failed (%s) — falling back to OpenCV", exc)
        else:
            logger.warning("Blueprint ML weights missing — using OpenCV fallback")

        opencv_result["summary"]["fallback"] = "opencv"
        opencv_result["summary"]["mlModel"] = (
            None if weights_missing else ml_status.get("resolvedPath")
        )
        opencv_result["summary"]["floorPlanModel"] = floor_status.get("resolvedPath")
        opencv_result["summary"]["hint"] = _opencv_fallback_hint(
            weights_missing=weights_missing, ml_ran=ml_ran
        )
        return opencv_result

    result = _analyze_opencv(img, full_w, full_h)
    result["summary"]["fallback"] = "opencv"
    result["summary"]["mlModel"] = None
    result["summary"]["hint"] = _opencv_fallback_hint(weights_missing=True, ml_ran=False)
    return result
