"""Parser for Oils spec test format (.test.sh files).

Format:
- File headers: `## key: value`
- Test cases start with: `#### Test Name`
- Assertions: `## stdout:`, `## status:`, `## STDOUT: ... ## END`
- Shell-specific: `## OK shell`, `## N-I shell`, `## BUG shell`
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


@dataclass
class FileHeader:
    """File-level metadata."""

    oils_failures_allowed: int = 0
    compare_shells: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


@dataclass
class Assertion:
    """Expected output assertion."""

    type: Literal["stdout", "stderr", "status", "stdout-json", "stderr-json"]
    value: str | int
    shells: list[str] | None = None
    variant: Literal["OK", "N-I", "BUG"] | None = None


@dataclass
class TestCase:
    """A single test case."""

    name: str
    script: str
    assertions: list[Assertion]
    line_number: int
    skip: str | None = None


@dataclass
class ParsedSpecFile:
    """A parsed spec file."""

    header: FileHeader
    test_cases: list[TestCase]
    file_path: str


def parse_spec_file(file_path: str | Path) -> ParsedSpecFile:
    """Parse a spec test file."""
    path = Path(file_path)
    content = path.read_text()
    return parse_spec_content(content, str(path))


def parse_spec_content(content: str, file_path: str) -> ParsedSpecFile:
    """Parse spec test file content."""
    lines = content.split("\n")
    header = FileHeader()
    test_cases: list[TestCase] = []

    current_test: TestCase | None = None
    script_lines: list[str] = []
    in_multi_line_block = False
    multi_line_type: Literal["stdout", "stderr", "stdout-json", "stderr-json"] | None = None
    multi_line_content: list[str] = []
    multi_line_shells: list[str] | None = None
    multi_line_variant: Literal["OK", "N-I", "BUG"] | None = None

    for i, line in enumerate(lines):
        line_number = i + 1

        # Inside a multi-line block
        if in_multi_line_block:
            if line == "## END":
                # End of multi-line block
                if current_test and multi_line_type:
                    current_test.assertions.append(
                        Assertion(
                            type=multi_line_type,
                            value="\n".join(multi_line_content),
                            shells=multi_line_shells,
                            variant=multi_line_variant,
                        )
                    )
                in_multi_line_block = False
                multi_line_type = None
                multi_line_content = []
                multi_line_shells = None
                multi_line_variant = None
                continue

            # Check if another assertion is starting (ends current block without ## END)
            if line.startswith("## ") and _is_assertion_line(line[3:]):
                # End current block first
                if current_test and multi_line_type:
                    current_test.assertions.append(
                        Assertion(
                            type=multi_line_type,
                            value="\n".join(multi_line_content),
                            shells=multi_line_shells,
                            variant=multi_line_variant,
                        )
                    )
                in_multi_line_block = False
                multi_line_type = None
                multi_line_content = []
                multi_line_shells = None
                multi_line_variant = None
                # Don't continue - fall through to process this line as an assertion
            else:
                multi_line_content.append(line)
                continue

        # Test case header
        if line.startswith("#### "):
            # Save previous test case
            if current_test:
                current_test.script = "\n".join(script_lines).strip()
                if current_test.script or current_test.assertions:
                    test_cases.append(current_test)

            # Start new test case
            name = line[5:].strip()
            current_test = TestCase(
                name=name,
                script="",
                assertions=[],
                line_number=line_number,
            )
            script_lines = []
            continue

        # Assertion line (starts with ##)
        if line.startswith("## "):
            assertion_line = line[3:]

            # File headers (before first test case)
            if not current_test:
                _parse_header_line(assertion_line, header)
                continue

            # Check for shell-specific variant prefix (BUG, BUG-2, OK, N-I, etc.)
            variant_match = re.match(
                r"^(OK|N-I|BUG(?:-\d+)?)\s+([a-z0-9/.-]+)\s+(.+)$",
                assertion_line,
                re.IGNORECASE,
            )
            if variant_match:
                variant = variant_match.group(1).upper()
                # Normalize BUG-N to BUG
                if variant.startswith("BUG"):
                    variant = "BUG"
                shells = variant_match.group(2).split("/")
                rest = variant_match.group(3)

                # Check if it's a multi-line start (allow trailing whitespace)
                multi_line_match = re.match(r"^(STDOUT|STDERR):\s*$", rest)
                if multi_line_match:
                    in_multi_line_block = True
                    multi_line_type = multi_line_match.group(1).lower()  # type: ignore
                    multi_line_content = []
                    multi_line_shells = shells
                    multi_line_variant = variant  # type: ignore
                    continue

                # Single-line shell-specific assertion
                assertion = _parse_single_line_assertion(rest)
                if assertion:
                    assertion.shells = shells
                    assertion.variant = variant  # type: ignore
                    current_test.assertions.append(assertion)
                continue

            # Check for multi-line block start (allow trailing whitespace)
            multi_line_start = re.match(r"^(STDOUT|STDERR):\s*$", assertion_line)
            if multi_line_start:
                in_multi_line_block = True
                multi_line_type = multi_line_start.group(1).lower()  # type: ignore
                multi_line_content = []
                continue

            # Check for SKIP directive (matches "SKIP", "SKIP: reason", "SKIP (reason): detail")
            skip_match = re.match(r"^SKIP(?:[\s:(]\s*(.*))?$", assertion_line, re.IGNORECASE)
            if skip_match:
                current_test.skip = skip_match.group(1) or "skipped"
                continue

            # Single-line assertion
            assertion = _parse_single_line_assertion(assertion_line)
            if assertion:
                current_test.assertions.append(assertion)
            continue

        # Regular script line (only add if we're in a test case)
        if current_test:
            script_lines.append(line)

    # Save last test case
    if current_test:
        current_test.script = "\n".join(script_lines).strip()
        if current_test.script or current_test.assertions:
            test_cases.append(current_test)

    return ParsedSpecFile(header=header, test_cases=test_cases, file_path=file_path)


def _is_assertion_line(line: str) -> bool:
    """Check if a line (without the ## prefix) is an assertion line."""
    # Shell-specific variant (BUG, BUG-2, OK, N-I, etc.)
    if re.match(r"^(OK|N-I|BUG(?:-\d+)?)\s+[a-z0-9/.-]+\s+", line, re.IGNORECASE):
        return True
    # Multi-line block start (allow trailing whitespace)
    if re.match(r"^(STDOUT|STDERR):\s*$", line):
        return True
    # Single-line assertions
    if re.match(r"^(stdout|stderr|status|stdout-json|stderr-json):", line):
        return True
    return False


def _parse_header_line(line: str, header: FileHeader) -> None:
    """Parse a file header line."""
    colon_index = line.find(":")
    if colon_index == -1:
        return

    key = line[:colon_index].strip()
    value = line[colon_index + 1 :].strip()

    if key == "oils_failures_allowed":
        try:
            header.oils_failures_allowed = int(value)
        except ValueError:
            pass
    elif key == "compare_shells":
        header.compare_shells = value.split()
    elif key == "tags":
        header.tags = value.split()


def _parse_single_line_assertion(line: str) -> Assertion | None:
    """Parse a single-line assertion."""
    # stdout: value
    stdout_match = re.match(r"^stdout:\s*(.*)$", line)
    if stdout_match:
        return Assertion(type="stdout", value=stdout_match.group(1))

    # stderr: value
    stderr_match = re.match(r"^stderr:\s*(.*)$", line)
    if stderr_match:
        return Assertion(type="stderr", value=stderr_match.group(1))

    # status: number
    status_match = re.match(r"^status:\s*(\d+)$", line)
    if status_match:
        return Assertion(type="status", value=int(status_match.group(1)))

    # stdout-json: "value"
    stdout_json_match = re.match(r"^stdout-json:\s*(.+)$", line)
    if stdout_json_match:
        try:
            parsed = json.loads(stdout_json_match.group(1))
            return Assertion(type="stdout-json", value=parsed)
        except json.JSONDecodeError:
            # If JSON parse fails, use raw value
            return Assertion(type="stdout-json", value=stdout_json_match.group(1))

    # stderr-json: "value"
    stderr_json_match = re.match(r"^stderr-json:\s*(.+)$", line)
    if stderr_json_match:
        try:
            parsed = json.loads(stderr_json_match.group(1))
            return Assertion(type="stderr-json", value=parsed)
        except json.JSONDecodeError:
            return Assertion(type="stderr-json", value=stderr_json_match.group(1))

    return None


def get_expected_stdout(test_case: TestCase) -> str | None:
    """Get the expected stdout for a test case (considering bash-specific variants)."""
    # First, look for bash-specific assertions (BUG or OK with shells)
    for assertion in test_case.assertions:
        if assertion.type in ("stdout", "stdout-json") and assertion.shells:
            if any(s == "bash" or s.startswith("bash-") for s in assertion.shells):
                return str(assertion.value)

    # Fall back to default stdout
    for assertion in test_case.assertions:
        if assertion.type in ("stdout", "stdout-json") and not assertion.shells:
            return str(assertion.value)

    return None


def get_expected_stderr(test_case: TestCase) -> str | None:
    """Get the expected stderr for a test case."""
    # First, look for bash-specific assertions
    for assertion in test_case.assertions:
        if assertion.type in ("stderr", "stderr-json") and assertion.shells:
            if any(s == "bash" or s.startswith("bash-") for s in assertion.shells):
                return str(assertion.value)

    # Fall back to default stderr
    for assertion in test_case.assertions:
        if assertion.type in ("stderr", "stderr-json") and not assertion.shells:
            return str(assertion.value)

    return None


def get_expected_status(test_case: TestCase) -> int | None:
    """Get the expected exit status for a test case.

    Returns the default expected status (ignoring OK variants which are alternates).
    """
    # First, look for bash-specific BUG status (BUG means bash has this bug, we should match it)
    for assertion in test_case.assertions:
        if (
            assertion.type == "status"
            and assertion.variant == "BUG"
            and assertion.shells
        ):
            if any(s == "bash" or s.startswith("bash-") for s in assertion.shells):
                return int(assertion.value)

    # Fall back to default status (not shell-specific, not a variant)
    for assertion in test_case.assertions:
        if (
            assertion.type == "status"
            and not assertion.shells
            and not assertion.variant
        ):
            return int(assertion.value)

    return None


def get_acceptable_statuses(test_case: TestCase) -> list[int]:
    """Get all acceptable exit statuses for a test case.

    This includes the default status and any OK variants for bash.
    """
    statuses: list[int] = []

    # Add BUG bash status if present (this overrides the default for us)
    for assertion in test_case.assertions:
        if (
            assertion.type == "status"
            and assertion.variant == "BUG"
            and assertion.shells
        ):
            if any(s == "bash" or s.startswith("bash-") for s in assertion.shells):
                statuses.append(int(assertion.value))
                return statuses  # BUG overrides everything

    # Add default status
    for assertion in test_case.assertions:
        if (
            assertion.type == "status"
            and not assertion.shells
            and not assertion.variant
        ):
            statuses.append(int(assertion.value))
            break

    # Add OK bash statuses (these are also acceptable)
    for assertion in test_case.assertions:
        if (
            assertion.type == "status"
            and assertion.variant == "OK"
            and assertion.shells
        ):
            if any(s == "bash" or s.startswith("bash-") for s in assertion.shells):
                value = int(assertion.value)
                if value not in statuses:
                    statuses.append(value)

    return statuses


def is_not_implemented_for_bash(test_case: TestCase) -> bool:
    """Check if a test case is marked as N-I (Not Implemented) for bash."""
    for assertion in test_case.assertions:
        if assertion.variant == "N-I" and assertion.shells:
            if any(s == "bash" or s.startswith("bash-") for s in assertion.shells):
                return True
    return False
