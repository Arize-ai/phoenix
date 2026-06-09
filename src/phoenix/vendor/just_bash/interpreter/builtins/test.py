"""Test / [ builtin implementation.

The test command evaluates conditional expressions and returns
exit code 0 (true) or 1 (false).

Usage: test expression
       [ expression ]

File operators:
  -f FILE     True if FILE exists and is a regular file
  -d FILE     True if FILE exists and is a directory
  -e FILE     True if FILE exists
  -s FILE     True if FILE exists and has size > 0
  -r FILE     True if FILE exists and is readable
  -w FILE     True if FILE exists and is writable
  -x FILE     True if FILE exists and is executable
  -h/-L FILE  True if FILE exists and is a symbolic link

String operators:
  -z STRING   True if STRING is empty
  -n STRING   True if STRING is not empty
  STRING      True if STRING is not empty
  S1 = S2     True if strings are equal
  S1 != S2    True if strings are not equal
  S1 < S2     True if S1 sorts before S2
  S1 > S2     True if S1 sorts after S2

Numeric operators:
  N1 -eq N2   True if N1 equals N2
  N1 -ne N2   True if N1 does not equal N2
  N1 -lt N2   True if N1 is less than N2
  N1 -le N2   True if N1 is less or equal to N2
  N1 -gt N2   True if N1 is greater than N2
  N1 -ge N2   True if N1 is greater or equal to N2

Logical operators:
  ! EXPR      True if EXPR is false
  ( EXPR )    Grouping
  EXPR -a EXPR  True if both EXPRs are true (AND)
  EXPR -o EXPR  True if either EXPR is true (OR)
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


# Known unary operators that require an operand
_UNARY_OPS = {
    "-f", "-d", "-e", "-s", "-r", "-w", "-x", "-h", "-L",
    "-z", "-n", "-b", "-c", "-g", "-G", "-k", "-O", "-p",
    "-S", "-t", "-u", "-N", "-v", "-o",
}


async def handle_test(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the test builtin."""
    from ...types import ExecResult

    # Empty test is false
    if not args:
        return ExecResult(stdout="", stderr="", exit_code=1)

    try:
        result = await _evaluate(ctx, args)
        return ExecResult(stdout="", stderr="", exit_code=0 if result else 1)
    except ValueError as e:
        return ExecResult(stdout="", stderr=f"bash: test: {e}\n", exit_code=2)


async def handle_bracket(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the [ builtin (requires closing ])."""
    from ...types import ExecResult

    # [ requires closing ]
    if not args or args[-1] != "]":
        return ExecResult(stdout="", stderr="bash: [: missing `]'\n", exit_code=2)
    args = args[:-1]

    # Empty test is false
    if not args:
        return ExecResult(stdout="", stderr="", exit_code=1)

    try:
        result = await _evaluate(ctx, args)
        return ExecResult(stdout="", stderr="", exit_code=0 if result else 1)
    except ValueError as e:
        return ExecResult(stdout="", stderr=f"bash: [: {e}\n", exit_code=2)


async def _evaluate(ctx: "InterpreterContext", args: list[str]) -> bool:
    """Evaluate a test expression."""
    if not args:
        return False

    # Single argument: non-empty string is true (POSIX rule)
    # Must come before operator checks since operators are valid strings
    if len(args) == 1:
        return args[0] != ""

    # Handle negation
    if args[0] == "!" and len(args) > 1:
        return not await _evaluate(ctx, args[1:])

    # Handle parentheses (only when there are enough args)
    if args[0] == "(" and len(args) > 1:
        # Find matching )
        depth = 1
        end_idx = 1
        while end_idx < len(args) and depth > 0:
            if args[end_idx] == "(":
                depth += 1
            elif args[end_idx] == ")":
                depth -= 1
            end_idx += 1

        if depth != 0:
            raise ValueError("missing ')'")

        inner_result = await _evaluate(ctx, args[1:end_idx - 1])

        # Check for -a or -o after the parentheses
        if end_idx < len(args):
            return await _evaluate_compound(ctx, inner_result, args[end_idx:])

        return inner_result

    # Handle -a and -o (lowest precedence)
    for i, arg in enumerate(args):
        if arg == "-a" and i > 0:
            left = await _evaluate(ctx, args[:i])
            right = await _evaluate(ctx, args[i + 1:])
            return left and right
        if arg == "-o" and i > 0:
            left = await _evaluate(ctx, args[:i])
            right = await _evaluate(ctx, args[i + 1:])
            return left or right

    # Two arguments: unary operators
    if len(args) == 2:
        return await _unary_test(ctx, args[0], args[1])

    # Three arguments: binary operators
    if len(args) == 3:
        # Special case: if middle arg is a known binary operator, use binary test
        if args[1] in ("=", "==", "!=", "<", ">",
                        "-eq", "-ne", "-lt", "-le", "-gt", "-ge",
                        "-nt", "-ot", "-ef"):
            return await _binary_test(ctx, args[0], args[1], args[2])
        # Otherwise handle as compound (e.g., [ ! -f file ])
        if args[0] == "!":
            return not await _evaluate(ctx, args[1:])
        raise ValueError(f"unknown binary operator '{args[1]}'")

    # Four arguments: could be ! with 3-arg expression, or compound
    if len(args) == 4:
        if args[0] == "!":
            return not await _evaluate(ctx, args[1:])
        # Otherwise handled by -a/-o above
        raise ValueError("too many arguments")

    # More than 4 args should be handled by -a/-o above
    raise ValueError("too many arguments")


async def _evaluate_compound(
    ctx: "InterpreterContext", left_result: bool, remaining: list[str]
) -> bool:
    """Evaluate compound expression with -a or -o."""
    if not remaining:
        return left_result

    op = remaining[0]
    rest = remaining[1:]

    if op == "-a":
        if not left_result:
            return False
        return await _evaluate(ctx, rest)
    elif op == "-o":
        if left_result:
            return True
        return await _evaluate(ctx, rest)
    else:
        raise ValueError(f"unexpected '{op}'")


async def _unary_test(ctx: "InterpreterContext", op: str, arg: str) -> bool:
    """Evaluate a unary test."""
    # File tests
    if op == "-f":
        return await _file_test(ctx, arg, "file")
    if op == "-d":
        return await _file_test(ctx, arg, "directory")
    if op in ("-e", "-a"):
        return await _file_test(ctx, arg, "exists")
    if op == "-s":
        return await _file_test(ctx, arg, "size")
    if op == "-r":
        return await _file_test(ctx, arg, "readable")
    if op == "-w":
        return await _file_test(ctx, arg, "writable")
    if op == "-x":
        return await _file_test(ctx, arg, "executable")
    if op in ("-h", "-L"):
        return await _file_test(ctx, arg, "symlink")
    if op == "-b":
        return False  # block special - not in virtual fs
    if op == "-c":
        return False  # character special - not in virtual fs
    if op == "-p":
        return False  # named pipe - not in virtual fs
    if op == "-S":
        return False  # socket - not in virtual fs
    if op == "-g":
        return False  # setgid - not in virtual fs
    if op == "-G":
        return await _file_test(ctx, arg, "exists")  # owned by effective group
    if op == "-k":
        return False  # sticky bit - not in virtual fs
    if op == "-O":
        return await _file_test(ctx, arg, "exists")  # owned by effective user
    if op == "-u":
        return False  # setuid - not in virtual fs
    if op == "-N":
        return await _file_test(ctx, arg, "exists")  # modified since last read

    # String tests
    if op == "-z":
        return arg == ""
    if op == "-n":
        return arg != ""

    # Variable test: -v checks if a variable is set
    if op == "-v":
        # Check if variable is set (even to empty string)
        from ..types import VariableStore
        env = ctx.state.env
        # Handle array subscripts: var[idx]
        if "[" in arg and arg.endswith("]"):
            bracket_idx = arg.index("[")
            base_name = arg[:bracket_idx]
            subscript = arg[bracket_idx + 1:-1]
            if subscript in ("@", "*"):
                # Check if array has any elements
                prefix = f"{base_name}_"
                return any(k.startswith(prefix) and not k.startswith(f"{base_name}__")
                          for k in env.keys())
            key = f"{base_name}_{subscript}"
            return key in env
        # Dynamic variables that are always set
        if arg in ("SHELLOPTS", "BASHOPTS", "RANDOM", "LINENO", "SECONDS",
                   "BASH_VERSION", "BASHPID"):
            return True
        return arg in env

    # Shell option test: -o checks if an option is enabled
    if op == "-o":
        if arg == "errexit":
            return getattr(ctx.state.options, 'errexit', False)
        elif arg == "nounset":
            return getattr(ctx.state.options, 'nounset', False)
        elif arg == "xtrace":
            return getattr(ctx.state.options, 'xtrace', False)
        elif arg == "pipefail":
            return getattr(ctx.state.options, 'pipefail', False)
        return False

    # Terminal test: -t checks if fd is a terminal (always false in virtual env)
    if op == "-t":
        return False

    # If op is not a known operator, treat as 2-arg string test
    # e.g., [ "str1" = "str2" ] should be handled by _binary_test,
    # but [ "str1" "str2" ] is an error
    raise ValueError(f"unknown unary operator '{op}'")


async def _binary_test(
    ctx: "InterpreterContext", left: str, op: str, right: str
) -> bool:
    """Evaluate a binary test."""
    # String comparisons
    if op == "=":
        return left == right
    if op == "==":
        return left == right
    if op == "!=":
        return left != right
    if op == "<":
        return left < right
    if op == ">":
        return left > right

    # Numeric comparisons
    if op in ("-eq", "-ne", "-lt", "-le", "-gt", "-ge"):
        try:
            left_num = int(left)
            right_num = int(right)
        except ValueError:
            raise ValueError(f"integer expression expected")

        if op == "-eq":
            return left_num == right_num
        if op == "-ne":
            return left_num != right_num
        if op == "-lt":
            return left_num < right_num
        if op == "-le":
            return left_num <= right_num
        if op == "-gt":
            return left_num > right_num
        if op == "-ge":
            return left_num >= right_num

    # File comparison operators
    if op == "-nt":
        # FILE1 is newer than FILE2
        return await _file_compare(ctx, left, right, "newer")
    if op == "-ot":
        # FILE1 is older than FILE2
        return await _file_compare(ctx, left, right, "older")
    if op == "-ef":
        # FILE1 and FILE2 refer to same file (same device and inode)
        full_left = ctx.fs.resolve_path(ctx.state.cwd, left)
        full_right = ctx.fs.resolve_path(ctx.state.cwd, right)
        try:
            return (await ctx.fs.exists(full_left)
                    and await ctx.fs.exists(full_right)
                    and full_left == full_right)
        except Exception:
            return False

    raise ValueError(f"unknown binary operator '{op}'")


async def _file_compare(ctx: "InterpreterContext", file1: str, file2: str, comparison: str) -> bool:
    """Compare two files by modification time."""
    full1 = ctx.fs.resolve_path(ctx.state.cwd, file1)
    full2 = ctx.fs.resolve_path(ctx.state.cwd, file2)
    try:
        exists1 = await ctx.fs.exists(full1)
        exists2 = await ctx.fs.exists(full2)

        if not exists1 and not exists2:
            return False
        if not exists1:
            return comparison == "older"
        if not exists2:
            return comparison == "newer"

        # In virtual filesystem, try to get stat info
        try:
            stat1 = await ctx.fs.stat(full1)
            stat2 = await ctx.fs.stat(full2)
            if hasattr(stat1, 'mtime') and hasattr(stat2, 'mtime'):
                if comparison == "newer":
                    return stat1.mtime > stat2.mtime
                else:
                    return stat1.mtime < stat2.mtime
        except (AttributeError, Exception):
            pass

        # Without mtime, files that exist are considered equal
        return False
    except Exception:
        return False


async def _file_test(ctx: "InterpreterContext", path: str, test_type: str) -> bool:
    """Perform a file test."""
    # Resolve path relative to cwd
    full_path = ctx.fs.resolve_path(ctx.state.cwd, path)

    try:
        # For symlink test, use lstat (doesn't follow symlinks)
        if test_type == "symlink":
            try:
                stat_info = await ctx.fs.lstat(full_path)
                return stat_info.is_symbolic_link
            except FileNotFoundError:
                return False

        exists = await ctx.fs.exists(full_path)

        if test_type == "exists":
            return exists

        if not exists:
            return False

        if test_type == "directory":
            return await ctx.fs.is_directory(full_path)

        if test_type == "file":
            return not await ctx.fs.is_directory(full_path)

        if test_type == "size":
            content = await ctx.fs.read_file(full_path)
            return len(content) > 0

        # For readable/writable/executable, we assume true if exists
        # (virtual filesystem doesn't track permissions)
        if test_type in ("readable", "writable", "executable"):
            return exists

        return False
    except Exception:
        return False
