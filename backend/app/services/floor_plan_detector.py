"""Architectural floor-plan YOLO (doors, windows, columns, walls).

Weights: sanatladkat/floor-plan-object-detection best.pt
https://github.com/sanatladkat/floor-plan-object-detection
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.floor_plan_labels import (
    DEFAULT_ACTIVE_LABELS,
    bucket_for_label,
    label_allowed,
    normalize_label,
)

logger = logging.getLogger(__name__)

_model = None
_model_lock = threading.Lock()
_model_path_loaded: str | None = None


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _model_candidates(configured: str) -> list[Path]:
    root = _project_root()
    backend = root / "backend"
    configured_path = Path(configured)
    paths: list[Path] = []

    if configured_path.is_absolute():
        paths.append(configured_path)
    else:
        paths.append(root / configured)
        paths.append(backend / configured)
        if configured_path.name:
            paths.append(backend / "app" / "models" / configured_path.name)

    paths.append(backend / "app" / "models" / "floor_plan_best.pt")
    paths.append(root / "ml" / "blueprint" / "vendor" / "floor_plan_best.pt")
    paths.append(
        Path.home()
        / "Downloads"
        / "floor-plan-object-detection-main"
        / "floor-plan-object-detection-main"
        / "best.pt"
    )
    seen: set[str] = set()
    unique: list[Path] = []
    for path in paths:
        key = str(path.resolve()) if path.exists() else str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def resolve_floor_plan_model_path(configured: str | None = None) -> Path | None:
    configured = configured or settings.floor_plan_ml_model
    for candidate in _model_candidates(configured):
        if candidate.is_file():
            return candidate
    return None


def model_available(model_path: str | None = None) -> bool:
    return resolve_floor_plan_model_path(model_path or settings.floor_plan_ml_model) is not None


def floor_plan_model_status() -> dict[str, Any]:
    configured = settings.floor_plan_ml_model
    resolved = resolve_floor_plan_model_path(configured)
    return {
        "enabled": settings.floor_plan_ml_enabled,
        "configuredPath": configured,
        "resolvedPath": str(resolved) if resolved else None,
        "available": resolved is not None,
        "loaded": _model is not None,
        "confidence": settings.floor_plan_ml_confidence,
    }


def preload_floor_plan_model(model_path: str | None = None) -> bool:
    if not settings.floor_plan_ml_enabled:
        return False
    try:
        resolved = resolve_floor_plan_model_path(model_path or settings.floor_plan_ml_model)
        if resolved is None:
            logger.warning(
                "Floor-plan ML model not found — run: npm run ml:floor-plan:download"
            )
            return False
        _load_model(str(resolved))
        return True
    except Exception as exc:
        logger.warning("Floor-plan ML preload skipped: %s", exc)
        return False


def _load_model(model_path: str):
    global _model, _model_path_loaded
    resolved = str(resolve_floor_plan_model_path(model_path) or Path(model_path))
    if _model is not None and _model_path_loaded == resolved:
        return _model

    with _model_lock:
        if _model is not None and _model_path_loaded == resolved:
            return _model
        from ultralytics import YOLO

        logger.info("Loading floor-plan ML model: %s", resolved)
        _model = YOLO(resolved)
        _model_path_loaded = resolved
        names = getattr(_model, "names", {}) or {}
        logger.info("Floor-plan ML ready (classes: %s)", ", ".join(str(v) for v in names.values()))
        return _model


def _box_to_layout_dict(
    x1: float, y1: float, x2: float, y2: float, w: int, h: int, conf: float
) -> dict[str, Any]:
    return {
        "x": round(x1 / w * 100, 1),
        "y": round(y1 / h * 100, 1),
        "width": round((x2 - x1) / w * 100, 1),
        "height": round((y2 - y1) / h * 100, 1),
        "confidence": round(conf, 3),
    }


def _parse_boxes(
    results,
    width: int,
    height: int,
    *,
    active_labels: frozenset[str] | set[str] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    empty: dict[str, list[dict[str, Any]]] = {
        "walls": [],
        "doors": [],
        "columns": [],
        "windows": [],
        "railings": [],
        "dimensions": [],
    }
    boxes = results[0].boxes
    if boxes is None or len(boxes) == 0:
        return empty

    names = results[0].names
    for box in boxes:
        cls_id = int(box.cls[0])
        raw_name = str(names.get(cls_id, ""))
        if not label_allowed(raw_name, active_labels):
            continue
        bucket = bucket_for_label(raw_name)
        if not bucket:
            continue
        class_name = normalize_label(raw_name)
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        item = _box_to_layout_dict(x1, y1, x2, y2, width, height, float(box.conf[0]))
        item["label"] = raw_name
        item["class"] = class_name
        empty[bucket].append(item)

    return empty


def count_detections(floor_plan: dict[str, Any]) -> dict[str, int]:
    """Per-class counts like the Streamlit helper."""
    counts: dict[str, int] = {}
    for bucket, items in floor_plan.items():
        if bucket in ("walls", "doors", "columns", "windows", "railings", "dimensions"):
            for item in items:
                label = str(item.get("label") or bucket)
                counts[label] = counts.get(label, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: kv[0].lower()))


def detect_floor_plan_ml(
    img,
    *,
    model_path: str | None = None,
    confidence: float | None = None,
    active_labels: frozenset[str] | set[str] | None = None,
) -> dict[str, Any]:
    """Run architectural floor-plan YOLO on a BGR image."""
    result: dict[str, Any] = {
        "walls": [],
        "doors": [],
        "columns": [],
        "windows": [],
        "railings": [],
        "dimensions": [],
    }
    if img is None:
        return result

    height, width = img.shape[:2]
    if width == 0 or height == 0:
        return result

    resolved = resolve_floor_plan_model_path(model_path or settings.floor_plan_ml_model)
    if resolved is None:
        return result

    from app.services.blueprint_preprocess import normalize_for_ml

    labels = active_labels if active_labels is not None else DEFAULT_ACTIVE_LABELS
    conf = confidence if confidence is not None else settings.floor_plan_ml_confidence
    imgsz = settings.floor_plan_ml_imgsz
    model = _load_model(str(resolved))

    merged: dict[str, list[dict[str, Any]]] = {
        "walls": [],
        "doors": [],
        "columns": [],
        "windows": [],
        "railings": [],
        "dimensions": [],
    }
    for source in (img, normalize_for_ml(img)):
        results = model.predict(source, conf=conf, imgsz=imgsz, verbose=False)
        parsed = _parse_boxes(results, width, height, active_labels=labels)
        for key in merged:
            merged[key].extend(parsed[key])

    for key in merged:
        merged[key].sort(key=lambda b: b.get("confidence", 0), reverse=True)
    merged["objectCounts"] = count_detections(merged)
    return merged
