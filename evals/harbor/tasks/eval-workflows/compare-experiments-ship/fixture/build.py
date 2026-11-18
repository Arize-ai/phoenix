"""Runs the generator in `compare-experiments`, which builds both twins.

Run from the repository root:

    uv run python evals/harbor/tasks/eval-workflows/compare-experiments-ship/fixture/build.py
"""

import runpy
from pathlib import Path

SHARED = Path(__file__).resolve().parents[2] / "compare-experiments" / "fixture" / "build.py"
runpy.run_path(str(SHARED), run_name="__main__")
