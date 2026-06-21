"""Train SentinelAI floor-plan layout model (Blueprint + wall) on Roboflow v6."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "Floor Plan.v6i.yolov8"
DATASET_YAML = ROOT / "dataset_v6.yaml"
DEFAULT_OUTPUT = ROOT.parent.parent / "backend" / "app" / "models" / "sentinel_blueprint.pt"


def write_dataset_yaml() -> Path:
    """Roboflow export paths are wrong; write a corrected yaml for Ultralytics."""
    yaml = DATASET_YAML
    yaml.write_text(
        "\n".join(
            [
                f"path: {DATASET_DIR.as_posix()}",
                "train: train/images",
                "val: valid/images",
                "test: test/images",
                "",
                "nc: 2",
                "names: ['Blueprint', 'wall']",
                "",
            ]
        ),
        encoding="utf-8",
    )
    return yaml


def main() -> None:
    parser = argparse.ArgumentParser(description="Train blueprint layout YOLO model")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--model", type=str, default="yolov8n.pt")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    if not DATASET_DIR.is_dir():
        raise SystemExit(f"Dataset not found: {DATASET_DIR}")

    data_yaml = write_dataset_yaml()
    run = YOLO(args.model).train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=str(ROOT / "runs"),
        name="blueprint_v6",
        exist_ok=True,
        hsv_h=0.02,
        hsv_s=0.8,
        hsv_v=0.5,
        degrees=5.0,
        fliplr=0.5,
        flipud=0.5,
    )

    best = Path(run.save_dir) / "weights" / "best.pt"
    if not best.is_file():
        raise SystemExit(f"Training finished but weights missing: {best}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, args.output)
    print(f"Deployed model -> {args.output}")


if __name__ == "__main__":
    main()
