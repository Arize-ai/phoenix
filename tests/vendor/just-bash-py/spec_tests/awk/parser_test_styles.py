"""Test parsing functions for specific onetrueawk test styles."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .parser import AwkTestCase


@dataclass
class ParseResult:
    """Result of parsing a test case."""

    test_case: "AwkTestCase"
    next_line: int


def clean_test_name(name: str) -> str:
    """Strip control characters from test names (except common whitespace)."""
    # Remove control characters (0x00-0x1F except tab, newline, carriage return)
    # Also remove 0x7F (DEL) and Unicode replacement character U+FFFD
    result = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]", "", name)
    return result.strip()


def extract_cat_heredoc(
    lines: list[str], start_line: int
) -> dict[str, str | int] | None:
    """Extract a multi-line heredoc expected output (cat << \\EOF ... EOF or cat <<! ... !)."""
    line = lines[start_line]

    # Look for cat <<\\EOF or cat << \\EOF or cat << 'EOF' or cat <<! patterns
    cat_match = re.match(r"cat\s+<<\s*\\?(['\"])?(\w+|!)\1?\s*(?:>\s*foo([12]))?", line)
    if not cat_match:
        return None

    delimiter = cat_match.group(2)
    content_lines: list[str] = []
    end_line = start_line + 1

    for j in range(start_line + 1, len(lines)):
        trimmed_line = lines[j].strip()
        # Check for delimiter (with optional leading/trailing whitespace)
        if trimmed_line == delimiter:
            end_line = j
            break
        content_lines.append(lines[j])

    return {"content": "\n".join(content_lines), "end_line": end_line}


def try_parse_builtin_style_test(
    lines: list[str],
    start_line: int,
    try_parse_multi_line_awk_test,  # Callback function
) -> ParseResult | None:
    """Try to parse a T.builtin style test.

    Pattern:
    $awk 'program' [input] >foo1
    echo 'expected' >foo2
    diff foo1 foo2 || echo 'BAD: testname'
    """
    from .parser import AwkTestCase

    awk_line = lines[start_line]

    # Extract the awk program from $awk '...' or $awk "..."
    # Capture any flags/options between $awk and the program quote
    # Also handle subshell closing paren: $awk '...')[)] >foo
    awk_match = re.match(
        r"\$awk\s+((?:-[^\s']+\s+)*)(['\"])([\s\S]*?)\2(?:\s+([^\s>]+))?\)?\s*>\s*foo([12])",
        awk_line,
    )
    if not awk_match:
        # Try multi-line awk program
        return try_parse_multi_line_awk_test(lines, start_line)

    flags_str = awk_match.group(1) or ""
    program = awk_match.group(3)
    input_file = awk_match.group(4)
    foo_num = awk_match.group(5)

    # Parse -v var=value options from flags
    vars: dict[str, str] = {}
    # Match both -v var=value and -vvar=value formats
    for var_match in re.finditer(r"-v\s*(\w+)=([^\s]+)\s*", flags_str):
        vars[var_match.group(1)] = var_match.group(2)

    expected_output = ""
    test_name = ""
    input_data = ""
    next_line = start_line + 1

    # Check for piped input: echo 'data' | $awk (same line)
    pipe_match = re.search(r"echo\s+(['\"])(.*?)\1\s*\|\s*\$awk", awk_line)
    if pipe_match:
        input_data = pipe_match.group(2)

    # Also check for unquoted piped input: echo data | $awk (same line)
    if not input_data:
        unquoted_pipe_match = re.search(r"echo\s+(.+?)\s*\|\s*\$awk", awk_line)
        if unquoted_pipe_match:
            input_data = unquoted_pipe_match.group(1)

    # Check for piped input from previous line
    if not input_data and start_line > 0:
        prev_line = lines[start_line - 1]
        # Match: echo 'input' | or echo "input" | at end of line (single line)
        prev_pipe_match = re.search(r"echo\s+(['\"])(.*?)\1\s*\|\s*$", prev_line)
        if prev_pipe_match:
            input_data = prev_pipe_match.group(2)
        # Also try matching echo anywhere in the line (for cases like "... && echo 'data' |")
        if not input_data:
            any_echo_match = re.search(r"&&\s*echo\s+(['\"])(.*?)\1\s*\|\s*$", prev_line)
            if any_echo_match:
                input_data = any_echo_match.group(2)
        # Check for multi-line echo input ending with ' | or " |
        if not input_data and prev_line.strip().endswith("' |"):
            # Search backwards for the echo start
            for j in range(start_line - 1, max(-1, start_line - 16), -1):
                search_line = lines[j]
                if re.match(r"^echo\s+'", search_line):
                    # Found start of echo, extract content up to the pipe
                    echo_content = re.search(
                        r"echo\s+'([\s\S]*?)'\s*\|",
                        "\n".join(lines[j:start_line]),
                    )
                    if echo_content:
                        input_data = echo_content.group(1)
                    break

    # Check for expected output from PREVIOUS lines (when awk output goes to foo2, expected in foo1)
    if foo_num == "2" and start_line > 0:
        for j in range(start_line - 1, max(-1, start_line - 16), -1):
            prev_line = lines[j]
            # Skip empty lines and comments
            if not prev_line.strip() or prev_line.strip().startswith("#"):
                continue
            # Stop if we hit another awk command or comparison
            if (
                re.match(r"^\$awk", prev_line)
                or re.match(r"^(?:diff|cmp)\s+", prev_line)
                or re.search(r"\|\|\s*\.?\/?echo", prev_line)
            ):
                break
            # Single-line echo with quotes
            prev_echo_match = re.match(
                r"^\.?\/?echo\s+(['\"])(.*?)\1\s*>\s*foo1$", prev_line
            )
            if prev_echo_match:
                expected_output = (
                    prev_echo_match.group(2)
                    .replace("\\n", "\n")
                    .replace("\\t", "\t")
                )
                break
            # Single-line echo without quotes
            prev_echo_no_quote_match = re.match(
                r"^\.?\/?echo\s+(.+?)\s*>\s*foo1$", prev_line
            )
            if prev_echo_no_quote_match:
                expected_output = prev_echo_no_quote_match.group(1)
                break
            # Multi-line echo (check if this line ends with ' >foo1 or " >foo1)
            if re.match(r"^[^'\"]*['\"]\s*>\s*foo1$", prev_line):
                # Search backwards for the echo start
                for k in range(j, max(-1, j - 16), -1):
                    if re.match(r"^\.?\/?echo\s+'", lines[k]):
                        echo_content = re.search(
                            r"\.?\/?echo\s+'([\s\S]*?)'\s*>\s*foo1",
                            "\n".join(lines[k : j + 1]),
                        )
                        if echo_content:
                            expected_output = echo_content.group(1)
                        break
                break

    # Look for the expected output and diff/cmp line
    for j in range(start_line + 1, min(start_line + 15, len(lines))):
        line = lines[j]

        # echo 'expected' >foo1/foo2 (with quotes)
        echo_match = re.match(r"\.?\/?echo\s+(['\"])(.*?)\1\s*>\s*foo([12])", line)
        if echo_match and echo_match.group(3) != foo_num:
            expected_output = (
                echo_match.group(2).replace("\\n", "\n").replace("\\t", "\t")
            )
            next_line = j + 1

        # echo expected >foo1/foo2 (without quotes)
        if not echo_match:
            echo_no_quote_match = re.match(r"^\.?\/?echo\s+(\S+)\s*>\s*foo([12])$", line)
            if echo_no_quote_match and echo_no_quote_match.group(2) != foo_num:
                expected_output = echo_no_quote_match.group(1)
                next_line = j + 1

        # Multi-line echo expected output
        if (
            re.match(r"^\.?\/?echo\s+['\"][^'\"]*$", line)
            and ">foo" not in line
            and not expected_output
        ):
            quote_char = '"' if '"' in line else "'"
            echo_lines: list[str] = [re.sub(r"^\.?\/?echo\s+['\"]", "", line)]
            echo_end_line = j
            for k in range(j + 1, len(lines)):
                k_line = lines[k]
                if re.search(rf"{quote_char}\s*>\s*foo([12])$", k_line):
                    foo_match = re.search(r"foo([12])$", k_line)
                    if foo_match and foo_match.group(1) != foo_num:
                        echo_lines.append(
                            re.sub(rf"{quote_char}\s*>\s*foo\d$", "", k_line)
                        )
                        expected_output = "\n".join(echo_lines)
                        next_line = k + 1
                    echo_end_line = k
                    break
                echo_lines.append(k_line)
            j = echo_end_line
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

    if not test_name:
        test_name = f"test at line {start_line + 1}"

    # Handle input file
    if input_file and input_file != "/dev/null":
        input_data = f"[file: {input_file}]"

    test_case = AwkTestCase(
        name=test_name,
        program=program,
        input=input_data,
        expected_output=expected_output,
        line_number=start_line + 1,
        original_command=awk_line.strip(),
    )
    if vars:
        test_case.vars = vars

    return ParseResult(test_case=test_case, next_line=next_line)


def try_parse_multi_line_awk_test(
    lines: list[str], start_line: int
) -> ParseResult | None:
    """Try to parse a multi-line awk program test."""
    from .parser import AwkTestCase

    first_line = lines[start_line]

    # Check for $awk ' pattern that continues on next lines
    if not re.match(r"\$awk\s+'", first_line):
        return None

    # Find the closing quote
    program = ""
    end_line = start_line
    quote_count = 0

    for j in range(start_line, len(lines)):
        line = lines[j]
        # Count single quotes (very basic - doesn't handle escapes properly)
        quote_count += line.count("'")
        program += ("" if j == start_line else "\n") + line
        # Need at least 2 quotes and even count
        if quote_count >= 2 and quote_count % 2 == 0:
            # Check if line ends with >foo or has redirection
            if ">foo" in line or re.search(r"'[^']*$", line):
                end_line = j
                break

    # Extract the program from between quotes
    program_match = re.search(
        r"\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*(?:\/dev\/null|[^\s>]*)?", program
    )
    if not program_match:
        return None

    # Skip commands that redirect to /dev/null - these aren't real tests
    if ">/dev/null" in program or "> /dev/null" in program:
        return None

    # Check for input file or heredoc input
    input_data = ""
    input_file_match = re.search(r"'\s+(\S+)\s*>\s*foo", program)
    if input_file_match and input_file_match.group(1) != "/dev/null":
        input_data = f"[file: {input_file_match.group(1)}]"

    # Check for heredoc input (<<! ... !)
    heredoc_input_match = re.search(r"<<\s*!$", program)
    if heredoc_input_match:
        heredoc_lines: list[str] = []
        heredoc_end_line = end_line
        for j in range(end_line + 1, len(lines)):
            if lines[j] == "!":
                heredoc_end_line = j
                break
            heredoc_lines.append(lines[j])
        input_data = "\n".join(heredoc_lines)
        end_line = heredoc_end_line

    # Look for expected output and test name
    expected_output = ""
    test_name = ""
    next_line = end_line + 1

    for j in range(end_line + 1, min(end_line + 20, len(lines))):
        line = lines[j]

        # Simple echo expected output (with quotes)
        echo_match = re.match(r"^\.?\/?(echo)\s+(['\"])(.*?)\2\s*>\s*foo([12])$", line)
        if echo_match:
            expected_output = (
                echo_match.group(3).replace("\\n", "\n").replace("\\t", "\t")
            )
            next_line = j + 1

        # Simple echo expected output (without quotes)
        if not echo_match:
            echo_no_quote_match = re.match(
                r"^\.?\/?(echo)\s+(\S+)\s*>\s*foo([12])$", line
            )
            if echo_no_quote_match:
                expected_output = echo_no_quote_match.group(2)
                next_line = j + 1

        # Multi-line echo expected output (echo '1\\n0\\n1' style)
        multi_line_echo_match = re.match(
            r"\.?\/?echo\s+['\"]([^'\"]*(?:\\n[^'\"]*)*)['\"]", line
        )
        if multi_line_echo_match:
            expected_output = (
                multi_line_echo_match.group(1).replace("\\n", "\n").replace("\\t", "\t")
            )
            next_line = j + 1

        # Multi-line echo expected output (echo "foo\\nbar" spanning lines)
        if re.match(r"^\.?\/?echo\s+['\"][^'\"]*$", line) and ">foo" not in line:
            quote_char = '"' if '"' in line else "'"
            echo_lines: list[str] = [re.sub(r"^\.?\/?echo\s+['\"]", "", line)]
            echo_end_line = j
            for k in range(j + 1, len(lines)):
                if re.search(rf"{quote_char} >foo", lines[k]) or re.search(
                    rf"{quote_char}\s*>\s*foo", lines[k]
                ):
                    echo_lines.append(
                        re.sub(rf"{quote_char}\s*>\s*foo\d$", "", lines[k])
                    )
                    echo_end_line = k
                    break
                echo_lines.append(lines[k])
            expected_output = "\n".join(echo_lines)
            next_line = echo_end_line + 1
            j = echo_end_line
            continue

        # cat << heredoc expected output
        if re.match(r"cat\s+<<\s*\\?['\"]?(\w+)['\"]?\s*>\s*foo", line):
            heredoc = extract_cat_heredoc(lines, j)
            if heredoc:
                expected_output = heredoc["content"]
                next_line = heredoc["end_line"] + 1
                j = heredoc["end_line"]
                continue

        # cat <<! ... ! expected output (different delimiter)
        if re.match(r"cat\s+<<\s*!?\s*>\s*foo", line):
            heredoc_lines: list[str] = []
            heredoc_end_line = j
            for k in range(j + 1, len(lines)):
                if lines[k] == "!":
                    heredoc_end_line = k
                    break
                heredoc_lines.append(lines[k])
            expected_output = "\n".join(heredoc_lines)
            next_line = heredoc_end_line + 1
            j = heredoc_end_line
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

        # Also check for grep-based error checks
        grep_match = re.match(
            r"grep\s+.*\|\|\s*echo\s+(['\"])?(?:BAD:\s*)?([^'\"]+)\1?", line
        )
        if grep_match:
            test_name = clean_test_name(grep_match.group(2))
            next_line = j + 1
            break

        # grep ... && echo 'BAD:' means: if grep finds pattern, test fails
        grep_and_match = re.match(
            r"grep\s+.*&&\s*echo\s+(['\"])?(?:BAD:\s*)?([^'\"]+)\1?", line
        )
        if grep_and_match:
            test_name = clean_test_name(grep_and_match.group(2))
            expected_output = ""  # grep should NOT find pattern
            next_line = j + 1
            break

    if not test_name:
        test_name = f"test at line {start_line + 1}"

    # If no expected output found after the AWK command, check previous lines
    if not expected_output and start_line > 0:
        for j in range(start_line - 1, max(-1, start_line - 6), -1):
            prev_line = lines[j]
            # Skip comments and empty lines
            if not prev_line.strip() or prev_line.strip().startswith("#"):
                continue
            # Multi-line echo
            if re.match(r"^[^']*'\s*>\s*foo1$", prev_line):
                for k in range(j, max(-1, j - 11), -1):
                    if re.match(r"^\.?\/?echo\s+'", lines[k]):
                        echo_content = re.search(
                            r"\.?\/?echo\s+'([\s\S]*?)'\s*>\s*foo1",
                            "\n".join(lines[k : j + 1]),
                        )
                        if echo_content:
                            expected_output = echo_content.group(1)
                        break
                break
            # Single-line echo with quotes
            prev_echo_match = re.match(
                r"\.?\/?echo\s+(['\"])(.*?)\1\s*>\s*foo1$", prev_line
            )
            if prev_echo_match:
                expected_output = (
                    prev_echo_match.group(2).replace("\\n", "\n").replace("\\t", "\t")
                )
                break
            # Single-line echo without quotes
            prev_echo_no_quote_match = re.match(
                r"\.?\/?echo\s+(.+?)\s*>\s*foo1$", prev_line
            )
            if prev_echo_no_quote_match:
                expected_output = prev_echo_no_quote_match.group(1)
                break
            # Stop if we hit another command
            if (
                re.match(r"^\$awk", prev_line)
                or re.match(r"^diff", prev_line)
                or re.match(r"^cmp", prev_line)
            ):
                break

    return ParseResult(
        test_case=AwkTestCase(
            name=test_name,
            program=program_match.group(1),
            input=input_data,
            expected_output=expected_output,
            line_number=start_line + 1,
            original_command=program.split("\n")[0].strip(),
        ),
        next_line=next_line,
    )
