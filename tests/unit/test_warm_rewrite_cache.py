import os
import subprocess
import sys
from pathlib import Path

import pytest

_rewrite = pytest.importorskip("_pytest.assertion.rewrite")
if not all(hasattr(_rewrite, name) for name in ("_read_pyc", "_rewrite_test", "_write_pyc")):
    pytest.skip(
        "this pytest release moved the rewriter's private functions", allow_module_level=True
    )

_SCRIPT = Path(__file__).with_name("_warm_rewrite_cache.py")
_SUBPROCESS_ENV = {**os.environ, "WARM_REWRITE_CACHE_JOBS": "1"}


def _warm(rootdir: Path, tests_dir: Path, *pytest_args: str, jobs: int = 1) -> str:
    result = subprocess.run(
        [sys.executable, str(_SCRIPT), str(rootdir), str(tests_dir), *pytest_args],
        capture_output=True,
        text=True,
        check=True,
        env={**_SUBPROCESS_ENV, "WARM_REWRITE_CACHE_JOBS": str(jobs)},
    )
    return result.stdout.strip()


def _cache_file(source: Path) -> Path:
    return Path(_rewrite.get_cache_dir(source)) / (source.name[:-3] + str(_rewrite.PYC_TAIL))


def _suite(tmp_path: Path) -> Path:
    (tmp_path / "pyproject.toml").write_text(
        '[tool.pytest.ini_options]\naddopts = ["-p", "no:phoenix", "-p", "no:cacheprovider"]\n'
    )
    (tmp_path / "conftest.py").write_text("ROOT = True\n")
    tests_dir = tmp_path / "suite"
    tests_dir.mkdir()
    (tests_dir / "conftest.py").write_text("SUITE = True\n")
    (tests_dir / "test_sample.py").write_text("def test_it() -> None:\n    assert 1 == 1\n")
    (tests_dir / "helper.py").write_text("VALUE = 1\n")
    return tests_dir


def test_pytest_reads_the_warmed_bytecode_instead_of_rewriting(tmp_path: Path) -> None:
    tests_dir = _suite(tmp_path)
    assert _warm(tmp_path, tests_dir).startswith("warm_rewrite_cache: rewrote 3 of 3 modules")
    for source in (
        tests_dir / "test_sample.py",
        tests_dir / "conftest.py",
        tmp_path / "conftest.py",
    ):
        assert _rewrite._read_pyc(source, _cache_file(source)) is not None, source
    assert not _cache_file(tests_dir / "helper.py").exists()

    # A rejected cache file is rewritten and replaced, so an untouched file was accepted. For
    # the test module pytest's own trace says so as well; the conftests are imported while
    # arguments are still being parsed, before the debug writer is attached.
    sources = (tests_dir / "test_sample.py", tests_dir / "conftest.py", tmp_path / "conftest.py")
    before = {source: _cache_file(source).stat().st_mtime_ns for source in sources}
    debug_log = tmp_path / "pytestdebug.log"
    subprocess.run(
        [sys.executable, "-m", "pytest", "-q", str(tests_dir), f"--debug={debug_log}"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=True,
        env={**_SUBPROCESS_ENV, "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"},
    )
    assert {source: _cache_file(source).stat().st_mtime_ns for source in sources} == before
    trace = debug_log.read_text()
    module = tests_dir / "test_sample.py"
    assert f"found cached rewritten pyc for {module}" in trace
    assert f"rewriting {module!r}" not in trace

    assert _warm(tmp_path, tests_dir, jobs=2).startswith("warm_rewrite_cache: rewrote 0 of 3")


def test_a_changed_source_is_rewritten(tmp_path: Path) -> None:
    tests_dir = _suite(tmp_path)
    module = tests_dir / "test_sample.py"
    _warm(tmp_path, tests_dir)

    module.write_text("def test_it() -> None:\n    assert 1 == 1  # edited\n")
    assert _rewrite._read_pyc(module, _cache_file(module)) is None
    assert _warm(tmp_path, tests_dir).startswith("warm_rewrite_cache: rewrote 1 of 3 modules")
    assert _rewrite._read_pyc(module, _cache_file(module)) is not None


def test_the_real_runs_overrides_shape_the_rewrite(tmp_path: Path) -> None:
    tests_dir = _suite(tmp_path)
    module = tests_dir / "test_sample.py"
    _warm(tmp_path, tests_dir)
    plain = _cache_file(module).read_bytes()

    _cache_file(module).unlink()
    _warm(tmp_path, tests_dir, "-o", "enable_assertion_pass_hook=true")
    assert _cache_file(module).read_bytes() != plain
