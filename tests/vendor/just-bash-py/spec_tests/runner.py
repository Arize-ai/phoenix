"""Spec test runner - executes parsed spec tests against Bash."""

import re
from dataclasses import dataclass

from just_bash import Bash
from just_bash.commands import create_command_registry

from .helpers import get_test_helper_commands
from .parser import (
    ParsedSpecFile,
    TestCase,
    get_acceptable_statuses,
    get_expected_status,
    get_expected_stderr,
    get_expected_stdout,
    is_not_implemented_for_bash,
)


@dataclass
class TestResult:
    """Result from running a test case."""

    test_case: TestCase
    passed: bool
    skipped: bool
    skip_reason: str | None = None
    unexpected_pass: bool = False
    actual_stdout: str | None = None
    actual_stderr: str | None = None
    actual_status: int | None = None
    expected_stdout: str | None = None
    expected_stderr: str | None = None
    expected_status: int | None = None
    error: str | None = None


async def run_test_case(test_case: TestCase) -> TestResult:
    """Run a single test case."""
    # Track if test is expected to fail (## SKIP) - we'll still run it
    expected_to_fail = bool(test_case.skip)
    skip_reason = test_case.skip

    # These are true skips - we can't run these tests at all
    if is_not_implemented_for_bash(test_case):
        return TestResult(
            test_case=test_case,
            passed=True,
            skipped=True,
            skip_reason="N-I (Not Implemented) for bash",
        )

    # Skip empty scripts
    if not test_case.script.strip():
        return TestResult(
            test_case=test_case,
            passed=True,
            skipped=True,
            skip_reason="Empty script",
        )

    # Skip xtrace tests (set -x is accepted but trace output not implemented)
    if _requires_xtrace(test_case):
        return TestResult(
            test_case=test_case,
            passed=True,
            skipped=True,
            skip_reason="xtrace (set -x) trace output not implemented",
        )

    # Create command registry with test helpers
    commands = create_command_registry()
    for cmd in get_test_helper_commands():
        commands[cmd.name] = cmd

    # Create a fresh Bash for each test
    # Note: Don't use dotfiles here as they interfere with glob tests like "echo .*"
    bash = Bash(
        files={
            "/tmp/_keep": "",
            # Set up /dev/zero as a character device placeholder
            "/dev/zero": "",
            # Set up /bin directory
            "/bin/_keep": "",
        },
        cwd="/tmp",
        env={
            "HOME": "/tmp",
            "TMP": "/tmp",
            "TMPDIR": "/tmp",
            "SH": "bash",  # For tests that check which shell is running
        },
        commands=commands,
    )

    # Set up /tmp with sticky bit (mode 1777) for tests that check it
    await bash.fs.chmod("/tmp", 0o1777)

    try:
        # Execute the test script
        result = await bash.exec(test_case.script)

        expected_stdout = get_expected_stdout(test_case)
        expected_stderr = get_expected_stderr(test_case)
        expected_status = get_expected_status(test_case)

        passed = True
        errors: list[str] = []

        # Compare stdout
        if expected_stdout is not None:
            normalized_actual = _normalize_output(result.stdout)
            normalized_expected = _normalize_output(expected_stdout)

            if normalized_actual != normalized_expected:
                passed = False
                errors.append(
                    f"stdout mismatch:\n  expected: {repr(normalized_expected)}\n  actual:   {repr(normalized_actual)}"
                )

        # Compare stderr
        if expected_stderr is not None:
            normalized_actual = _normalize_output(result.stderr)
            normalized_expected = _normalize_output(expected_stderr)

            if normalized_actual != normalized_expected:
                passed = False
                errors.append(
                    f"stderr mismatch:\n  expected: {repr(normalized_expected)}\n  actual:   {repr(normalized_actual)}"
                )

        # Compare exit status
        # Use get_acceptable_statuses to handle OK variants (e.g., "## OK bash status: 1")
        acceptable_statuses = get_acceptable_statuses(test_case)
        if acceptable_statuses:
            if result.exit_code not in acceptable_statuses:
                passed = False
                if len(acceptable_statuses) == 1:
                    status_desc = str(acceptable_statuses[0])
                else:
                    status_desc = f"one of [{', '.join(str(s) for s in acceptable_statuses)}]"
                errors.append(
                    f"status mismatch: expected {status_desc}, got {result.exit_code}"
                )

        # Handle ## SKIP tests: if expected to fail but actually passed, that's an unexpected pass
        if expected_to_fail:
            if passed:
                # Test was expected to fail but passed - report as failure so we can unskip it
                return TestResult(
                    test_case=test_case,
                    passed=False,
                    skipped=False,
                    unexpected_pass=True,
                    actual_stdout=result.stdout,
                    actual_stderr=result.stderr,
                    actual_status=result.exit_code,
                    expected_stdout=expected_stdout,
                    expected_stderr=expected_stderr,
                    expected_status=expected_status,
                    error=f"UNEXPECTED PASS: This test was marked ## SKIP ({skip_reason}) but now passes. Please remove the ## SKIP directive.",
                )
            # Test was expected to fail and did fail - that's fine, mark as skipped
            return TestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"## SKIP: {skip_reason}",
                actual_stdout=result.stdout,
                actual_stderr=result.stderr,
                actual_status=result.exit_code,
                expected_stdout=expected_stdout,
                expected_stderr=expected_stderr,
                expected_status=expected_status,
            )

        return TestResult(
            test_case=test_case,
            passed=passed,
            skipped=False,
            actual_stdout=result.stdout,
            actual_stderr=result.stderr,
            actual_status=result.exit_code,
            expected_stdout=expected_stdout,
            expected_stderr=expected_stderr,
            expected_status=expected_status,
            error="\n".join(errors) if errors else None,
        )

    except Exception as e:
        # If test was expected to fail and threw an error, that counts as expected failure
        if expected_to_fail:
            return TestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"## SKIP: {skip_reason}",
                error=f"Execution error (expected): {e}",
            )
        return TestResult(
            test_case=test_case,
            passed=False,
            skipped=False,
            error=f"Execution error: {e}",
        )


async def run_spec_file(spec_file: ParsedSpecFile) -> list[TestResult]:
    """Run all tests in a parsed spec file."""
    results: list[TestResult] = []

    for test_case in spec_file.test_cases:
        result = await run_test_case(test_case)
        results.append(result)

    return results


def _requires_xtrace(test_case: TestCase) -> bool:
    """Check if a test requires xtrace (set -x) trace output."""
    # Check if script uses set -x and expects trace output in stderr
    if re.search(r"\bset\s+-x\b", test_case.script) or re.search(
        r"\bset\s+-o\s+xtrace\b", test_case.script
    ):
        # Check if test expects xtrace-style output (lines starting with +)
        expected_stderr = get_expected_stderr(test_case)
        if expected_stderr and re.search(r"^\+\s", expected_stderr, re.MULTILINE):
            return True
    return False


def _normalize_output(output: str) -> str:
    """Normalize output for comparison.

    - Trim trailing whitespace from each line
    - Ensure consistent line endings
    - Trim trailing newline
    """
    return re.sub(r"\n+$", "", "\n".join(line.rstrip() for line in output.split("\n")))


def get_results_summary(results: list[TestResult]) -> dict:
    """Get summary statistics for test results."""
    return {
        "total": len(results),
        "passed": sum(1 for r in results if r.passed and not r.skipped),
        "failed": sum(1 for r in results if not r.passed),
        "skipped": sum(1 for r in results if r.skipped),
    }


def format_error(result: TestResult) -> str:
    """Format a test result error for display."""
    lines = [
        f"Test: {result.test_case.name} (line {result.test_case.line_number})",
        "",
    ]

    if result.error:
        lines.append(result.error)
        lines.append("")

    if result.expected_stdout is not None or result.actual_stdout is not None:
        lines.append(f"Expected stdout: {repr(result.expected_stdout)}")
        lines.append(f"Actual stdout:   {repr(result.actual_stdout)}")

    if result.expected_stderr is not None or result.actual_stderr is not None:
        lines.append(f"Expected stderr: {repr(result.expected_stderr)}")
        lines.append(f"Actual stderr:   {repr(result.actual_stderr)}")

    if result.expected_status is not None or result.actual_status is not None:
        lines.append(f"Expected status: {result.expected_status}")
        lines.append(f"Actual status:   {result.actual_status}")

    lines.append("")
    lines.append("Script:")
    lines.append("---")
    lines.append(result.test_case.script)
    lines.append("---")

    return "\n".join(lines)
