"""Compatibility entry point for the safe, insert-only syllabus importer."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.import_verified_syllabus import main


if __name__ == "__main__":
    raise SystemExit(main())
