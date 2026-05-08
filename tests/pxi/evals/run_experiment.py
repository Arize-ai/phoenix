"""Script entrypoint for the PXI eval runner.

When invoked as ``python tests/pxi/evals/run_experiment.py …``, Python
prepends this script's directory to ``sys.path``. That shadows the
``tests`` package and (because this directory contains a ``types.py``)
also shadows the stdlib ``types`` module — which breaks ``import pathlib``
during interpreter start-up. Before importing anything from the standard
library beyond ``sys`` itself, swap the script directory for the repo
root so ``from tests.pxi.evals.runner import main`` resolves.

Prefer ``uv run python -m tests.pxi.evals.runner`` when possible — that
form does not need this shim because ``-m`` does not put the script
directory on ``sys.path``.
"""

from __future__ import annotations

import sys

# ``__file__`` is .../tests/pxi/evals/run_experiment.py. The repo root is
# four levels up. Use raw string slicing so we don't import os/pathlib
# before sys.path is fixed (those modules transitively import ``types``,
# which would resolve to the sibling ``types.py`` in this directory).
_PARTS = __file__.replace("\\", "/").rstrip("/").split("/")
_SCRIPT_DIR = "/".join(_PARTS[:-1])
_REPO_ROOT = "/".join(_PARTS[:-4])
if _SCRIPT_DIR in sys.path:
    sys.path.remove(_SCRIPT_DIR)
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from tests.pxi.evals.runner import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
