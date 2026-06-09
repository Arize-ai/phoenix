"""Conditional Expression Evaluation.

Handles:
- [[ ... ]] conditional commands
- File tests (-f, -d, -e, etc.)
- String tests (-z, -n, =, !=)
- Numeric comparisons (-eq, -ne, -lt, etc.)
- Pattern matching (==, =~)
"""

import fnmatch
import re
from typing import TYPE_CHECKING, Union

from ..ast.types import (
    CondBinaryNode,
    CondUnaryNode,
    CondNotNode,
    CondAndNode,
    CondOrNode,
    CondGroupNode,
    CondWordNode,
    ConditionalExpressionNode,
)

if TYPE_CHECKING:
    from .types import InterpreterContext


# File test operators
FILE_TEST_OPS = {"-f", "-d", "-e", "-s", "-r", "-w", "-x", "-h", "-L", "-p", "-S", "-b", "-c", "-t", "-O", "-G", "-u", "-g", "-k", "-N"}

# Binary file test operators
BINARY_FILE_TEST_OPS = {"-nt", "-ot", "-ef"}

# String test operators
STRING_TEST_OPS = {"-z", "-n"}

# String comparison operators
STRING_COMPARE_OPS = {"=", "==", "!="}

# Numeric comparison operators
NUMERIC_OPS = {"-eq", "-ne", "-lt", "-le", "-gt", "-ge"}


async def evaluate_conditional(
    ctx: "InterpreterContext",
    expr: ConditionalExpressionNode,
) -> bool:
    """Evaluate a conditional expression from [[ ... ]]."""
    from .expansion import expand_word_async

    if isinstance(expr, CondBinaryNode):
        left = await expand_word_async(ctx, expr.left) if expr.left else ""
        right = await expand_word_async(ctx, expr.right) if expr.right else ""

        # Check if RHS is fully quoted (should be treated literally, not as pattern)
        is_rhs_quoted = False
        if expr.right and expr.right.parts:
            is_rhs_quoted = all(
                p.type in ("SingleQuoted", "DoubleQuoted", "Escaped")
                for p in expr.right.parts
            )

        op = expr.operator

        # String comparisons (with pattern matching support in [[ ]])
        if op in STRING_COMPARE_OPS:
            nocase = ctx.state.env.get("__shopt_nocasematch__") == "1"
            return compare_strings(op, left, right, allow_pattern=not is_rhs_quoted, nocase=nocase)

        # Numeric comparisons
        if op in NUMERIC_OPS:
            return compare_numeric(op, parse_numeric(left), parse_numeric(right))

        # Binary file tests
        if op in BINARY_FILE_TEST_OPS:
            return await evaluate_binary_file_test(ctx, op, left, right)

        # Regex matching
        if op == "=~":
            try:
                # When the pattern is quoted, treat as literal string match
                pattern = re.escape(right) if is_rhs_quoted else right
                # nocasematch shopt makes regex case-insensitive
                flags = 0
                if ctx.state.env.get("__shopt_nocasematch__") == "1":
                    flags = re.IGNORECASE
                match = re.search(pattern, left, flags)
                # Clear old BASH_REMATCH entries first
                to_remove = [k for k in ctx.state.env
                           if k.startswith("BASH_REMATCH_") or k.startswith("BASH_REMATCH__")]
                for k in to_remove:
                    del ctx.state.env[k]

                if match:
                    # Set BASH_REMATCH as array
                    ctx.state.env["BASH_REMATCH__is_array"] = "indexed"
                    ctx.state.env["BASH_REMATCH_0"] = match.group(0)
                    for i, group in enumerate(match.groups(), 1):
                        ctx.state.env[f"BASH_REMATCH_{i}"] = group if group is not None else ""
                else:
                    # On non-match, BASH_REMATCH is unset
                    if "BASH_REMATCH" in ctx.state.env:
                        del ctx.state.env["BASH_REMATCH"]

                return match is not None
            except re.error:
                # Invalid regex is a syntax error (exit code 2)
                raise ValueError("syntax error in regular expression")

        # Lexicographic comparison
        if op == "<":
            return left < right
        if op == ">":
            return left > right

        return False

    elif isinstance(expr, CondUnaryNode):
        operand = await expand_word_async(ctx, expr.operand) if expr.operand else ""
        op = expr.operator

        # File test operators
        if op in FILE_TEST_OPS:
            return await evaluate_file_test(ctx, op, operand)

        # String tests
        if op == "-z":
            return operand == ""
        if op == "-n":
            return operand != ""

        # Variable test
        if op == "-v":
            return evaluate_variable_test(ctx, operand)

        # Shell option test
        if op == "-o":
            return evaluate_shell_option(ctx, operand)

        return False

    elif isinstance(expr, CondNotNode):
        return not await evaluate_conditional(ctx, expr.operand)

    elif isinstance(expr, CondAndNode):
        left = await evaluate_conditional(ctx, expr.left)
        if not left:
            return False
        return await evaluate_conditional(ctx, expr.right)

    elif isinstance(expr, CondOrNode):
        left = await evaluate_conditional(ctx, expr.left)
        if left:
            return True
        return await evaluate_conditional(ctx, expr.right)

    elif isinstance(expr, CondGroupNode):
        return await evaluate_conditional(ctx, expr.expression)

    elif isinstance(expr, CondWordNode):
        value = await expand_word_async(ctx, expr.word) if expr.word else ""
        return value != ""

    return False


def compare_strings(op: str, left: str, right: str, allow_pattern: bool = False, nocase: bool = False) -> bool:
    """Compare strings, optionally with pattern matching."""
    if nocase:
        left = left.lower()
        right = right.lower()
    if op == "=" or op == "==":
        if allow_pattern:
            return match_pattern(left, right)
        return left == right
    if op == "!=":
        if allow_pattern:
            return not match_pattern(left, right)
        return left != right
    return False


def match_pattern(value: str, pattern: str) -> bool:
    """Match a value against a glob-style pattern.

    Supports standard globs and extended glob patterns.
    """
    import re as _re
    # Use regex for extglob patterns, fnmatch for standard globs
    if _re.search(r'[@?*+!]\(', pattern):
        from .expansion import glob_to_regex
        regex_pat = "^" + glob_to_regex(pattern) + "$"
        try:
            return bool(_re.match(regex_pat, value))
        except _re.error:
            pass
    return fnmatch.fnmatch(value, pattern)


def compare_numeric(op: str, left: int, right: int) -> bool:
    """Compare two numbers."""
    if op == "-eq":
        return left == right
    if op == "-ne":
        return left != right
    if op == "-lt":
        return left < right
    if op == "-le":
        return left <= right
    if op == "-gt":
        return left > right
    if op == "-ge":
        return left >= right
    return False


def parse_numeric(value: str) -> int:
    """Parse a bash numeric value.

    Supports:
    - Decimal: 42, -42
    - Octal: 0777, -0123
    - Hex: 0xff, 0xFF, -0xff
    - Base-N: 64#a, 2#1010
    - Strings are coerced to 0
    """
    value = value.strip()
    if not value:
        return 0

    # Handle negative numbers
    negative = False
    if value.startswith("-"):
        negative = True
        value = value[1:]
    elif value.startswith("+"):
        value = value[1:]

    result = 0

    # Base-N syntax: base#value
    base_match = re.match(r'^(\d+)#([a-zA-Z0-9@_]+)$', value)
    if base_match:
        base = int(base_match.group(1))
        if 2 <= base <= 64:
            result = parse_base_n(base_match.group(2), base)
        else:
            result = 0
    # Hex: 0x or 0X
    elif re.match(r'^0[xX][0-9a-fA-F]+$', value):
        result = int(value, 16)
    # Octal: starts with 0 followed by octal digits
    elif re.match(r'^0[0-7]+$', value):
        result = int(value, 8)
    # Decimal
    else:
        try:
            result = int(value)
        except ValueError:
            result = 0

    return -result if negative else result


def parse_base_n(digits: str, base: int) -> int:
    """Parse a number in base N (2-64).

    Digit values: 0-9=0-9, a-z=10-35, A-Z=36-61, @=62, _=63
    """
    result = 0
    for char in digits:
        if '0' <= char <= '9':
            digit_value = ord(char) - ord('0')
        elif 'a' <= char <= 'z':
            digit_value = ord(char) - ord('a') + 10
        elif 'A' <= char <= 'Z':
            digit_value = ord(char) - ord('A') + 36
        elif char == '@':
            digit_value = 62
        elif char == '_':
            digit_value = 63
        else:
            return 0

        if digit_value >= base:
            return 0

        result = result * base + digit_value

    return result


async def evaluate_file_test(ctx: "InterpreterContext", op: str, path: str) -> bool:
    """Evaluate a file test operator."""
    full_path = ctx.fs.resolve_path(ctx.state.cwd, path)

    try:
        exists = await ctx.fs.exists(full_path)

        if op == "-e":
            return exists

        if not exists:
            return False

        if op == "-d":
            return await ctx.fs.is_directory(full_path)

        if op == "-f":
            return not await ctx.fs.is_directory(full_path)

        if op == "-s":
            content = await ctx.fs.read_file(full_path)
            return len(content) > 0

        # For r/w/x, we assume true if file exists (VFS doesn't track permissions)
        if op in ("-r", "-w", "-x"):
            return exists

        # Symlink tests
        if op in ("-h", "-L"):
            # VFS doesn't track symlinks, assume false
            return False

        # Special file tests (pipe, socket, block, char)
        if op in ("-p", "-S", "-b", "-c"):
            return False

        # Terminal test
        if op == "-t":
            return False

        # Owner tests
        if op in ("-O", "-G"):
            return exists

        # Permission bit tests
        if op in ("-u", "-g", "-k"):
            return False

        # File modified since last read
        if op == "-N":
            return False

        return False
    except Exception:
        return False


async def evaluate_binary_file_test(
    ctx: "InterpreterContext", op: str, left: str, right: str
) -> bool:
    """Evaluate binary file test operators (-nt, -ot, -ef)."""
    # These require file modification times which VFS may not track
    # For now, return False
    left_path = ctx.fs.resolve_path(ctx.state.cwd, left)
    right_path = ctx.fs.resolve_path(ctx.state.cwd, right)

    try:
        left_exists = await ctx.fs.exists(left_path)
        right_exists = await ctx.fs.exists(right_path)

        if op == "-nt":  # newer than
            # If left exists and right doesn't, left is newer
            if left_exists and not right_exists:
                return True
            return False

        if op == "-ot":  # older than
            # If right exists and left doesn't, left is older
            if right_exists and not left_exists:
                return True
            return False

        if op == "-ef":  # same file
            # Check if both point to same file (VFS: check paths)
            return left_path == right_path and left_exists

        return False
    except Exception:
        return False


def evaluate_variable_test(ctx: "InterpreterContext", name: str) -> bool:
    """Test if a variable is set (-v)."""
    from .types import VariableStore
    env = ctx.state.env

    # Handle array element syntax: arr[idx]
    if "[" in name and name.endswith("]"):
        base = name[:name.index("[")]
        idx = name[name.index("[") + 1:-1]
        # Resolve nameref for array base
        if isinstance(env, VariableStore) and env.is_nameref(base):
            try:
                base = env.resolve_nameref(base)
            except ValueError:
                return False
        # Check if array element exists
        key = f"{base}_{idx}"
        return key in env

    # Resolve nameref
    if isinstance(env, VariableStore) and env.is_nameref(name):
        try:
            resolved = env.resolve_nameref(name)
            return resolved in env
        except ValueError:
            return False

    # Dynamic variables that are always set
    if name in ("SHELLOPTS", "BASHOPTS", "RANDOM", "LINENO", "SECONDS",
                "BASH_VERSION", "BASHPID"):
        return True

    return name in env


def evaluate_shell_option(ctx: "InterpreterContext", option: str) -> bool:
    """Test if a shell option is enabled (-o)."""
    option_map = {
        "errexit": lambda: ctx.state.options.errexit,
        "nounset": lambda: ctx.state.options.nounset,
        "pipefail": lambda: ctx.state.options.pipefail,
        "xtrace": lambda: ctx.state.options.xtrace,
        "verbose": lambda: ctx.state.options.verbose,
        "e": lambda: ctx.state.options.errexit,
        "u": lambda: ctx.state.options.nounset,
        "x": lambda: ctx.state.options.xtrace,
        "v": lambda: ctx.state.options.verbose,
    }

    getter = option_map.get(option)
    if getter:
        return getter()
    return False
