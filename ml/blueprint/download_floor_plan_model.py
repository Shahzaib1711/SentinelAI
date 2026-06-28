"""Download architectural floor-plan YOLO weights (sanatladkat/floor-plan-object-detection)."""

from __future__ import annotations

import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENDOR_DIR = ROOT / "vendor"
OUTPUT = ROOT.parent.parent / "backend" / "app" / "models" / "floor_plan_best.pt"

# GitHub release asset + raw fallback
URLS = [
    "https://github.com/sanatladkat/floor-plan-object-detection/releases/download/v1.0.0/best.pt",
    "https://github.com/sanatladkat/floor-plan-object-detection/raw/main/best.pt",
]


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}")
    print(f"  -> {dest}")
    urllib.request.urlretrieve(url, dest)  # noqa: S310


def main() -> None:
    if OUTPUT.is_file():
        print(f"Already exists: {OUTPUT}")
        print("Delete the file to re-download.")
        return

    VENDOR_DIR.mkdir(parents=True, exist_ok=True)
    tmp = VENDOR_DIR / "best.pt.download"
    last_error: Exception | None = None

    for url in URLS:
        try:
            download(url, tmp)
            if tmp.stat().st_size < 1_000_000:
                raise OSError(f"Download too small ({tmp.stat().st_size} bytes) — likely not a model file")
            shutil.copy2(tmp, OUTPUT)
            print(f"Deployed -> {OUTPUT}")
            return
        except Exception as exc:
            last_error = exc
            print(f"Failed: {exc}", file=sys.stderr)
            if tmp.is_file():
                tmp.unlink(missing_ok=True)

    raise SystemExit(
        "Could not download floor-plan model. Download best.pt manually from\n"
        "https://github.com/sanatladkat/floor-plan-object-detection\n"
        f"and save as: {OUTPUT}\n"
        f"Last error: {last_error}"
    )


if __name__ == "__main__":
    main()
