"""Custom YOLO model for floor-plan layout detection (blueprint bounds + walls)."""

from __future__ import annotations

import logging
import shutil
import threading
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

# Must match class order in ml/blueprint/Floor Plan.v6i.yolov8/data.yaml
LAYOUT_CLASSES = ("blueprint", "wall")
CLASS_ALIASES = {
    "blueprint": "blueprint",
    "wall": "wall",
}

_model = None
_model_lock = threading.Lock()
_model_path_loaded: str | None = None
_resolved_model_path: Path | None = None


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

    paths.extend(
        [
            root / "backend" / "app" / "models" / "sentinel_blueprint.pt",
            backend / "app" / "models" / "sentinel_blueprint.pt",
            root / "ml" / "blueprint" / "runs" / "blueprint_v6" / "weights" / "best.pt",
            root / "ml" / "blueprint" / "runs" / "blueprint_v6" / "weights" / "last.pt",
        ]
    )

    seen: set[str] = set()
    unique: list[Path] = []
    for path in paths:
        key = str(path.resolve()) if path.exists() else str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def resolve_blueprint_model_path(configured: str | None = None) -> Path | None:
    """Return the first existing weights file, optionally auto-deploying best.pt."""
    configured = configured or settings.blueprint_ml_model
    deploy_target = _project_root() / "backend" / "app" / "models" / "sentinel_blueprint.pt"

    for candidate in _model_candidates(configured):
        if candidate.is_file():
            return candidate

    # Dev convenience: copy training output into the API folder if available.
    for train_weight in (
        _project_root() / "ml" / "blueprint" / "runs" / "blueprint_v6" / "weights" / "best.pt",
        _project_root() / "ml" / "blueprint" / "runs" / "blueprint_v6" / "weights" / "last.pt",
    ):
        if train_weight.is_file():
            try:
                deploy_target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(train_weight, deploy_target)
                logger.info("Auto-deployed blueprint model: %s -> %s", train_weight, deploy_target)
                return deploy_target
            except OSError as exc:
                logger.warning("Could not auto-deploy blueprint model: %s", exc)
                return train_weight

    return None


def _resolve_model_path(path: str) -> Path:
    resolved = resolve_blueprint_model_path(path)
    if resolved is not None:
        return resolved
    raw = Path(path)
    if raw.is_absolute():
        return raw
    return _project_root() / raw


def model_available(model_path: str | None = None) -> bool:
    return resolve_blueprint_model_path(model_path or settings.blueprint_ml_model) is not None


def blueprint_model_status() -> dict[str, Any]:
    configured = settings.blueprint_ml_model
    resolved = resolve_blueprint_model_path(configured)
    return {
        "enabled": settings.blueprint_ml_enabled,
        "configuredPath": configured,
        "resolvedPath": str(resolved) if resolved else None,
        "available": resolved is not None,
        "loaded": _model is not None,
        "confidence": settings.blueprint_ml_confidence,
    }


def preload_blueprint_model(model_path: str | None = None) -> bool:
    """Warm up the blueprint YOLO weights at API startup."""
    global _resolved_model_path
    try:
        resolved = resolve_blueprint_model_path(model_path or settings.blueprint_ml_model)
        if resolved is None:
            logger.warning(
                "Blueprint ML model not found — using OpenCV fallback. "
                "Run: npm run ml:blueprint:deploy"
            )
            _resolved_model_path = None
            return False
        _resolved_model_path = resolved
        _load_model(str(resolved))
        return True
    except Exception as exc:
        logger.warning("Blueprint ML preload skipped: %s", exc)
        return False


def _load_model(model_path: str):
    global _model, _model_path_loaded
    resolved = str(_resolve_model_path(model_path))
    if _model is not None and _model_path_loaded == resolved:
        return _model

    with _model_lock:
        if _model is not None and _model_path_loaded == resolved:
            return _model
        from ultralytics import YOLO

        logger.info("Loading blueprint ML model: %s", resolved)
        _model = YOLO(resolved)
        _model_path_loaded = resolved
        logger.info("Blueprint ML model ready (classes: %s)", ", ".join(LAYOUT_CLASSES))
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


def _dedupe_boxes(boxes: list[dict[str, Any]], min_dist_pct: float = 1.5) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    for box in sorted(boxes, key=lambda b: b.get("confidence", 0), reverse=True):
        too_close = any(
            ((box["x"] - k["x"]) ** 2 + (box["y"] - k["y"]) ** 2) ** 0.5 < min_dist_pct
            and box.get("width", 0) > 0
            and k.get("width", 0) > 0
            for k in kept
            if abs(box["width"] - k["width"]) < 3 and abs(box["height"] - k["height"]) < 3
        )
        if not too_close:
            kept.append(box)
    return kept


def _parse_layout_boxes(results, width: int, height: int) -> tuple[list[dict], list[dict]]:
    boxes = results[0].boxes
    if boxes is None or len(boxes) == 0:
        return [], []

    names = results[0].names
    blueprint_candidates: list[dict[str, Any]] = []
    walls: list[dict[str, Any]] = []

    for box in boxes:
        cls_id = int(box.cls[0])
        raw_name = names.get(cls_id, LAYOUT_CLASSES[cls_id] if cls_id < len(LAYOUT_CLASSES) else "")
        class_name = _normalize_class(str(raw_name))
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        box_conf = float(box.conf[0])
        item = _box_to_layout_dict(x1, y1, x2, y2, width, height, box_conf)

        if class_name == "blueprint":
            blueprint_candidates.append(item)
        elif class_name == "wall":
            walls.append(item)

    return blueprint_candidates, walls


def detect_layout_ml(
    img,
    *,
    model_path: str | None = None,
    confidence: float | None = None,
) -> dict[str, Any]:
    """
    Run custom YOLO on a BGR floor-plan image.
    Returns blueprint bounds and wall segment boxes (percent coordinates).
    """
    empty: dict[str, Any] = {"blueprint_bounds": None, "walls": []}
    if img is None:
        return empty

    height, width = img.shape[:2]
    if width == 0 or height == 0:
        return empty

    resolved = resolve_blueprint_model_path(model_path or settings.blueprint_ml_model)
    if resolved is None:
        return empty

    from app.services.blueprint_preprocess import normalize_for_ml

    conf = confidence if confidence is not None else settings.blueprint_ml_confidence
    imgsz = settings.blueprint_ml_imgsz
    model = _load_model(str(resolved))

    blueprint_candidates: list[dict[str, Any]] = []
    walls: list[dict[str, Any]] = []

    for source in (img, normalize_for_ml(img)):
        results = model.predict(source, conf=conf, imgsz=imgsz, verbose=False)
        bp, wl = _parse_layout_boxes(results, width, height)
        blueprint_candidates.extend(bp)
        walls.extend(wl)

    walls = _dedupe_boxes(walls)

    blueprint_bounds = None
    if blueprint_candidates:
        blueprint_bounds = max(
            blueprint_candidates,
            key=lambda b: b["width"] * b["height"] * b.get("confidence", 0),
        )

    walls.sort(key=lambda w: w.get("confidence", 0), reverse=True)
    return {"blueprint_bounds": blueprint_bounds, "walls": walls}


def _normalize_class(name: str) -> str:
    key = name.strip().lower()
    return CLASS_ALIASES.get(key, key)
