"""Face detection and embedding extraction (OpenCV YuNet + SFace)."""

from __future__ import annotations

import base64
import logging
import threading
import urllib.request
from pathlib import Path
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
YUNET_FILE = "face_detection_yunet_2023mar.onnx"
SFACE_FILE = "face_recognition_sface_2021dec.onnx"

YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
SFACE_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_recognition_sface/face_recognition_sface_2021dec.onnx"
)

_detector: cv2.FaceDetectorYN | None = None
_recognizer: cv2.FaceRecognizerSF | None = None
_model_lock = threading.Lock()


def _download_model(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading face model: %s", dest.name)
    urllib.request.urlretrieve(url, dest)


def ensure_models() -> None:
    yunet_path = MODEL_DIR / YUNET_FILE
    sface_path = MODEL_DIR / SFACE_FILE
    if not yunet_path.exists():
        _download_model(YUNET_URL, yunet_path)
    if not sface_path.exists():
        _download_model(SFACE_URL, sface_path)


def _get_models() -> tuple[cv2.FaceDetectorYN, cv2.FaceRecognizerSF]:
    global _detector, _recognizer
    if _detector is not None and _recognizer is not None:
        return _detector, _recognizer

    with _model_lock:
        if _detector is not None and _recognizer is not None:
            return _detector, _recognizer

        ensure_models()
        yunet_path = str(MODEL_DIR / YUNET_FILE)
        sface_path = str(MODEL_DIR / SFACE_FILE)

        _detector = cv2.FaceDetectorYN.create(
            yunet_path,
            "",
            (320, 320),
            score_threshold=0.55,
            nms_threshold=0.3,
            top_k=5000,
        )
        _recognizer = cv2.FaceRecognizerSF.create(sface_path, "")
        logger.info("Face recognition models ready")
        return _detector, _recognizer


def decode_image(source: str) -> np.ndarray | None:
    try:
        payload = source.split(",", 1)[1] if "," in source else source
        raw = base64.b64decode(payload)
        arr = np.frombuffer(raw, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as exc:
        logger.warning("Image decode failed: %s", exc)
        return None


def detect_faces(img: np.ndarray) -> list[np.ndarray]:
    detector, _ = _get_models()
    h, w = img.shape[:2]
    if h < 20 or w < 20:
        return []
    detector.setInputSize((w, h))
    _, faces = detector.detect(img)
    if faces is None:
        return []
    return [faces[i] for i in range(faces.shape[0])]


def _largest_face(faces: list[np.ndarray]) -> np.ndarray | None:
    if not faces:
        return None

    def area(face: np.ndarray) -> float:
        return float(face[2] * face[3])

    return max(faces, key=area)


def extract_embedding(img: np.ndarray, face: np.ndarray) -> np.ndarray:
    _, recognizer = _get_models()
    aligned = recognizer.alignCrop(img, face)
    feature = recognizer.feature(aligned)
    return feature.flatten()


def embedding_from_photo(source: str) -> tuple[list[float], np.ndarray | None]:
    """
    Extract face embedding from enrollment photo (data URL or base64).
    Returns (embedding list, thumbnail BGR crop optional).
    """
    img = decode_image(source)
    if img is None:
        raise ValueError("Could not decode image")

    faces = detect_faces(img)
    face = _largest_face(faces)
    if face is None:
        raise ValueError(
            "No face detected in photo. Use a clear front-facing portrait with good lighting."
        )

    embedding = extract_embedding(img, face)
    return embedding.tolist(), img


def extract_embedding_from_person_crop(
    frame_bgr: np.ndarray,
    x_pct: float,
    y_pct: float,
    w_pct: float,
    h_pct: float,
) -> np.ndarray | None:
    """Try to find a face inside a YOLO person bounding box (head / upper torso)."""
    crop, face = _crop_person_head_region(frame_bgr, x_pct, y_pct, w_pct, h_pct)
    if crop is None or face is None:
        return None
    return extract_embedding(crop, face)


def _crop_person_head_region(
    frame_bgr: np.ndarray,
    x_pct: float,
    y_pct: float,
    w_pct: float,
    h_pct: float,
) -> tuple[np.ndarray | None, np.ndarray | None]:
    fh, fw = frame_bgr.shape[:2]
    pad_x = w_pct * 0.1
    head_h = h_pct * 0.65
    x1 = max(0, int((x_pct - pad_x) / 100 * fw))
    y1 = max(0, int((y_pct - h_pct * 0.02) / 100 * fh))
    x2 = min(fw, int((x_pct + w_pct + pad_x) / 100 * fw))
    y2 = min(fh, int((y_pct + head_h) / 100 * fh))

    crop = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0 or crop.shape[0] < 40 or crop.shape[1] < 40:
        return None, None

    face = _largest_face(detect_faces(crop))
    return crop, face


def extract_face_from_person_crop(
    frame_bgr: np.ndarray,
    x_pct: float,
    y_pct: float,
    w_pct: float,
    h_pct: float,
) -> tuple[np.ndarray, str] | None:
    """Extract embedding and a JPEG data-URL portrait from a person bbox."""
    crop, face = _crop_person_head_region(frame_bgr, x_pct, y_pct, w_pct, h_pct)
    if crop is None or face is None:
        return None

    embedding = extract_embedding(crop, face)
    fx, fy, fw, fh = (int(face[i]) for i in range(4))
    pad = max(4, int(min(fw, fh) * 0.15))
    cx1 = max(0, fx - pad)
    cy1 = max(0, fy - pad)
    cx2 = min(crop.shape[1], fx + fw + pad)
    cy2 = min(crop.shape[0], fy + fh + pad)
    face_img = crop[cy1:cy2, cx1:cx2]
    if face_img.size == 0:
        face_img = crop

    ok, buf = cv2.imencode(".jpg", face_img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        return embedding, ""

    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return embedding, f"data:image/jpeg;base64,{b64}"


def match_score(embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
    """Cosine similarity (higher = better match). OpenCV SFace FR_COSINE."""
    _, recognizer = _get_models()
    a = embedding_a.reshape(1, -1).astype(np.float32)
    b = embedding_b.reshape(1, -1).astype(np.float32)
    return float(recognizer.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


def to_numpy_embedding(stored: Any) -> np.ndarray:
    return np.array(stored, dtype=np.float32)
