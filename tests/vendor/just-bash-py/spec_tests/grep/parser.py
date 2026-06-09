"""Parser for grep test formats.

Supports:
- BusyBox format: testing "description" "commands" "result" "infile" "stdin"
- GNU grep format: exit_code@pattern@test_string[@note]
"""

import re
from dataclasses import dataclass
from pathlib import Path

from ..busybox_parser import (
    BusyBoxTestCase,
    ParsedBusyBoxTestFile,
    parse_busybox_tests,
)

# Re-export types with grep-specific names
GrepTestCase = BusyBoxTestCase
ParsedGrepTestFile = ParsedBusyBoxTestFile


def parse_grep_test_file(content: str, file_path: str) -> ParsedGrepTestFile:
    """Parse a grep test file (auto-detects format)."""
    file_name = Path(file_path).name

    # Detect format based on file name prefix
    if file_name.startswith("gnu-"):
        # Determine if BRE or ERE based on filename
        is_ere = "ere" in file_name or "spencer1" in file_name or "spencer2" in file_name
        return parse_gnu_grep_tests(content, file_path, is_ere)

    return parse_busybox_tests(content, file_path)


def parse_gnu_grep_tests(
    content: str, file_path: str, is_ere: bool
) -> ParsedGrepTestFile:
    """Parse GNU grep test format.

    Format: exit_code@pattern@test_string[@note]
    - exit_code 0: pattern should match test_string
    - exit_code 1: pattern should NOT match test_string
    - exit_code 2: pattern is invalid (test_string contains error code)

    Supports skip comments:
      # SKIP: reason
      0@pattern@test_string
    The skip applies to the immediately following test line.
    """
    file_name = Path(file_path).name
    lines = content.split("\n")
    test_cases: list[GrepTestCase] = []

    pending_skip: str | None = None

    for i, line in enumerate(lines):
        line = line.strip()

        # Skip empty lines
        if line == "":
            continue

        # Check for SKIP comment
        skip_match = re.match(r"^#\s*SKIP:\s*(.+)$", line)
        if skip_match:
            pending_skip = skip_match.group(1)
            continue

        # Skip other comments
        if line.startswith("#"):
            continue

        # Parse: exit_code@pattern@test_string[@note]
        parts = line.split("@")
        if len(parts) < 3:
            continue

        try:
            exit_code = int(parts[0])
        except ValueError:
            continue

        pattern = parts[1]
        test_string = parts[2]
        note = "@".join(parts[3:])  # Rejoin any additional @ in notes

        # Build grep command
        grep_flag = "-E" if is_ere else ""
        escaped_pattern = pattern.replace("'", "'\\''")
        command = f"grep {grep_flag} '{escaped_pattern}'".strip()

        # Determine expected output based on exit code
        if exit_code == 2:
            # Error expected - pattern is invalid
            expected_output = ""
            stdin = "test\n"
        elif exit_code == 0:
            # Match expected - grep should output the matching line
            expected_output = f"{test_string}\n"
            stdin = f"{test_string}\n"
        else:
            # No match expected (exit code 1) - grep should output nothing
            expected_output = ""
            stdin = f"{test_string}\n"

        # Build test name
        note_str = f" ({note})" if note else ""
        ere_type = "ERE" if is_ere else "BRE"
        name = f'{ere_type}: /{pattern}/ vs "{test_string}"{note_str}'

        test_case = GrepTestCase(
            name=name,
            command=command,
            expected_output=expected_output,
            infile="",
            stdin=stdin,
            line_number=i + 1,
            skip=pending_skip,
        )

        pending_skip = None
        test_cases.append(test_case)

    return ParsedGrepTestFile(
        file_name=file_name,
        file_path=file_path,
        test_cases=test_cases,
    )
