"""Build `judge-trust-ready` with the generator it shares with `judge-trust`.

The generator in `judge-trust/fixture/build.py` writes both tasks' `fixture/spec.json`
and `tests/truth.json`, so the pair stays in step. Run from the repository root:

    uv run python evals/harbor/tasks/phoenix-evals/judge-trust-ready/fixture/build.py
"""

import runpy
from pathlib import Path

SHARED = Path(__file__).resolve().parents[2] / "judge-trust" / "fixture" / "build.py"
runpy.run_path(str(SHARED), run_name="__main__")
