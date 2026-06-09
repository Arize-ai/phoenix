"""AWK spec test runner - executes parsed awk tests against just-bash's awk."""

from dataclasses import dataclass

from just_bash import Bash

from .parser import AwkTestCase


@dataclass
class AwkTestResult:
    """Result from running an AWK test case."""

    test_case: AwkTestCase
    passed: bool
    skipped: bool
    skip_reason: str | None = None
    unexpected_pass: bool = False
    actual_output: str | None = None
    actual_stderr: str | None = None
    actual_status: int | None = None
    expected_output: str | None = None
    error: str | None = None


def normalize_output(output: str) -> str:
    """Normalize output for comparison."""
    lines = [line.rstrip() for line in output.split("\n")]
    return "\n".join(lines).rstrip("\n")


async def run_awk_test_case(test_case: AwkTestCase) -> AwkTestResult:
    """Run a single awk test case."""
    # Track if test is expected to fail (skip) - we'll still run it
    expected_to_fail = bool(test_case.skip)
    skip_reason = test_case.skip

    # Skip tests that need external files we don't have
    if test_case.input.startswith("[file:"):
        return AwkTestResult(
            test_case=test_case,
            passed=True,
            skipped=True,
            skip_reason=f"Requires external file: {test_case.input}",
        )

    # Skip tests with no expected output (parser couldn't extract it)
    if not test_case.expected_output and test_case.skip:
        return AwkTestResult(
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
        # Build the -F flag if a field separator is specified
        fs_flag = ""
        if test_case.field_separator:
            escaped_fs = test_case.field_separator.replace("'", "'\\''")
            fs_flag = f"-F'{escaped_fs}' "

        # Build -v var=value flags for command-line variable assignments
        vars_flag = ""
        if test_case.vars:
            vars_parts = []
            for k, v in test_case.vars.items():
                escaped_v = v.replace("'", "'\\''")
                vars_parts.append(f"-v {k}='{escaped_v}'")
            vars_flag = " ".join(vars_parts) + " "

        # Build command-line args string (for ARGV/ARGC tests)
        args_str = ""
        if test_case.args:
            args_parts = [f"'{a.replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'" for a in test_case.args]
            args_str = " " + " ".join(args_parts)

        # For heredoc-style tests (which have field_separator set), even empty input
        # should be piped to awk as an empty line.
        has_input = len(test_case.input) > 0 or test_case.field_separator is not None

        escaped_program = test_case.program.replace("'", "'\\''")

        if has_input:
            # Escape single quotes in input for the echo command
            escaped_input = test_case.input.replace("'", "'\\''")
            script = f"echo '{escaped_input}' | awk {fs_flag}{vars_flag}'{escaped_program}'{args_str}"
        else:
            script = f"awk {fs_flag}{vars_flag}'{escaped_program}'{args_str} </dev/null"

        result = await bash.exec(script)

        actual_output = normalize_output(result.stdout)
        expected_output = normalize_output(test_case.expected_output)

        passed = actual_output == expected_output

        # Also check exit status if specified
        if test_case.expected_status is not None:
            passed = passed and result.exit_code == test_case.expected_status

        # Handle skip tests
        if expected_to_fail:
            if passed:
                return AwkTestResult(
                    test_case=test_case,
                    passed=False,
                    skipped=False,
                    unexpected_pass=True,
                    actual_output=result.stdout,
                    actual_stderr=result.stderr,
                    actual_status=result.exit_code,
                    expected_output=test_case.expected_output,
                    error=f"UNEXPECTED PASS: Test marked skip ({skip_reason}) but now passes.",
                )
            return AwkTestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"skip: {skip_reason}",
                actual_output=result.stdout,
                actual_stderr=result.stderr,
                actual_status=result.exit_code,
                expected_output=test_case.expected_output,
            )

        return AwkTestResult(
            test_case=test_case,
            passed=passed,
            skipped=False,
            actual_output=result.stdout,
            actual_stderr=result.stderr,
            actual_status=result.exit_code,
            expected_output=test_case.expected_output,
            error=None
            if passed
            else f"Output mismatch:\n  expected: {repr(expected_output)}\n  actual:   {repr(actual_output)}",
        )

    except Exception as e:
        if expected_to_fail:
            return AwkTestResult(
                test_case=test_case,
                passed=True,
                skipped=True,
                skip_reason=f"skip: {skip_reason}",
                error=f"Execution error (expected): {e}",
            )
        return AwkTestResult(
            test_case=test_case,
            passed=False,
            skipped=False,
            error=f"Execution error: {e}",
        )


def format_error(result: AwkTestResult) -> str:
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
    lines.append("PROGRAM:")
    lines.append(result.test_case.program)

    if result.test_case.input:
        lines.append("")
        lines.append("INPUT:")
        lines.append(result.test_case.input)

    return "\n".join(lines)
