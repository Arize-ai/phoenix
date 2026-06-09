"""Parser for sed test formats.

Supports two formats:
1. BusyBox format: testing "description" "commands" "result" "infile" "stdin"
2. PythonSed .suite format:
   ---
   description
   ---
   sed script
   ---
   input
   ---
   expected output
   ---
"""

from dataclasses import dataclass
from pathlib import Path

from ..busybox_parser import (
    BusyBoxTestCase,
    ParsedBusyBoxTestFile,
    parse_busybox_tests,
)

# Re-export types with sed-specific names
SedTestCase = BusyBoxTestCase
ParsedSedTestFile = ParsedBusyBoxTestFile


def parse_sed_test_file(content: str, file_path: str) -> ParsedSedTestFile:
    """Parse a sed test file (auto-detects format)."""
    file_name = Path(file_path).name

    # Detect format based on file extension
    if file_name.endswith(".suite"):
        return parse_pythonsed_suite(content, file_path)

    return parse_busybox_tests(content, file_path)


def parse_pythonsed_suite(content: str, file_path: str) -> ParsedSedTestFile:
    """Parse PythonSed .suite format.

    Format:
    ---
    description
    ---
    sed script
    ---
    input
    ---
    expected output
    ---
    """
    file_name = Path(file_path).name
    lines = content.split("\n")
    test_cases: list[SedTestCase] = []

    i = 0

    while i < len(lines):
        # Skip lines until we find a --- delimiter
        while i < len(lines) and lines[i].strip() != "---":
            i += 1

        if i >= len(lines):
            break

        # Found ---
        start_line = i
        i += 1

        # Read description (may be multi-line)
        description_lines: list[str] = []
        while i < len(lines) and lines[i].strip() != "---":
            description_lines.append(lines[i])
            i += 1

        if i >= len(lines):
            break

        # Skip ---
        i += 1

        # Read sed script (may be multi-line)
        script_lines: list[str] = []
        while i < len(lines) and lines[i].strip() != "---":
            script_lines.append(lines[i])
            i += 1

        if i >= len(lines):
            break

        # Skip ---
        i += 1

        # Read input (may be multi-line)
        input_lines: list[str] = []
        while i < len(lines) and lines[i].strip() != "---":
            input_lines.append(lines[i])
            i += 1

        if i >= len(lines):
            break

        # Skip ---
        i += 1

        # Read expected output (may be multi-line)
        output_lines: list[str] = []
        while i < len(lines) and lines[i].strip() != "---":
            output_lines.append(lines[i])
            i += 1

        # Skip final ---
        if i < len(lines) and lines[i].strip() == "---":
            i += 1

        # Build the test case
        description = "\n".join(description_lines).strip()
        script = "\n".join(script_lines).strip()
        # Join input lines and add trailing newline for non-empty input
        input_text = "\n".join(input_lines)
        if input_text:
            input_text += "\n"
        # Expected output from test file - join lines and add trailing newline
        expected_output = "\n".join(output_lines)
        # Add trailing newline for non-empty output (matches real sed behavior)
        # "???" is a special marker meaning "expect error" - don't add newline
        if expected_output and expected_output != "???":
            expected_output += "\n"

        # Skip empty tests or comments (lines starting with **)
        if not script or description.startswith("**"):
            continue

        # Skip placeholder tests with empty input AND empty expected output
        if not input_text.strip() and not expected_output.strip():
            continue

        # Build sed command from script
        command = build_sed_command(script)

        # Provide default input for tests that have empty input but expect output
        effective_input = input_text
        if not input_text.strip() and expected_output.strip():
            # Default input for a/i/c and similar tests that match /TAG/
            effective_input = "1\nTAG\n2\n"

        test_cases.append(
            SedTestCase(
                name=description or f"test at line {start_line + 1}",
                command=command,
                expected_output=expected_output,
                infile="",
                stdin=effective_input,
                line_number=start_line + 1,
            )
        )

    return ParsedSedTestFile(
        file_name=file_name,
        file_path=file_path,
        test_cases=test_cases,
    )


def build_sed_command(script: str) -> str:
    """Build a sed command from a script."""
    # If script has multiple lines, use multiple -e arguments
    lines = [line for line in script.split("\n") if line.strip()]

    if not lines:
        return "sed ''"

    if len(lines) == 1:
        escaped_script = lines[0].replace("'", "'\\''")
        return f"sed '{escaped_script}'"

    # Multiple lines - use multiple -e arguments
    args = " ".join(f"-e '{line.replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'" for line in lines)
    return f"sed {args}"
