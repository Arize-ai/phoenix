"""Grep spec test runner - executes parsed grep tests against just-bash's grep."""

from dataclasses import dataclass

from just_bash import Bash

from .parser import GrepTestCase


@dataclass
class GrepTestResult:
    """Result from running a grep test case."""

    test_case: GrepTestCase
    passed: bool
    skipped: bool
    skip_reason: str | None = None
    unexpected_pass: bool = False
    actual_output: str | None = None
    actual_stderr: str | None = None
    actual_status: int | None = None
    expected_output: str | None = None
    error: str | None = None


async def run_grep_test_case(test_case: GrepTestCase) -> GrepTestResult:
    """Run a single grep test case."""
    # Track if test is expected to fail (skip) - we'll still run it
    expected_to_fail = bool(test_case.skip)
    skip_reason = test_case.skip

    # Create files object
    files: dict[str, str] = {
        "/tmp/_keep": "",
    }

    # Add input file if specified (even if empty, for tests that reference it)
    if test_case.infile or "input" in test_case.command:
        files["/tmp/input"] = test_case.infile

    # Create a fresh Bash for each test
    bash = Bash(
        files=files,
        cwd="/tmp",
        env={
            "HOME": "/tmp",
        },
    )

    try:
        # Build the command
        command = test_case.command

        # Replace "input" file reference with /tmp/input
        command = command.replace("input", "/tmp/input")

        # If there's stdin, pipe it
        if test_case.stdin:
            escaped_stdin = test_case.stdin.replace("'", "'\\''")
            script = f"printf '%s' '{escaped_stdin}' | {command}"
        else:
            script = command

        result = await bash.exec(script)

        actual_output = result.stdout
        expected_output = test_case.expected_output

        passed = actual_output == expected_output

        # Handle skip tests
        if expected_to_fail:
            if passed:
                return GrepTestResult(
                    test_case=test_case,
                    passed=False,
                    skipped=False,
                    unexpected_pass=True,
                    actual_output=actual_output,
                    actual_stderr=result.stderr,
                    actual_status=result.exit_code,
                    expected_output=expected_output,
                    error=f"UNEXPECTED PASS: This test was marked skip ({skip_reason}) but now passes.",
                )
            return GrepTestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"skip: {skip_reason}",
                actual_output=actual_output,
                actual_stderr=result.stderr,
                actual_status=result.exit_code,
                expected_output=expected_output,
            )

        return GrepTestResult(
            test_case=test_case,
            passed=passed,
            skipped=False,
            actual_output=actual_output,
            actual_stderr=result.stderr,
            actual_status=result.exit_code,
            expected_output=expected_output,
            error=None
            if passed
            else f"Output mismatch:\n  expected: {repr(expected_output)}\n  actual:   {repr(actual_output)}",
        )

    except Exception as e:
        if expected_to_fail:
            return GrepTestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"skip: {skip_reason}",
                error=f"Execution error (expected): {e}",
            )
        return GrepTestResult(
            test_case=test_case,
            passed=False,
            skipped=False,
            error=f"Execution error: {e}",
        )


def format_error(result: GrepTestResult) -> str:
    """Format error message for debugging."""
    lines: list[str] = []

    if result.error:
        lines.append(result.error)
        lines.append("")

    lines.append("OUTPUT:")
    lines.append(f"  expected: {repr(result.expected_output or '')}")
    lines.append(f"  actual:   {repr(result.actual_output or '')}")

    if result.actual_stderr:
        lines.append("STDERR:")
        lines.append(f"  {repr(result.actual_stderr)}")

    lines.append("")
    lines.append("COMMAND:")
    lines.append(result.test_case.command)

    if result.test_case.stdin:
        lines.append("")
        lines.append("STDIN:")
        lines.append(result.test_case.stdin)

    if result.test_case.infile:
        lines.append("")
        lines.append("INFILE:")
        lines.append(result.test_case.infile)

    return "\n".join(lines)
