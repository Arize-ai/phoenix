# /// script
# requires-python = ">=3.12"
# dependencies = ["anthropic==1.12.1", "PyJWT[crypto]==2.15.1"]
# ///
"""Launch trusted factory entrypoints with Python isolated mode."""

import os
import sys
from pathlib import Path

directory = Path(__file__).resolve().parent
entry = sys.argv[1]
if entry not in {"dispatch", "review", "finish"}:
    raise SystemExit("Expected dispatch, review or finish")
os.execv(
    sys.executable,
    [
        sys.executable,
        "-I",
        "-c",
        "import runpy,sys; directory=sys.argv.pop(1); script=sys.argv.pop(1); "
        "sys.argv[0]=script; sys.path.insert(0,directory); "
        "runpy.run_path(script,run_name='__main__')",
        str(directory),
        str(directory / f"{entry}.py"),
        *sys.argv[2:],
    ],
)
