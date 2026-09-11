"""Write pytest's assertion-rewritten bytecode for the unit test modules before pytest starts.

pytest rewrites the assertions in each test module and conftest it imports and caches the
result as a ``.pyc`` beside the source. Under xdist every worker collects the whole suite, so
on a fresh checkout all of them rewrite and compile the same sources at the same time.
Running this first, with one process per CPU, leaves the cache warm for every worker.

pytest validates a cached file by the source's mtime and size only, so the rewriter here has
to see the same configuration as the real run: the same rootdir, and through it the same
``pyproject.toml``, plus whatever command-line arguments the real run gets, since an
``-o enable_assertion_pass_hook=true`` override changes the rewritten code. The pytest
version is the other input, and it is part of the cache file's name.

The rewriter's functions are private to pytest and are looked up when called, not when this
module is imported, so ``--doctest-modules`` can import it safely and a pytest release that
moves one of them fails only the tox step that runs it, which tox ignores.

Usage: ``python _warm_rewrite_cache.py <rootdir> <tests dir> [pytest args...]``
The process count comes from ``WARM_REWRITE_CACHE_JOBS`` or the CPU count.
"""

from __future__ import annotations

import os
import sys
import time
from multiprocessing import Pool
from pathlib import Path
from typing import Any

from _pytest.assertion import AssertionState
from _pytest.assertion import rewrite as _rewrite
from _pytest.config import get_config
from _pytest.pathlib import fnmatch_ex

_CONFIG: Any = None
_STATE: Any = None


def _configure(rootdir: str, pytest_args: list[str]) -> None:
    """Build the pytest configuration the rewriter reads, once per process."""
    global _CONFIG, _STATE
    config = get_config()
    # Loading the client's pytest plugin imports the whole server; nothing here needs it.
    config.parse(["--rootdir", rootdir, "-p", "no:phoenix", *pytest_args])
    _CONFIG = config
    _STATE = AssertionState(config, "rewrite")


def _warm(source: Path) -> bool:
    """Write the rewritten bytecode for one module unless a valid cache file already exists."""
    pyc = _rewrite.get_cache_dir(source) / (source.name[:-3] + _rewrite.PYC_TAIL)
    if _rewrite._read_pyc(source, pyc, _STATE.trace) is not None:
        return False
    source_stat, code = _rewrite._rewrite_test(source, _CONFIG)
    pyc.parent.mkdir(parents=True, exist_ok=True)
    if not _rewrite._write_pyc(_STATE, code, source_stat, pyc):
        raise OSError(f"could not write {pyc}")
    return True


def rewritten_modules(rootdir: Path, tests_dir: Path, patterns: list[str]) -> list[Path]:
    """The modules pytest rewrites when it collects ``tests_dir``: every file there matching
    ``python_files``, every conftest there, and the conftests of its ancestors up to the
    rootdir, which pytest loads on the way in."""
    ancestors = [d / "conftest.py" for d in tests_dir.parents if rootdir in (d, *d.parents)]
    found = {path for path in ancestors if path.is_file()}
    for path in tests_dir.rglob("*.py"):
        if path.name == "conftest.py" or any(fnmatch_ex(pattern, path) for pattern in patterns):
            found.add(path)
    return sorted(found)


def main(rootdir: str, tests_dir: str, pytest_args: list[str]) -> int:
    started = time.perf_counter()
    jobs = int(os.environ.get("WARM_REWRITE_CACHE_JOBS") or (os.cpu_count() or 1))
    _configure(rootdir, pytest_args)
    files = rewritten_modules(
        Path(rootdir).absolute(),
        Path(tests_dir).absolute(),
        list(_CONFIG.getini("python_files")),
    )
    if jobs > 1:
        with Pool(jobs, initializer=_configure, initargs=(rootdir, pytest_args)) as pool:
            written = sum(pool.map(_warm, files, chunksize=4))
    else:
        written = sum(map(_warm, files))
    print(
        f"warm_rewrite_cache: rewrote {written} of {len(files)} modules "
        f"in {time.perf_counter() - started:.1f}s with {jobs} process(es)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3:]))
