"""Parser for jq test format.

The jq test format is simple:
- Tests are groups of three lines: program, input, expected output
- Blank lines and lines starting with # are ignored
- Multiple expected output lines mean multiple outputs
- %%FAIL indicates an error test
"""

from dataclasses import dataclass
from pathlib import Path


@dataclass
class JqTestCase:
    """A single jq test case."""

    name: str
    program: str
    input: str
    expected_outputs: list[str]
    expects_error: bool
    expected_error: str | None
    line_number: int
    skip: str | None = None


@dataclass
class ParsedJqTestFile:
    """A parsed jq test file."""

    file_name: str
    file_path: str
    test_cases: list[JqTestCase]


def parse_jq_test_file(content: str, file_path: str) -> ParsedJqTestFile:
    """Parse a jq test file."""
    file_name = Path(file_path).name
    lines = content.split("\n")
    test_cases: list[JqTestCase] = []

    i = 0
    test_number = 0

    while i < len(lines):
        # Skip blank lines and comments
        while i < len(lines) and (lines[i].strip() == "" or lines[i].startswith("#")):
            i += 1

        if i >= len(lines):
            break

        # Check for %%FAIL error test
        if lines[i] == "%%FAIL":
            i += 1
            # Skip any blank lines after %%FAIL
            while i < len(lines) and lines[i].strip() == "":
                i += 1

            if i >= len(lines):
                break

            program_line = i
            program = lines[i]
            i += 1

            # Collect error message lines until blank line or next test
            error_lines: list[str] = []
            while (
                i < len(lines)
                and lines[i].strip() != ""
                and not lines[i].startswith("#")
            ):
                error_lines.append(lines[i])
                i += 1

            test_number += 1
            test_cases.append(
                JqTestCase(
                    name=f"error test {test_number}: {truncate_program(program)}",
                    program=program,
                    input="null",
                    expected_outputs=[],
                    expects_error=True,
                    expected_error="\n".join(error_lines),
                    line_number=program_line + 1,
                )
            )
            continue

        # Regular test: program, input, expected output(s)
        program_line = i
        program = lines[i]
        i += 1

        # Skip blank lines between program and input
        while i < len(lines) and lines[i].strip() == "":
            i += 1

        if i >= len(lines):
            break

        input_val = lines[i]
        i += 1

        # Collect expected output lines until blank line, comment, or %%FAIL
        expected_outputs: list[str] = []
        while (
            i < len(lines)
            and lines[i].strip() != ""
            and not lines[i].startswith("#")
            and lines[i] != "%%FAIL"
        ):
            expected_outputs.append(lines[i])
            i += 1

        # Skip if we didn't get any expected output
        if not expected_outputs:
            continue

        test_number += 1
        test_cases.append(
            JqTestCase(
                name=f"test {test_number}: {truncate_program(program)}",
                program=program,
                input=input_val,
                expected_outputs=expected_outputs,
                expects_error=False,
                expected_error=None,
                line_number=program_line + 1,
            )
        )

    return ParsedJqTestFile(
        file_name=file_name,
        file_path=file_path,
        test_cases=test_cases,
    )


def truncate_program(program: str, max_len: int = 50) -> str:
    """Truncate program for display."""
    normalized = program.strip()
    if len(normalized) <= max_len:
        return normalized
    return f"{normalized[:max_len - 3]}..."
