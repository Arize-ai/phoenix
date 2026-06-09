"""Shared parser for BusyBox test format.

BusyBox format: testing "description" "commands" "result" "infile" "stdin"

This parser is used by both sed and grep spec tests.
"""

import re
from dataclasses import dataclass


@dataclass
class BusyBoxTestCase:
    """A single BusyBox test case."""

    name: str
    command: str
    expected_output: str
    infile: str
    stdin: str
    line_number: int
    skip: str | None = None


@dataclass
class ParsedBusyBoxTestFile:
    """A parsed BusyBox test file."""

    file_name: str
    file_path: str
    test_cases: list[BusyBoxTestCase]


def join_test_lines(lines: list[str], start_index: int) -> tuple[str, int]:
    """Join multi-line test definitions, handling shell continuations and quoted newlines.

    Returns (full_line, end_index).
    """
    result = ""
    i = start_index
    in_single_quote = False
    in_double_quote = False

    while i < len(lines):
        line = lines[i]

        # Process each character to track quote state
        j = 0
        while j < len(line):
            char = line[j]

            # Handle escape sequences (but only in double quotes for shell)
            if char == "\\" and j + 1 < len(line) and in_double_quote:
                result += char + line[j + 1]
                j += 2
                continue

            if char == "'" and not in_double_quote:
                in_single_quote = not in_single_quote
            elif char == '"' and not in_single_quote:
                in_double_quote = not in_double_quote

            result += char
            j += 1

        # Count trailing backslashes in the original line
        trailing_backslashes = 0
        for k in range(len(line) - 1, -1, -1):
            if line[k] == "\\":
                trailing_backslashes += 1
            else:
                break
        has_trailing_continuation = trailing_backslashes % 2 == 1

        # Shell continuation applies outside quotes or inside double quotes
        is_shell_continuation = has_trailing_continuation and not in_single_quote

        if is_shell_continuation:
            # Remove the trailing backslash and continue to next line
            result = result[:-1]
            i += 1
        elif in_single_quote or in_double_quote:
            # We're inside a quoted string - add newline and continue
            result += "\n"
            i += 1
        else:
            # Line is complete
            break

    return result, i


def parse_quoted_args(s: str) -> list[str]:
    """Parse quoted arguments from a string.

    Handles both single and double quoted strings.
    """
    args: list[str] = []
    i = 0

    while i < len(s):
        # Skip whitespace
        while i < len(s) and s[i].isspace():
            i += 1

        if i >= len(s):
            break

        quote = s[i]
        if quote not in ('"', "'"):
            # Unquoted argument - read until whitespace
            arg = ""
            while i < len(s) and not s[i].isspace():
                arg += s[i]
                i += 1
            args.append(arg)
            continue

        # Quoted argument - may have adjacent quotes like "a""b" which means "ab"
        arg = ""
        while i < len(s) and s[i] in ('"', "'"):
            current_quote = s[i]
            i += 1  # skip opening quote
            while i < len(s) and s[i] != current_quote:
                if s[i] == "\\" and i + 1 < len(s):
                    # Handle escape sequences
                    arg += s[i] + s[i + 1]
                    i += 2
                else:
                    arg += s[i]
                    i += 1
            i += 1  # skip closing quote
        args.append(arg)

    return args


def unescape_string(s: str) -> str:
    """Unescape shell string escapes."""
    return (
        s.replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace("\\r", "\r")
        .replace("\\\\", "\\")
        .replace('\\"', '"')
        .replace("\\'", "'")
    )


def unescape_command(s: str) -> str:
    """Unescape shell double-quote escapes in commands.

    This mimics bash's double-quote expansion where:
    - \\$ becomes $ (escaping the special meaning)
    - \\\\ becomes \\ (escaped backslash)
    - \\" becomes "
    - \\` becomes `
    - \\<newline> removes the backslash and newline (line continuation)
    - All other \\X sequences are left as-is (\\n, \\t, etc. are NOT interpreted)
    """
    result = ""
    i = 0

    while i < len(s):
        char = s[i]

        if char == "\\" and i + 1 < len(s):
            next_char = s[i + 1]
            # In bash double quotes, only these characters are escaped: $ ` " \\ newline
            if next_char in ("$", "`", '"', "\\"):
                result += next_char
                i += 2
                continue
            # \\newline in double quotes removes both (line continuation)
            if next_char == "\n":
                i += 2
                continue

        result += char
        i += 1

    return result


def parse_busybox_tests(content: str, file_path: str) -> ParsedBusyBoxTestFile:
    """Parse BusyBox test format.

    Format: testing "description" "commands" "result" "infile" "stdin"
    """
    file_name = file_path.split("/")[-1]
    lines = content.split("\n")
    test_cases: list[BusyBoxTestCase] = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Skip comments and empty lines
        if line.strip().startswith("#") or line.strip() == "":
            i += 1
            continue

        # Handle multi-line tests with proper quote tracking
        full_line, end_index = join_test_lines(lines, i)
        i = end_index + 1

        test_match = re.match(r'^testing\s+"([^"]*)"\s+([\s\S]+)$', full_line)

        if not test_match:
            continue

        description = test_match.group(1)
        rest = test_match.group(2)

        # Parse the remaining arguments - they're quoted strings
        args = parse_quoted_args(rest)

        if len(args) < 4:
            continue

        command, result, infile, stdin = args[:4]

        test_cases.append(
            BusyBoxTestCase(
                name=description,
                command=unescape_command(command),
                expected_output=unescape_string(result),
                infile=unescape_string(infile),
                stdin=unescape_string(stdin),
                line_number=end_index + 1,
            )
        )

    return ParsedBusyBoxTestFile(
        file_name=file_name,
        file_path=file_path,
        test_cases=test_cases,
    )
