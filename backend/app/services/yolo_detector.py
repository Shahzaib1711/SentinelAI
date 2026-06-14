"""YOLOv8 object detection on relayed camera frames."""

from __future__ import annotations

import base64
import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

_model = None
_model_lock = threading.Lock()

# COCO class name → SentinelAI detection type
_TYPE_MAP: dict[str, str] = {
    "person": "person",
    "car": "vehicle",
    "truck": "vehicle",
    "bus": "vehicle",
    "motorcycle": "vehicle",
    "bicycle": "vehicle",
    "scooter": "vehicle",
    "skateboard": "vehicle",
    "rollerblade": "vehicle",
    "backpack": "bag",
    "handbag": "bag",
    "suitcase": "bag",
    "dog": "animal",
    "cat": "animal",
    "bird": "animal",
    "horse": "animal",
    "sheep": "animal",
    "cow": "animal",
    
}


def _load_model(model_name: str):
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from ultralytics import YOLO

                logger.info("Loading YOLO model: %s", model_name)
                _model = YOLO(model_name)
                logger.info("YOLO model ready")
    return _model


def preload_model(model_name: str) -> None:
    """Warm up the model at API startup (optional)."""
    try:
        _load_model(model_name)
    except Exception as exc:
        logger.warning("YOLO preload skipped: %s", exc)


def decode_frame_data_url(data_url: str):
    """Decode JPEG data-URL to BGR numpy image."""
    import cv2
    import numpy as np

    payload = data_url.split(",", 1)[1] if "," in data_url else data_url
    raw = base64.b64decode(payload)
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def detect_frame(
    img,
    *,
    model_name: str = "yolov8n.pt",
    confidence: float = 0.4,
) -> list[dict[str, Any]]:
    """Run YOLO on a BGR image and return normalized bounding boxes."""
    try:
        if img is None:
            return []

        height, width = img.shape[:2]
        if width == 0 or height == 0:
            return []

        model = _load_model(model_name)
        results = model.predict(img, conf=confidence, verbose=False)

        detections: list[dict[str, Any]] = []
        boxes = results[0].boxes
        if boxes is None:
            return []

        names = results[0].names
        for i, box in enumerate(boxes):
            cls_id = int(box.cls[0])
            class_name = names[cls_id]
            det_type = _TYPE_MAP.get(class_name)
            if det_type is None:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf_pct = round(float(box.conf[0]) * 100)

            detections.append(
                {
                    "id": f"yolo-{i}",
                    "type": det_type,
                    "label": class_name.capitalize(),
                    "confidence": conf_pct,
                    "x": round(x1 / width * 100, 1),
                    "y": round(y1 / height * 100, 1),
                    "width": round((x2 - x1) / width * 100, 1),
                    "height": round((y2 - y1) / height * 100, 1),
                }
            )

        return detections
    except Exception as exc:
        logger.warning("YOLO detection failed: %s", exc)
        return []


def detect_frame_data_url(
    data_url: str,
    *,
    model_name: str = "yolov8n.pt",
    confidence: float = 0.4,
) -> list[dict[str, Any]]:
    """Run YOLO on a JPEG data-URL and return normalized bounding boxes."""
    try:
        img = decode_frame_data_url(data_url)
        return detect_frame(img, model_name=model_name, confidence=confidence)
    except Exception as exc:
        logger.warning("YOLO detection failed: %s", exc)
        return []
