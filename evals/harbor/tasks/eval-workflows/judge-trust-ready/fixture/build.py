"""Runs `judge-trust/fixture/build.py`, which builds both twins.

Run from the repository root:

    uv run python evals/harbor/tasks/eval-workflows/judge-trust-ready/fixture/build.py
"""

import runpy
from pathlib import Path

SHARED = Path(__file__).resolve().parents[2] / "judge-trust" / "fixture" / "build.py"
runpy.run_path(str(SHARED), run_name="__main__")
