"""Script entrypoint for the PXI eval runner.

When invoked as ``python tests/pxi/evals/run_experiment.py …``, the parent
directory of this file is added to ``sys.path`` automatically by Python.
That shadows the ``tests`` package, so we replace it with the repo root so
``from tests.pxi.evals.runner import main`` resolves correctly.

Prefer ``uv run python -m tests.pxi.evals.runner`` when possible — that
form does not need this shim.
"""

from __future__ import annotations

import sys
from pathlib import Path

_SCRIPT_DIR = str(Path(__file__).resolve().parent)
_REPO_ROOT = str(Path(__file__).resolve().parents[3])
if _SCRIPT_DIR in sys.path:
    sys.path.remove(_SCRIPT_DIR)
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from tests.pxi.evals.runner import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
