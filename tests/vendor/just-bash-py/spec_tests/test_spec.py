"""Pytest runner for Oils spec tests.

This runs the imported spec tests from the Oils project against just-bash.
Supports bash, grep, sed, awk, and jq test formats.
"""

from pathlib import Path

import pytest

# AWK tests
from .awk import parse_awk_test_file, run_awk_test_case
from .awk.runner import format_error as format_awk_error

# Grep tests
from .grep import parse_grep_test_file, run_grep_test_case
from .grep.runner import format_error as format_grep_error

# JQ tests
from .jq import parse_jq_test_file, run_jq_test_case
from .jq.runner import format_error as format_jq_error

# Bash tests
from .parser import parse_spec_file
from .runner import format_error, run_test_case

# Sed tests
from .sed import parse_sed_test_file, run_sed_test_case
from .sed.runner import format_error as format_sed_error

# Base directories
SPEC_TESTS_DIR = Path(__file__).parent
BASH_CASES_DIR = SPEC_TESTS_DIR / "bash" / "cases"
GREP_CASES_DIR = SPEC_TESTS_DIR / "grep" / "cases"
SED_CASES_DIR = SPEC_TESTS_DIR / "sed" / "cases"
AWK_CASES_DIR = SPEC_TESTS_DIR / "awk" / "cases"
JQ_CASES_DIR = SPEC_TESTS_DIR / "jq" / "cases"

# Known-failing spec cases/files are marked xfail so the suite stays green on
# documented just-bash conformance gaps while a *new* failure still surfaces.
# Manifests live in _xfail/; see _xfail/README.md for the format and how to
# regenerate them.
XFAIL_DIR = SPEC_TESTS_DIR / "_xfail"
_XFAIL_REASON = "known just-bash conformance gap (see spec_tests/_xfail/)"


def _load_xfail(name: str) -> set[str]:
    """Load a known-failure manifest (one entry per line, '#' comments ignored)."""
    path = XFAIL_DIR / name
    if not path.exists():
        return set()
    return {
        stripped
        for line in path.read_text().splitlines()
        if (stripped := line.strip()) and not stripped.startswith("#")
    }


XFAIL_BASH_CASES = _load_xfail("bash_cases.txt")
XFAIL_BASH_FILES = _load_xfail("bash_files.txt")
XFAIL_AWK_FILES = _load_xfail("awk_files.txt")
XFAIL_JQ_FILES = _load_xfail("jq_files.txt")
XFAIL_GREP_FILES = _load_xfail("grep_files.txt")
XFAIL_SED_FILES = _load_xfail("sed_files.txt")


def _xfail_marks(name: str, xfails: set[str]) -> list:
    """xfail mark (non-strict) for a parametrized entry if it is known-failing."""
    if name in xfails:
        return [pytest.mark.xfail(reason=_XFAIL_REASON, strict=False)]
    return []


def _file_params(files: list[str], xfails: set[str]) -> list:
    """Wrap spec test files as pytest params, xfailing the known-failing ones."""
    return [pytest.param(f, marks=_xfail_marks(f, xfails)) for f in files]


# Bash tests to skip entirely (interactive, requires real shell, etc.)
BASH_SKIP_FILES = {
    # Interactive shell tests - require TTY
    "interactive.test.sh",
    "interactive-parse.test.sh",
    "prompt.test.sh",
    "builtin-history.test.sh",
    "builtin-fc.test.sh",
    "builtin-bind.test.sh",
    # Process/job control - requires real processes
    "background.test.sh",
    "builtin-process.test.sh",
    "builtin-kill.test.sh",
    "builtin-trap.test.sh",
    "builtin-trap-bash.test.sh",
    "builtin-trap-err.test.sh",
    "builtin-times.test.sh",
    "process-sub.test.sh",
    # Shell-specific features not implemented
    "sh-usage.test.sh",
    # ZSH-specific tests
    "zsh-assoc.test.sh",
    # BLE (bash line editor) specific
    "ble-idioms.test.sh",
    # Tests that require external commands or real filesystem
    "unicode.test.sh",
    # Meta/introspection tests
    "print-source-code.test.sh",
    "spec-harness-bug.test.sh",
    # Known differences / divergence docs (not real tests)
    "known-differences.test.sh",
    "divergence.test.sh",
    # Toysh-specific
    "toysh.test.sh",
    "toysh-posix.test.sh",
    # Blog/exploration tests (not spec tests)
    "blog1.test.sh",
    "blog2.test.sh",
    "blog-other1.test.sh",
    "explore-parsing.test.sh",
}

# Grep tests to skip entirely
GREP_SKIP_FILES: set[str] = set()

# Sed tests to skip entirely
SED_SKIP_FILES: set[str] = set()

# AWK tests to skip entirely
AWK_SKIP_FILES = {
    # Files that aren't test scripts
    "NOTES",
    "README.TESTS",
    "REGRESS",
    "cleanup",
    # Data files
    "bib",
    "countries",
    "ctimes",
    "ind",
    "latin1",
    # AWK source files
    "bundle.awk",
    "chem.awk",
    "funstack.awk",
    # Input/output files
    "funstack.in",
    "funstack.ok",
    "lilly.ifile",
    "lilly.out",
    "lilly.progs",
    # C source
    "echo.c",
    # TAR archives
    "arnold-fixes.tar",
    "beebe.tar",
    # Compare files
    "Compare.T1",
    "Compare.drek",
    "Compare.p",
    "Compare.t",
    "Compare.tt",
}

# JQ tests to skip entirely
JQ_SKIP_FILES: set[str] = set()


def get_bash_test_files() -> list[str]:
    """Get list of bash test files to run."""
    if not BASH_CASES_DIR.exists():
        return []
    all_files = sorted(f.name for f in BASH_CASES_DIR.glob("*.test.sh"))
    return [f for f in all_files if f not in BASH_SKIP_FILES]


def get_grep_test_files() -> list[str]:
    """Get list of grep test files to run."""
    if not GREP_CASES_DIR.exists():
        return []
    all_files = sorted(f.name for f in GREP_CASES_DIR.glob("*.tests"))
    return [f for f in all_files if f not in GREP_SKIP_FILES]


def get_sed_test_files() -> list[str]:
    """Get list of sed test files to run."""
    if not SED_CASES_DIR.exists():
        return []
    # Both .tests and .suite files
    tests_files = list(SED_CASES_DIR.glob("*.tests"))
    suite_files = list(SED_CASES_DIR.glob("*.suite"))
    all_files = sorted(f.name for f in tests_files + suite_files)
    return [f for f in all_files if f not in SED_SKIP_FILES]


def get_awk_test_files() -> list[str]:
    """Get list of awk test files to run."""
    if not AWK_CASES_DIR.exists():
        return []
    # T.* files (the systematic test scripts), no file extension (no second dot)
    all_files = sorted(
        f.name
        for f in AWK_CASES_DIR.iterdir()
        if f.name.startswith("T.") and f.name.find(".", 2) == -1
    )
    return [f for f in all_files if f not in AWK_SKIP_FILES]


def get_jq_test_files() -> list[str]:
    """Get list of jq test files to run."""
    if not JQ_CASES_DIR.exists():
        return []
    all_files = sorted(f.name for f in JQ_CASES_DIR.glob("*.test"))
    return [f for f in all_files if f not in JQ_SKIP_FILES]


def truncate_script(script: str, max_len: int = 60) -> str:
    """Truncate script for test name display."""
    lines = script.split("\n")
    meaningful = [
        line.strip() for line in lines if line.strip() and not line.strip().startswith("#")
    ]
    normalized = " | ".join(meaningful)

    if len(normalized) <= max_len:
        return normalized
    return f"{normalized[: max_len - 3]}..."


# ============================================================================
# BASH SPEC TESTS
# ============================================================================


def pytest_generate_tests(metafunc):
    """Generate test parameters for each test case."""
    if "test_file" in metafunc.fixturenames and "test_case" in metafunc.fixturenames:
        test_params = []
        for file_name in get_bash_test_files():
            file_path = BASH_CASES_DIR / file_name
            spec_file = parse_spec_file(file_path)
            for test_case in spec_file.test_cases:
                test_id = f"{file_name}::{test_case.name}[L{test_case.line_number}]"
                marks = _xfail_marks(test_id, XFAIL_BASH_CASES)
                test_params.append(pytest.param(file_name, test_case, id=test_id, marks=marks))
        metafunc.parametrize("test_file,test_case", test_params)


class TestBashSpecTests:
    """Run Oils bash spec tests against just-bash."""

    @pytest.mark.asyncio
    async def test_spec_case(self, test_file, test_case):
        """Run a single spec test case."""
        result = await run_test_case(test_case)

        if result.skipped:
            pytest.skip(result.skip_reason or "Skipped")

        if not result.passed:
            pytest.fail(format_error(result))


@pytest.mark.asyncio
@pytest.mark.parametrize("test_file", _file_params(get_bash_test_files(), XFAIL_BASH_FILES))
async def test_bash_spec_file(test_file: str):
    """Run all tests in a bash spec file."""
    file_path = BASH_CASES_DIR / test_file
    spec_file = parse_spec_file(file_path)

    passed = 0
    failed = 0
    skipped = 0
    failures = []

    for test_case in spec_file.test_cases:
        result = await run_test_case(test_case)

        if result.skipped:
            skipped += 1
        elif result.passed:
            passed += 1
        else:
            failed += 1
            failures.append(format_error(result))

    if failures:
        summary = f"\n\n{'=' * 60}\nSummary: {passed} passed, {failed} failed, {skipped} skipped\n{'=' * 60}\n\n"
        failure_text = "\n\n---\n\n".join(failures[:3])
        if len(failures) > 3:
            failure_text += f"\n\n... and {len(failures) - 3} more failures"
        pytest.fail(summary + failure_text)


# ============================================================================
# GREP SPEC TESTS
# ============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("test_file", _file_params(get_grep_test_files(), XFAIL_GREP_FILES))
async def test_grep_spec_file(test_file: str):
    """Run all tests in a grep spec file."""
    file_path = GREP_CASES_DIR / test_file
    content = file_path.read_text()
    parsed = parse_grep_test_file(content, str(file_path))

    passed = 0
    failed = 0
    skipped = 0
    failures = []

    for test_case in parsed.test_cases:
        result = await run_grep_test_case(test_case)

        if result.skipped:
            skipped += 1
        elif result.passed:
            passed += 1
        else:
            failed += 1
            failures.append(format_grep_error(result))

    if failures:
        summary = f"\n\n{'=' * 60}\n{test_file}: {passed} passed, {failed} failed, {skipped} skipped\n{'=' * 60}\n\n"
        failure_text = "\n\n---\n\n".join(failures[:3])
        if len(failures) > 3:
            failure_text += f"\n\n... and {len(failures) - 3} more failures"
        pytest.fail(summary + failure_text)


# ============================================================================
# SED SPEC TESTS
# ============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("test_file", _file_params(get_sed_test_files(), XFAIL_SED_FILES))
async def test_sed_spec_file(test_file: str):
    """Run all tests in a sed spec file."""
    file_path = SED_CASES_DIR / test_file
    content = file_path.read_text()
    parsed = parse_sed_test_file(content, str(file_path))

    passed = 0
    failed = 0
    skipped = 0
    failures = []

    for test_case in parsed.test_cases:
        result = await run_sed_test_case(test_case)

        if result.skipped:
            skipped += 1
        elif result.passed:
            passed += 1
        else:
            failed += 1
            failures.append(format_sed_error(result))

    if failures:
        summary = f"\n\n{'=' * 60}\n{test_file}: {passed} passed, {failed} failed, {skipped} skipped\n{'=' * 60}\n\n"
        failure_text = "\n\n---\n\n".join(failures[:3])
        if len(failures) > 3:
            failure_text += f"\n\n... and {len(failures) - 3} more failures"
        pytest.fail(summary + failure_text)


# ============================================================================
# AWK SPEC TESTS
# ============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("test_file", _file_params(get_awk_test_files(), XFAIL_AWK_FILES))
async def test_awk_spec_file(test_file: str):
    """Run all tests in an awk spec file."""
    file_path = AWK_CASES_DIR / test_file
    content = file_path.read_text()
    parsed = parse_awk_test_file(content, str(file_path))

    # Skip files with no parseable tests
    if not parsed.test_cases:
        pytest.skip("No parseable tests")

    passed = 0
    failed = 0
    skipped = 0
    failures = []

    for test_case in parsed.test_cases:
        result = await run_awk_test_case(test_case)

        if result.skipped:
            skipped += 1
        elif result.passed:
            passed += 1
        else:
            failed += 1
            failures.append(format_awk_error(result))

    if failures:
        summary = f"\n\n{'=' * 60}\n{test_file}: {passed} passed, {failed} failed, {skipped} skipped\n{'=' * 60}\n\n"
        failure_text = "\n\n---\n\n".join(failures[:3])
        if len(failures) > 3:
            failure_text += f"\n\n... and {len(failures) - 3} more failures"
        pytest.fail(summary + failure_text)


# ============================================================================
# JQ SPEC TESTS
# ============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("test_file", _file_params(get_jq_test_files(), XFAIL_JQ_FILES))
async def test_jq_spec_file(test_file: str):
    """Run all tests in a jq spec file."""
    file_path = JQ_CASES_DIR / test_file
    content = file_path.read_text()
    parsed = parse_jq_test_file(content, str(file_path))

    # Skip files with no parseable tests
    if not parsed.test_cases:
        pytest.skip("No parseable tests")

    passed = 0
    failed = 0
    skipped = 0
    failures = []

    for test_case in parsed.test_cases:
        result = await run_jq_test_case(test_case)

        if result.skipped:
            skipped += 1
        elif result.passed:
            passed += 1
        else:
            failed += 1
            failures.append(format_jq_error(result))

    if failures:
        summary = f"\n\n{'=' * 60}\n{test_file}: {passed} passed, {failed} failed, {skipped} skipped\n{'=' * 60}\n\n"
        failure_text = "\n\n---\n\n".join(failures[:3])
        if len(failures) > 3:
            failure_text += f"\n\n... and {len(failures) - 3} more failures"
        pytest.fail(summary + failure_text)
