"""Prototype: write pytest's assertion-rewritten bytecode for every unit test module without
importing any of them, so xdist workers find the cache warm when they collect."""

from __future__ import annotations

import fnmatch
import os
import sys
import time
from multiprocessing import Pool
from pathlib import Path
from typing import Any

from _pytest.assertion import AssertionState
from _pytest.assertion.rewrite import (
    PYC_TAIL,
    _read_pyc,
    _rewrite_test,
    _write_pyc,
    get_cache_dir,
)
from _pytest.config import get_config

_CONFIG: Any = None
_STATE: Any = None


def _make_config(root: str) -> Any:
    config = get_config()
    config.parse(
        ["--rootdir", root, "-p", "no:phoenix"]
    )
    return config


def _init(root: str) -> None:
    global _CONFIG, _STATE
    _CONFIG = _make_config(root)
    _STATE = AssertionState(_CONFIG, "rewrite")


def _warm(fn: Path) -> bool:
    pyc = get_cache_dir(fn) / (fn.name[:-3] + PYC_TAIL)
    if _read_pyc(fn, pyc, _STATE.trace) is not None:
        return False
    source_stat, co = _rewrite_test(fn, _CONFIG)
    pyc.parent.mkdir(parents=True, exist_ok=True)
    if not _write_pyc(_STATE, co, source_stat, pyc):
        raise OSError(f"could not write {pyc}")
    return True


def main(root: str, tests_dir: str, jobs: int) -> int:
    started = time.perf_counter()
    _init(root)
    patterns = _CONFIG.getini("python_files")
    files = sorted(
        p
        for p in Path(tests_dir).absolute().rglob("*.py")
        if p.name == "conftest.py" or any(fnmatch.fnmatch(p.name, pat) for pat in patterns)
    )
    if jobs > 1:
        with Pool(jobs, initializer=_init, initargs=(root,)) as pool:
            written = sum(pool.map(_warm, files, chunksize=4))
    else:
        written = sum(map(_warm, files))
    print(
        f"rewrote {written} of {len(files)} test modules in "
        f"{time.perf_counter() - started:.1f}s with {jobs} process(es)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else (os.cpu_count() or 1)))
