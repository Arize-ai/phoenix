"""Sed spec test runner - executes parsed sed tests against just-bash's sed."""

from dataclasses import dataclass

from just_bash import Bash

from .parser import SedTestCase


@dataclass
class SedTestResult:
    """Result from running a sed test case."""

    test_case: SedTestCase
    passed: bool
    skipped: bool
    skip_reason: str | None = None
    unexpected_pass: bool = False
    actual_output: str | None = None
    actual_stderr: str | None = None
    actual_status: int | None = None
    expected_output: str | None = None
    error: str | None = None


async def run_sed_test_case(test_case: SedTestCase) -> SedTestResult:
    """Run a single sed test case."""
    # Track if test is expected to fail (skip) - we'll still run it
    expected_to_fail = bool(test_case.skip)
    skip_reason = test_case.skip

    # Check for error tests (expected output is "???")
    expects_error = test_case.expected_output == "???"

    # Create files object
    files: dict[str, str] = {
        "/tmp/_keep": "",
    }

    # Add input file if specified
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

        if expects_error:
            # For error tests, we expect non-zero exit code or error output
            got_error = result.exit_code != 0 or result.stderr
            passed = got_error

            if expected_to_fail:
                if passed:
                    return SedTestResult(
                        test_case=test_case,
                        passed=False,
                        skipped=False,
                        unexpected_pass=True,
                        actual_output=result.stdout,
                        actual_stderr=result.stderr,
                        actual_status=result.exit_code,
                        error=f"UNEXPECTED PASS: Test marked skip ({skip_reason}) but now passes.",
                    )
                return SedTestResult(
                    test_case=test_case,
                    passed=True,
                    skipped=True,
                    skip_reason=f"skip: {skip_reason}",
                    actual_output=result.stdout,
                    actual_stderr=result.stderr,
                    actual_status=result.exit_code,
                )

            return SedTestResult(
                test_case=test_case,
                passed=passed,
                skipped=False,
                actual_output=result.stdout,
                actual_stderr=result.stderr,
                actual_status=result.exit_code,
                error=None
                if passed
                else f"Expected error but got success with output: {repr(result.stdout)}",
            )

        actual_output = result.stdout
        expected_output = test_case.expected_output

        passed = actual_output == expected_output

        # Handle skip tests
        if expected_to_fail:
            if passed:
                return SedTestResult(
                    test_case=test_case,
                    passed=False,
                    skipped=False,
                    unexpected_pass=True,
                    actual_output=actual_output,
                    actual_stderr=result.stderr,
                    actual_status=result.exit_code,
                    expected_output=expected_output,
                    error=f"UNEXPECTED PASS: Test marked skip ({skip_reason}) but now passes.",
                )
            return SedTestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"skip: {skip_reason}",
                actual_output=actual_output,
                actual_stderr=result.stderr,
                actual_status=result.exit_code,
                expected_output=expected_output,
            )

        return SedTestResult(
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
            return SedTestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"skip: {skip_reason}",
                error=f"Execution error (expected): {e}",
            )
        return SedTestResult(
            test_case=test_case,
            passed=False,
            skipped=False,
            error=f"Execution error: {e}",
        )


def format_error(result: SedTestResult) -> str:
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

    return "\n".join(lines)
