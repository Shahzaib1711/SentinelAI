"""Deploy trained blueprint weights to the API models folder."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CANDIDATES = [
    ROOT / "runs" / "blueprint_v6" / "weights" / "best.pt",
    ROOT / "runs" / "blueprint_v6" / "weights" / "last.pt",
]
OUTPUT = ROOT.parent.parent / "backend" / "app" / "models" / "sentinel_blueprint.pt"


def main() -> None:
    source = next((p for p in CANDIDATES if p.is_file()), None)
    if source is None:
        raise SystemExit(
            "No trained weights found. Run: npm run ml:blueprint:train\n"
            f"Looked in: {', '.join(str(p) for p in CANDIDATES)}"
        )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, OUTPUT)
    print(f"Deployed {source.name} -> {OUTPUT}")


if __name__ == "__main__":
    main()
