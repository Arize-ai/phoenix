"""JQ spec test runner - executes parsed jq tests against just-bash's jq."""

import json
from dataclasses import dataclass

from just_bash import Bash

from .parser import JqTestCase


@dataclass
class JqTestResult:
    """Result from running a jq test case."""

    test_case: JqTestCase
    passed: bool
    skipped: bool
    skip_reason: str | None = None
    unexpected_pass: bool = False
    actual_outputs: list[str] | None = None
    actual_stderr: str | None = None
    actual_status: int | None = None
    expected_outputs: list[str] | None = None
    error: str | None = None


def normalize_outputs(output: str) -> list[str]:
    """Normalize outputs for comparison."""
    return [line.strip() for line in output.split("\n") if line.strip()]


def normalize_json(s: str) -> str:
    """Normalize a JSON string to canonical form for comparison."""
    try:
        parsed = json.loads(s)
        return json.dumps(parsed, sort_keys=True)
    except json.JSONDecodeError:
        return s


def arrays_equal(a: list[str], b: list[str]) -> bool:
    """Compare two arrays for equality, with JSON normalization."""
    if len(a) != len(b):
        return False
    for i in range(len(a)):
        if normalize_json(a[i]) != normalize_json(b[i]):
            return False
    return True


async def run_jq_test_case(test_case: JqTestCase) -> JqTestResult:
    """Run a single jq test case."""
    # Track if test is expected to fail (skip) - we'll still run it
    expected_to_fail = bool(test_case.skip)
    skip_reason = test_case.skip

    # Skip tests with no expected output (unless it's an error test)
    if (
        not test_case.expects_error
        and not test_case.expected_outputs
        and test_case.skip
    ):
        return JqTestResult(
            test_case=test_case,
            passed=True,
            skipped=True,
            skip_reason=f"No expected output (parser issue): {test_case.skip}",
        )

    # Create a fresh Bash for each test
    bash = Bash(
        files={
            "/tmp/_keep": "",
        },
        cwd="/tmp",
        env={
            "HOME": "/tmp",
        },
    )

    try:
        # Build the jq command
        # Escape single quotes in program and input
        escaped_program = test_case.program.replace("'", "'\\''")
        escaped_input = test_case.input.replace("'", "'\\''")

        # Use -c for compact output
        script = f"echo '{escaped_input}' | jq -c '{escaped_program}'"

        result = await bash.exec(script)

        if test_case.expects_error:
            # For error tests, we expect non-zero exit code or error output
            got_error = result.exit_code != 0 or result.stderr

            passed = got_error

            # Handle skip tests
            if expected_to_fail:
                if passed:
                    return JqTestResult(
                        test_case=test_case,
                        passed=False,
                        skipped=False,
                        unexpected_pass=True,
                        actual_outputs=normalize_outputs(result.stdout)
                        if result.stdout
                        else [],
                        actual_stderr=result.stderr,
                        actual_status=result.exit_code,
                        expected_outputs=test_case.expected_outputs,
                        error=f"UNEXPECTED PASS: Test marked skip ({skip_reason}) but now passes.",
                    )
                return JqTestResult(
                    test_case=test_case,
                    passed=True,
                    skipped=True,
                    skip_reason=f"skip: {skip_reason}",
                    actual_stderr=result.stderr,
                    actual_status=result.exit_code,
                )

            return JqTestResult(
                test_case=test_case,
                passed=passed,
                skipped=False,
                actual_stderr=result.stderr,
                actual_status=result.exit_code,
                error=None
                if passed
                else f"Expected error but got success with output: {result.stdout}",
            )

        # For normal tests, compare outputs
        actual_outputs = normalize_outputs(result.stdout)
        expected_outputs = [o.strip() for o in test_case.expected_outputs]

        passed = arrays_equal(actual_outputs, expected_outputs)

        # Handle skip tests
        if expected_to_fail:
            if passed:
                return JqTestResult(
                    test_case=test_case,
                    passed=False,
                    skipped=False,
                    unexpected_pass=True,
                    actual_outputs=actual_outputs,
                    actual_stderr=result.stderr,
                    actual_status=result.exit_code,
                    expected_outputs=expected_outputs,
                    error=f"UNEXPECTED PASS: Test marked skip ({skip_reason}) but now passes.",
                )
            return JqTestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"skip: {skip_reason}",
                actual_outputs=actual_outputs,
                actual_stderr=result.stderr,
                actual_status=result.exit_code,
                expected_outputs=expected_outputs,
            )

        return JqTestResult(
            test_case=test_case,
            passed=passed,
            skipped=False,
            actual_outputs=actual_outputs,
            actual_stderr=result.stderr,
            actual_status=result.exit_code,
            expected_outputs=expected_outputs,
            error=None
            if passed
            else f"Output mismatch:\n  expected: {repr(expected_outputs)}\n  actual:   {repr(actual_outputs)}",
        )

    except Exception as e:
        if expected_to_fail:
            return JqTestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"skip: {skip_reason}",
                error=f"Execution error (expected): {e}",
            )
        return JqTestResult(
            test_case=test_case,
            passed=False,
            skipped=False,
            error=f"Execution error: {e}",
        )


def format_error(result: JqTestResult) -> str:
    """Format error message for debugging."""
    lines: list[str] = []

    if result.error:
        lines.append(result.error)
        lines.append("")

    lines.append("OUTPUT:")
    lines.append(f"  expected: {repr(result.expected_outputs or [])}")
    lines.append(f"  actual:   {repr(result.actual_outputs or [])}")

    if result.actual_stderr:
        lines.append("STDERR:")
        lines.append(f"  {repr(result.actual_stderr)}")

    lines.append("")
    lines.append("PROGRAM:")
    lines.append(result.test_case.program)

    lines.append("")
    lines.append("INPUT:")
    lines.append(result.test_case.input)

    return "\n".join(lines)
