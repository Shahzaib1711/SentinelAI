"""Floor-plan object detection labels (sanatladkat YOLOv8)."""

from __future__ import annotations

FLOOR_PLAN_LABELS: tuple[str, ...] = (
    "Column",
    "Curtain Wall",
    "Dimension",
    "Door",
    "Railing",
    "Sliding Door",
    "Stair Case",
    "Wall",
    "Window",
)

_LABEL_TO_BUCKET: dict[str, str] = {
    "column": "columns",
    "curtain wall": "walls",
    "dimension": "dimensions",
    "door": "doors",
    "railing": "railings",
    "sliding door": "doors",
    "stair case": "columns",
    "wall": "walls",
    "window": "windows",
}

DEFAULT_ACTIVE_LABELS: frozenset[str] = frozenset(
    label.strip().lower() for label in FLOOR_PLAN_LABELS
)


def normalize_label(name: str) -> str:
    return name.strip().lower()


def label_allowed(name: str, active_labels: frozenset[str] | set[str] | None) -> bool:
    if not active_labels:
        return True
    return normalize_label(name) in {normalize_label(x) for x in active_labels}


def bucket_for_label(name: str) -> str | None:
    return _LABEL_TO_BUCKET.get(normalize_label(name))
