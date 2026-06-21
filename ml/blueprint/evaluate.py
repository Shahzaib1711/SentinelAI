"""Evaluate trained blueprint YOLO model on held-out data (test / val / train)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
DATASET_YAML = ROOT / "dataset_v6.yaml"
DEFAULT_MODEL = ROOT.parent.parent / "backend" / "app" / "models" / "sentinel_blueprint.pt"
DEFAULT_RUN_WEIGHTS = ROOT / "runs" / "blueprint_v6" / "weights" / "best.pt"
CLASS_NAMES = ["Blueprint", "wall"]


def _f1(precision: float, recall: float) -> float:
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def _resolve_model(path: Path | None) -> Path:
    if path and path.is_file():
        return path
    if DEFAULT_MODEL.is_file():
        return DEFAULT_MODEL
    if DEFAULT_RUN_WEIGHTS.is_file():
        return DEFAULT_RUN_WEIGHTS
    raise SystemExit(
        "No model weights found. Train first or pass --model path/to/best.pt"
    )


def _count_ground_truth(split: str) -> dict[str, int]:
    """Count labeled instances per class in the dataset split."""
    label_dir = ROOT / "Floor Plan.v6i.yolov8" / split / "labels"
    counts = {name: 0 for name in CLASS_NAMES}
    if not label_dir.is_dir():
        return counts

    for label_file in label_dir.glob("*.txt"):
        for line in label_file.read_text(encoding="utf-8").splitlines():
            parts = line.strip().split()
            if not parts:
                continue
            cls_id = int(float(parts[0]))
            if 0 <= cls_id < len(CLASS_NAMES):
                counts[CLASS_NAMES[cls_id]] += 1
    return counts


def _image_count(split: str) -> int:
    for sub in ("images", "labels"):
        folder = ROOT / "Floor Plan.v6i.yolov8" / split / sub
        if folder.is_dir():
            n = len(list(folder.glob("*")))
            if n:
                return n
    return 0


def _per_class_metrics(metrics) -> list[dict]:
    box = metrics.box
    rows: list[dict] = []

    if hasattr(box, "class_result"):
        for i, name in enumerate(CLASS_NAMES):
            try:
                p, r, ap50, ap = box.class_result(i)
                rows.append(
                    {
                        "class": name,
                        "precision": round(float(p), 4),
                        "recall": round(float(r), 4),
                        "f1": round(_f1(float(p), float(r)), 4),
                        "mAP50": round(float(ap50), 4),
                        "mAP50-95": round(float(ap), 4),
                    }
                )
            except (IndexError, TypeError, ValueError):
                rows.append(
                    {
                        "class": name,
                        "precision": 0.0,
                        "recall": 0.0,
                        "f1": 0.0,
                        "mAP50": 0.0,
                        "mAP50-95": 0.0,
                    }
                )
        return rows

    p = getattr(box, "p", None)
    r = getattr(box, "r", None)
    maps = getattr(box, "maps", None)
    p_list = p.tolist() if p is not None and hasattr(p, "tolist") else []
    r_list = r.tolist() if r is not None and hasattr(r, "tolist") else []
    map_list = (
        maps.tolist()
        if maps is not None and hasattr(maps, "tolist")
        else (list(maps) if maps is not None else [])
    )

    for i, name in enumerate(CLASS_NAMES):
        p_val = float(p_list[i]) if i < len(p_list) else 0.0
        r_val = float(r_list[i]) if i < len(r_list) else 0.0
        ap = float(map_list[i]) if i < len(map_list) else 0.0
        rows.append(
            {
                "class": name,
                "precision": round(p_val, 4),
                "recall": round(r_val, 4),
                "f1": round(_f1(p_val, r_val), 4),
                "mAP50": round(ap, 4),
                "mAP50-95": round(ap, 4),
            }
        )
    return rows


def evaluate(model_path: Path, split: str, imgsz: int, conf: float, iou: float) -> dict:
    if not DATASET_YAML.is_file():
        raise SystemExit(f"Dataset yaml missing: {DATASET_YAML}")

    gt_counts = _count_ground_truth(split)
    warnings: list[str] = []
    for name, count in gt_counts.items():
        if count == 0:
            warnings.append(
                f"No '{name}' labels in {split} split — per-class metrics for that class are not meaningful."
            )

    model = YOLO(str(model_path))
    metrics = model.val(
        data=str(DATASET_YAML),
        split=split,
        imgsz=imgsz,
        conf=conf,
        iou=iou,
        plots=True,
        save_json=True,
        project=str(ROOT / "runs"),
        name=f"eval_{split}",
        exist_ok=True,
        verbose=False,
    )

    box = metrics.box
    overall_precision = float(box.mp)
    overall_recall = float(box.mr)
    overall_f1 = _f1(overall_precision, overall_recall)
    map50 = float(box.map50)
    map50_95 = float(box.map)

    per_class = _per_class_metrics(metrics)
    macro_precision = sum(c["precision"] for c in per_class) / max(len(per_class), 1)
    macro_recall = sum(c["recall"] for c in per_class) / max(len(per_class), 1)
    macro_f1 = sum(c["f1"] for c in per_class) / max(len(per_class), 1)

    return {
        "model": str(model_path),
        "dataset": str(DATASET_YAML),
        "split": split,
        "conf_threshold": conf,
        "iou_threshold": iou,
        "image_count": _image_count(split),
        "ground_truth_counts": gt_counts,
        "overall": {
            "precision": round(overall_precision, 4),
            "recall": round(overall_recall, 4),
            "f1": round(overall_f1, 4),
            "mAP50": round(map50, 4),
            "mAP50-95": round(map50_95, 4),
            "macro_precision": round(macro_precision, 4),
            "macro_recall": round(macro_recall, 4),
            "macro_f1": round(macro_f1, 4),
        },
        "per_class": per_class,
        "warnings": warnings,
        "notes": {
            "accuracy": (
                "Object detection has no single 'accuracy' like classification. "
                "Use precision, recall, F1, and mAP instead."
            ),
            "recommended_split": (
                "Use --split test for wall evaluation. The Roboflow v6 val split "
                "only contains Blueprint labels."
            ),
            "artifacts": str(ROOT / "runs" / f"eval_{split}"),
        },
    }


def _print_report(report: dict) -> None:
    print("\n=== Blueprint model evaluation ===")
    print(f"Model : {report['model']}")
    print(f"Split : {report['split']} ({report['image_count']} images)")
    print(f"Conf  : {report['conf_threshold']}  |  IoU : {report['iou_threshold']}")
    print(
        "GT labels:",
        ", ".join(f"{k}={v}" for k, v in report["ground_truth_counts"].items()),
    )

    for warning in report.get("warnings", []):
        print(f"WARNING: {warning}")

    print()
    o = report["overall"]
    print("Overall metrics")
    print(f"  Precision     : {o['precision']:.4f}")
    print(f"  Recall        : {o['recall']:.4f}")
    print(f"  F1 score      : {o['f1']:.4f}")
    print(f"  Macro F1      : {o['macro_f1']:.4f}")
    print(f"  mAP@50        : {o['mAP50']:.4f}")
    print(f"  mAP@50-95     : {o['mAP50-95']:.4f}\n")

    print("Per-class metrics")
    for row in report["per_class"]:
        print(
            f"  {row['class']:10}  "
            f"P={row['precision']:.4f}  "
            f"R={row['recall']:.4f}  "
            f"F1={row['f1']:.4f}  "
            f"mAP@50={row['mAP50']:.4f}  "
            f"mAP@50-95={row['mAP50-95']:.4f}"
        )

    print(f"\nSaved plots + JSON under: {report['notes']['artifacts']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate blueprint YOLO on test split")
    parser.add_argument("--model", type=Path, default=None, help="Path to .pt weights")
    parser.add_argument("--split", choices=["test", "val", "train"], default="test")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--iou", type=float, default=0.7)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "runs" / "eval_report.json",
        help="Where to write JSON report",
    )
    args = parser.parse_args()

    model_path = _resolve_model(args.model)
    report = evaluate(model_path, args.split, args.imgsz, args.conf, args.iou)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    _print_report(report)
    print(f"JSON report -> {args.output}")


if __name__ == "__main__":
    main()
