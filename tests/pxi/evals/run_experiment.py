from __future__ import annotations

import sys

_SCRIPT_DIR = __file__.rsplit("/", 1)[0]
if _SCRIPT_DIR in sys.path:
    sys.path.remove(_SCRIPT_DIR)
sys.path.insert(0, _SCRIPT_DIR.rsplit("/", 3)[0])

from tests.pxi.evals.runner import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
