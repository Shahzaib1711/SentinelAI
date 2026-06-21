"""Normalize varied floor-plan styles before ML inference and wall extraction."""

from __future__ import annotations

import cv2
import numpy as np


def colored_line_mask(bgr: np.ndarray) -> np.ndarray:
    """Pick up saturated plan lines (blue/cyan/red) common in rendered floor plans."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    masks = [
        cv2.inRange(hsv, (85, 35, 35), (140, 255, 255)),   # blue walls
        cv2.inRange(hsv, (0, 40, 40), (12, 255, 255)),     # red accents
        cv2.inRange(hsv, (35, 40, 40), (90, 255, 255)),    # green accents
    ]
    combined = np.zeros(bgr.shape[:2], dtype=np.uint8)
    for mask in masks:
        combined = cv2.bitwise_or(combined, mask)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    return cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=1)


def ink_mask(gray: np.ndarray, bgr: np.ndarray | None = None) -> np.ndarray:
    """Dark strokes and colored architectural lines."""
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    if float(np.mean(blur)) > 127:
        _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    adaptive = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 3
    )
    ink = cv2.bitwise_or(binary, adaptive)
    if bgr is not None:
        ink = cv2.bitwise_or(ink, colored_line_mask(bgr))
    return ink


def normalize_for_ml(bgr: np.ndarray) -> np.ndarray:
    """Convert colored/rendered plans into black-on-white line art for YOLO."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    lines = ink_mask(gray, bgr)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    lines = cv2.morphologyEx(lines, cv2.MORPH_CLOSE, kernel, iterations=1)
    normalized = np.full_like(bgr, 255)
    normalized[lines > 0] = (0, 0, 0)
    return normalized


def auto_orient(bgr: np.ndarray) -> np.ndarray:
    """Rotate upright when the plan is clearly landscape with text along the short side."""
    h, w = bgr.shape[:2]
    if h <= w:
        return bgr
    # Tall images are often rotated blueprints — try 90° CCW.
    return cv2.rotate(bgr, cv2.ROTATE_90_COUNTERCLOCKWISE)
