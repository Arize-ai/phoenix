"""Parser for onetrueawk test format (T.* shell scripts).

The onetrueawk test suite uses shell scripts with patterns like:
- $awk 'program' [input] >foo1
- echo 'expected' >foo2
- diff foo1 foo2 || echo 'BAD: testname'

This parser extracts individual test cases from these scripts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .parser_test_styles import (
    ParseResult,
    clean_test_name,
    extract_cat_heredoc,
    try_parse_builtin_style_test,
    try_parse_multi_line_awk_test,
)


@dataclass
class AwkTestCase:
    """A single AWK test case."""

    name: str
    program: str
    input: str
    expected_output: str
    line_number: int
    expected_status: int | None = None
    skip: str | None = None
    original_command: str | None = None
    field_separator: str | None = None
    args: list[str] | None = None
    vars: dict[str, str] | None = None


@dataclass
class ParsedAwkTestFile:
    """A parsed AWK test file."""

    file_name: str
    file_path: str
    test_cases: list[AwkTestCase]
    unparsed_tests: list[str] = field(default_factory=list)


@dataclass
class HeredocParseResult:
    """Result of parsing heredoc tests."""

    test_cases: list[AwkTestCase]
    next_line: int


def parse_awk_test_file(content: str, file_path: str) -> ParsedAwkTestFile:
    """Parse a T.* shell test file."""
    file_name = Path(file_path).name
    lines = content.split("\n")
    test_cases: list[AwkTestCase] = []
    unparsed_tests: list[str] = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for piped input: echo '...' | $awk '...' >foo (multi-line version)
        if "| $awk" in line:
            result = try_parse_multi_line_piped_awk_test(lines, i)
            if result:
                test_cases.append(result.test_case)
                i = result.next_line
                continue

        # Look for $awk commands that write to foo1 or foo2
        if "$awk" in line and ">foo" in line:
            result = try_parse_builtin_style_test(
                lines, i, try_parse_multi_line_awk_test
            )
            if result:
                test_cases.append(result.test_case)
                i = result.next_line
                continue

        # Look for multi-line $awk programs starting on a line
        if re.match(r"^\$awk\s+'", line) and ">foo" not in line:
            # Look ahead to see if this test uses $TEMP or foo patterns
            uses_temp_pattern = False
            for j in range(i, min(i + 30, len(lines))):
                if re.search(r">\s*\$TEMP", lines[j]):
                    uses_temp_pattern = True
                    break
                if re.search(r">\s*foo[12]", lines[j]):
                    break

            if uses_temp_pattern:
                result = try_parse_temp_var_style_test(lines, i)
                if result:
                    test_cases.append(result.test_case)
                    i = result.next_line
                    continue
            else:
                result = try_parse_multi_line_awk_test(lines, i)
                if result:
                    test_cases.append(result.test_case)
                    i = result.next_line
                    continue

        # Look for echo '...' >foo1 followed by $awk >foo2 (reversed expected/actual pattern)
        if (
            re.match(r"^\.?\/?\s*echo\s+(?:['\"][^'\"]*['\"]|\S+)\s*>\s*foo[12]$", line)
            and i + 1 < len(lines)
        ):
            next_line = lines[i + 1]
            if re.match(r"^\$awk\s+'", next_line):
                result = try_parse_reversed_test(lines, i)
                if result:
                    test_cases.append(result.test_case)
                    i = result.next_line
                    continue

        # Look for heredoc-style tests (T.expr format with !!!!!)
        if "<<" in line and "!!!!" in line:
            result = try_parse_heredoc_tests(lines, i)
            if result:
                test_cases.extend(result.test_cases)
                i = result.next_line
                continue

        # Look for $TEMP-style tests (T.split format with $TEMP0, $TEMP1, $TEMP2)
        if "$awk" in line and re.search(r">\s*\$TEMP", line):
            result = try_parse_temp_var_style_test(lines, i)
            if result:
                test_cases.append(result.test_case)
                i = result.next_line
                continue

        i += 1

    return ParsedAwkTestFile(
        file_name=file_name,
        file_path=file_path,
        test_cases=test_cases,
        unparsed_tests=unparsed_tests,
    )


def try_parse_reversed_test(lines: list[str], start_line: int) -> ParseResult | None:
    """Try to parse a reversed test where expected output comes first.

    Pattern:
    echo 'expected' >foo1
    $awk 'program' >foo2
    diff foo1 foo2 || echo 'BAD: testname'
    """
    # Extract expected output from echo line (quoted or unquoted)
    echo_line = lines[start_line]
    expected_output = ""

    echo_quoted_match = re.match(r"^\.?\/?\s*echo\s+'([^']*)'\s*>\s*foo([12])$", echo_line)
    if echo_quoted_match:
        expected_output = echo_quoted_match.group(1)
    else:
        echo_unquoted_match = re.match(
            r"^\.?\/?\s*echo\s+(\S+)\s*>\s*foo([12])$", echo_line
        )
        if echo_unquoted_match:
            expected_output = echo_unquoted_match.group(1)
        else:
            return None

    # Find the awk program (starts on next line, may span multiple lines)
    awk_start_line = start_line + 1
    awk_end_line = awk_start_line

    # Find where the awk program ends (look for ' >foo pattern)
    for j in range(awk_start_line, len(lines)):
        if (
            "' >foo" in lines[j]
            or "'>foo" in lines[j]
            or re.search(r"'\s+\/dev\/null\s*>\s*foo", lines[j])
            or re.search(r"'\s*>\s*foo", lines[j])
            or re.search(r"'\s+\S+\s*>\s*foo", lines[j])
        ):
            awk_end_line = j
            break

    # Extract the awk program
    awk_lines = "\n".join(lines[awk_start_line : awk_end_line + 1])
    program_match = re.search(
        r"\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*(?:\/dev\/null\s*)?", awk_lines
    )
    if not program_match:
        return None
    program = program_match.group(1)

    # Find test name from diff/cmp line
    test_name = ""
    next_line = awk_end_line + 1

    for j in range(awk_end_line + 1, min(awk_end_line + 10, len(lines))):
        line = lines[j]

        # diff/cmp line with test name
        diff_match = re.match(
            r"(?:diff|cmp)\s+(?:-s\s+)?foo1\s+foo2\s*\|\|\s*\.?\/?echo\s+(['\"])?(?:BAD:\s*)?([^'\"]+)\1?",
            line,
        )
        if diff_match:
            test_name = clean_test_name(diff_match.group(2))
            next_line = j + 1
            break

        # grep-based error checks
        grep_match = re.match(
            r"grep\s+.*\|\|\s*echo\s+(['\"])?(?:BAD:\s*)?([^'\"]+)\1?", line
        )
        if grep_match:
            test_name = clean_test_name(grep_match.group(2))
            next_line = j + 1
            break

    if not test_name:
        test_name = f"test at line {start_line + 1}"

    return ParseResult(
        test_case=AwkTestCase(
            name=test_name,
            program=program,
            input="",
            expected_output=expected_output,
            line_number=start_line + 1,
            original_command=echo_line.strip(),
        ),
        next_line=next_line,
    )


def try_parse_multi_line_piped_awk_test(
    lines: list[str], pipe_line_index: int
) -> ParseResult | None:
    """Try to parse a multi-line piped awk test.

    Pattern:
    echo '10 2
    2 10
    ...' | $awk '
    function f() { ... }
    { main block }
    ' >foo1
    """
    # Find where the echo starts (search backwards)
    echo_start_line = pipe_line_index
    for j in range(pipe_line_index, -1, -1):
        if re.match(r"^echo\s+'", lines[j]):
            echo_start_line = j
            break

    # Extract the input from echo '...' up to the pipe
    full_command = "\n".join(lines[echo_start_line : pipe_line_index + 1])
    input_match = re.search(r"echo\s+'([\s\S]*?)'\s*\|\s*\$awk", full_command)
    if not input_match:
        return None
    input_data = input_match.group(1)

    # Now find the awk program - it starts after $awk ' on the pipe line
    awk_start_line = pipe_line_index
    awk_end_line = pipe_line_index

    # Find where the awk program ends (look for ' >foo pattern)
    for j in range(pipe_line_index, len(lines)):
        if "' >foo" in lines[j] or "'>foo" in lines[j]:
            awk_end_line = j
            break

    # Extract the awk program
    awk_lines = "\n".join(lines[awk_start_line : awk_end_line + 1])
    program_match = re.search(r"\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*>", awk_lines)
    if not program_match:
        return None
    program = program_match.group(1)

    # Now find expected output and test name
    expected_output = ""
    test_name = ""
    next_line = awk_end_line + 1

    for j in range(awk_end_line + 1, min(awk_end_line + 30, len(lines))):
        line = lines[j]

        # Simple echo expected output (single line)
        echo_match = re.match(r"^echo\s+(['\"])(.*?)\1\s*>\s*foo([12])$", line)
        if echo_match:
            expected_output = (
                echo_match.group(2).replace("\\n", "\n").replace("\\t", "\t")
            )
            next_line = j + 1

        # Multi-line echo expected output
        if re.match(r"^echo\s+'[^']*$", line) and ">foo" not in line:
            echo_lines: list[str] = [re.sub(r"^echo\s+'", "", line)]
            echo_end_line = j
            for k in range(j + 1, len(lines)):
                if "' >foo" in lines[k]:
                    echo_lines.append(re.sub(r"' >foo\d$", "", lines[k]))
                    echo_end_line = k
                    break
                echo_lines.append(lines[k])
            expected_output = "\n".join(echo_lines)
            next_line = echo_end_line + 1
            j = echo_end_line
            continue

        # cat heredoc expected output
        if re.match(r"^cat\s+<<", line):
            heredoc = extract_cat_heredoc(lines, j)
            if heredoc:
                expected_output = heredoc["content"]
                next_line = heredoc["end_line"] + 1
                j = heredoc["end_line"]
                continue

        # diff/cmp line with test name
        diff_match = re.match(
            r"(?:diff|cmp)\s+(?:-s\s+)?foo1\s+foo2\s*\|\|\s*\.?\/?echo\s+(['\"])?(?:BAD:\s*)?([^'\"]+)\1?",
            line,
        )
        if diff_match:
            test_name = clean_test_name(diff_match.group(2))
            next_line = j + 1
            break

        # grep-based error checks
        grep_match = re.match(
            r"grep\s+.*\|\|\s*echo\s+(['\"])?(?:BAD:\s*)?([^'\"]+)\1?", line
        )
        if grep_match:
            test_name = clean_test_name(grep_match.group(2))
            next_line = j + 1
            break

    if not test_name:
        test_name = f"test at line {echo_start_line + 1}"

    return ParseResult(
        test_case=AwkTestCase(
            name=test_name,
            program=program,
            input=input_data,
            expected_output=expected_output,
            line_number=echo_start_line + 1,
            original_command=lines[echo_start_line].strip(),
        ),
        next_line=next_line,
    )


def try_parse_heredoc_tests(
    lines: list[str], start_line: int
) -> HeredocParseResult | None:
    """Parse T.expr style heredoc tests.

    Format:
    try { awk program }
    input1\\texpected1
    input2\\texpected2
    (blank line ends test)

    Note: T.expr tests use tab as field separator (-F"\\t")
    """
    # Find the heredoc content
    heredoc_start = -1
    heredoc_end = -1

    for j in range(start_line, len(lines)):
        if "<<" in lines[j] and "!!!!" in lines[j]:
            heredoc_start = j + 1
        if heredoc_start > 0 and lines[j] == "!!!!":
            heredoc_end = j
            break

    if heredoc_start < 0 or heredoc_end < 0:
        return None

    test_cases: list[AwkTestCase] = []
    current_program = ""
    test_inputs: list[dict[str, str]] = []
    test_line_number = heredoc_start

    for j in range(heredoc_start, heredoc_end):
        line = lines[j]

        # Skip comments and empty lines at start
        if line.startswith("#") or not line.strip():
            if current_program and test_inputs:
                # End of current test, save it
                for k, ti in enumerate(test_inputs):
                    test_cases.append(
                        AwkTestCase(
                            name=f"{current_program[:40]}... case {k + 1}",
                            program=current_program,
                            input=ti["input"],
                            expected_output=ti["expected"],
                            line_number=test_line_number,
                            field_separator="\t",  # T.expr tests use tab as FS
                        )
                    )
                current_program = ""
                test_inputs = []
            continue

        # New test program
        if line.startswith("try "):
            if current_program and test_inputs:
                # Save previous test
                for k, ti in enumerate(test_inputs):
                    test_cases.append(
                        AwkTestCase(
                            name=f"{current_program[:40]}... case {k + 1}",
                            program=current_program,
                            input=ti["input"],
                            expected_output=ti["expected"],
                            line_number=test_line_number,
                            field_separator="\t",
                        )
                    )
            current_program = line[4:].strip()
            test_inputs = []
            test_line_number = j + 1
            continue

        # Input/expected line (tab-separated)
        if current_program and "\t" in line:
            parts = line.split("\t")
            expected = parts[-1]
            input_val = "\t".join(parts[:-1])
            test_inputs.append(
                {
                    "input": input_val,
                    "expected": "" if expected == '""' else expected,
                }
            )

    # Don't forget last test
    if current_program and test_inputs:
        for k, ti in enumerate(test_inputs):
            test_cases.append(
                AwkTestCase(
                    name=f"{current_program[:40]}... case {k + 1}",
                    program=current_program,
                    input=ti["input"],
                    expected_output=ti["expected"],
                    line_number=test_line_number,
                    field_separator="\t",
                )
            )

    return HeredocParseResult(test_cases=test_cases, next_line=heredoc_end + 1)


def try_parse_temp_var_style_test(
    lines: list[str], start_line: int
) -> ParseResult | None:
    """Try to parse a $TEMP-style test (T.split format).

    Pattern:
    echo 'input' > $TEMP0
    $awk 'program' $TEMP0 > $TEMP1  OR  $awk 'program' > $TEMP1 <<XXX ... XXX
    echo 'expected' > $TEMP2
    diff $TEMP1 $TEMP2 || fail 'BAD: T.split testname'

    Note: $TEMP0 is input file, $TEMP1 is awk output, $TEMP2 is expected output
    """
    awk_line = lines[start_line]

    # Match: $awk '...' [file] > $TEMP1 or $awk '...' > $TEMP1 <<XXX
    program = ""
    awk_end_line = start_line

    # Check if this is a single-line or multi-line awk command
    single_line_match = re.match(
        r"\$awk\s+(?:-[^\s]+\s+)?'([^']+)'\s*(?:([^\s>]+)\s*)?>\s*\$TEMP(\d)",
        awk_line,
    )

    if single_line_match:
        program = single_line_match.group(1)
        awk_end_line = start_line
    else:
        # Multi-line awk program: find the closing quote
        for j in range(start_line, len(lines)):
            if re.search(r"'\s*(?:\$TEMP\d|[^\s>]+)?\s*>\s*\$TEMP", lines[j]):
                awk_end_line = j
                break
            if re.search(r">\s*\$TEMP\d?\s*<<", lines[j]):
                awk_end_line = j
                break

        # Extract program from multi-line
        awk_lines = "\n".join(lines[start_line : awk_end_line + 1])
        program_match = re.search(
            r"\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*(?:[^\s>]+\s*)?", awk_lines
        )
        if not program_match:
            return None
        program = program_match.group(1)

    # Check for heredoc input in the awk line: > $TEMP1 <<XXX
    input_data = ""
    heredoc_match = re.search(r">\s*\$TEMP\d?\s*<<\s*(\w+)", lines[awk_end_line])
    if heredoc_match:
        delimiter = heredoc_match.group(1)
        heredoc_lines: list[str] = []
        heredoc_end_line = awk_end_line
        for j in range(awk_end_line + 1, len(lines)):
            if lines[j] == delimiter or lines[j].strip() == delimiter:
                heredoc_end_line = j
                break
            heredoc_lines.append(lines[j])
        input_data = "\n".join(heredoc_lines)
        awk_end_line = heredoc_end_line

    # Search backwards for input file content (echo '...' > $TEMP0)
    if not input_data:
        for j in range(start_line - 1, max(-1, start_line - 31), -1):
            line = lines[j]

            # Stop at previous diff/fail (test boundary)
            if re.search(r"diff\s+\$TEMP", line) or re.search(r"fail\s+'", line):
                break

            # Multi-line echo ending with > $TEMP0
            if re.search(r"'\s*>\s*\$TEMP0$", line):
                # Search backwards for echo start
                for k in range(j, max(-1, j - 21), -1):
                    if re.match(r"^echo\s+'", lines[k]):
                        echo_content = re.search(
                            r"echo\s+'([\s\S]*?)'\s*>\s*\$TEMP0",
                            "\n".join(lines[k : j + 1]),
                        )
                        if echo_content:
                            input_data = echo_content.group(1)
                        break
                break

            # Single-line echo > $TEMP0
            single_echo_match = re.match(
                r"^echo\s+(['\"])([\s\S]*?)\1\s*>\s*\$TEMP0$", line
            )
            if single_echo_match:
                input_data = single_echo_match.group(2)
                break

    # Check if awk command references $TEMP0 as input file
    awk_section = "\n".join(lines[start_line : awk_end_line + 1])
    uses_temp0_as_file = bool(re.search(r"'\s+['\"]?\$TEMP0['\"]?\s*>\s*\$TEMP", awk_section))

    # Look for expected output and test name
    expected_output = ""
    test_name = ""
    next_line = awk_end_line + 1

    for j in range(awk_end_line + 1, min(awk_end_line + 20, len(lines))):
        line = lines[j]

        # Multi-line echo ending with > $TEMP2
        if re.search(r"'\s*>\s*\$TEMP2$", line) and not expected_output:
            # Search backwards for echo start within this section
            for k in range(j, awk_end_line, -1):
                if re.match(r"^echo\s+'", lines[k]):
                    echo_content = re.search(
                        r"echo\s+'([\s\S]*?)'\s*>\s*\$TEMP2",
                        "\n".join(lines[k : j + 1]),
                    )
                    if echo_content:
                        expected_output = echo_content.group(1)
                        next_line = j + 1
                    break

        # Single-line echo > $TEMP2 (with quotes)
        echo_match = re.match(r"^echo\s+(['\"])(.*?)\1\s*>\s*\$TEMP2$", line)
        if echo_match and not expected_output:
            expected_output = (
                echo_match.group(2).replace("\\n", "\n").replace("\\t", "\t")
            )
            next_line = j + 1

        # Single-line echo > $TEMP2 (without quotes)
        if not echo_match and not expected_output:
            echo_no_quote_match = re.match(r"^echo\s+(\S+)\s*>\s*\$TEMP2$", line)
            if echo_no_quote_match:
                expected_output = echo_no_quote_match.group(1)
                next_line = j + 1

        # diff $TEMP1 $TEMP2 || fail '...'
        diff_match = re.match(
            r"diff\s+\$TEMP1\s+\$TEMP2\s*\|\|\s*fail\s+(['\"])(?:BAD:\s*)?([^'\"]+)\1",
            line,
        )
        if diff_match:
            test_name = clean_test_name(diff_match.group(2))
            next_line = j + 1
            break

    if not program:
        return None

    if not test_name:
        test_name = f"test at line {start_line + 1}"

    # If test uses $TEMP0 as file but we have no input, mark it
    if uses_temp0_as_file and not input_data:
        input_data = "[file: $TEMP0]"

    return ParseResult(
        test_case=AwkTestCase(
            name=test_name,
            program=program,
            input=input_data,
            expected_output=expected_output,
            line_number=start_line + 1,
            original_command=awk_line.strip(),
        ),
        next_line=next_line,
    )
