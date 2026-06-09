"""Mapfile/readarray builtin implementation.

Usage: mapfile [-d delim] [-n count] [-O origin] [-s count] [-t] [array]
       readarray [-d delim] [-n count] [-O origin] [-s count] [-t] [array]

Reads lines from stdin into an array variable.

Options:
  -d delim    Use delim as line delimiter instead of newline
  -n count    Read at most count lines (0 means all)
  -O origin   Begin assigning at index origin (default 0)
  -s count    Skip the first count lines
  -t          Remove trailing delimiter from each line
  array       Name of array variable (default: MAPFILE)
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


def _result(stdout: str, stderr: str, exit_code: int) -> "ExecResult":
    """Create an ExecResult."""
    from ...types import ExecResult
    return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)


async def handle_mapfile(
    ctx: "InterpreterContext", args: list[str], stdin: str = ""
) -> "ExecResult":
    """Execute the mapfile/readarray builtin."""
    # Parse options
    delimiter = "\n"
    max_count = 0  # 0 means unlimited
    origin = 0
    skip_count = 0
    strip_trailing = False
    array_name = "MAPFILE"

    i = 0
    while i < len(args):
        arg = args[i]

        if arg == "--":
            if i + 1 < len(args):
                array_name = args[i + 1]
            break

        if arg == "-d" and i + 1 < len(args):
            delimiter = args[i + 1]
            # Handle escape sequences
            if delimiter == "\\n":
                delimiter = "\n"
            elif delimiter == "\\t":
                delimiter = "\t"
            elif delimiter == "":
                delimiter = "\0"  # NUL delimiter
            i += 2
            continue

        if arg.startswith("-d") and len(arg) > 2:
            # Handle -dX where X is the delimiter character (attached)
            delimiter = arg[2:]
            if delimiter == "\\n":
                delimiter = "\n"
            elif delimiter == "\\t":
                delimiter = "\t"
            elif delimiter == "":
                delimiter = "\0"
            i += 1
            continue

        if arg == "-n" and i + 1 < len(args):
            try:
                max_count = int(args[i + 1])
            except ValueError:
                return _result("", f"bash: mapfile: {args[i + 1]}: invalid count\n", 1)
            i += 2
            continue

        if arg == "-O" and i + 1 < len(args):
            try:
                origin = int(args[i + 1])
            except ValueError:
                return _result("", f"bash: mapfile: {args[i + 1]}: invalid origin\n", 1)
            i += 2
            continue

        if arg == "-s" and i + 1 < len(args):
            try:
                skip_count = int(args[i + 1])
            except ValueError:
                return _result("", f"bash: mapfile: {args[i + 1]}: invalid count\n", 1)
            i += 2
            continue

        if arg == "-t":
            strip_trailing = True
            i += 1
            continue

        if arg.startswith("-"):
            # Unknown option - might be combined like -tn
            for c in arg[1:]:
                if c == "t":
                    strip_trailing = True
                elif c == "d":
                    return _result("", "bash: mapfile: -d: option requires an argument\n", 1)
                elif c == "n":
                    return _result("", "bash: mapfile: -n: option requires an argument\n", 1)
                elif c == "O":
                    return _result("", "bash: mapfile: -O: option requires an argument\n", 1)
                elif c == "s":
                    return _result("", "bash: mapfile: -s: option requires an argument\n", 1)
                else:
                    return _result("", f"bash: mapfile: -{c}: invalid option\n", 2)
            i += 1
            continue

        # Not an option - must be array name
        array_name = arg
        i += 1

    # Clear existing array elements
    prefix = f"{array_name}_"
    to_remove = [k for k in ctx.state.env if k.startswith(prefix) and not k.startswith(f"{array_name}__")]
    for k in to_remove:
        del ctx.state.env[k]

    # Mark as array
    ctx.state.env[f"{array_name}__is_array"] = "indexed"

    # Split input by delimiter
    if not stdin:
        return _result("", "", 0)

    # Check if input ends with delimiter (affects whether last element gets delimiter)
    ends_with_delim = stdin.endswith(delimiter)

    if delimiter == "\n":
        lines = stdin.split("\n")
        # Remove last empty element if input ends with newline
        if lines and lines[-1] == "":
            lines = lines[:-1]
    else:
        lines = stdin.split(delimiter)
        # Remove last empty element if input ends with delimiter
        if ends_with_delim and lines and lines[-1] == "":
            lines = lines[:-1]

    # Skip first N lines
    if skip_count > 0:
        lines = lines[skip_count:]

    # Limit to N lines
    if max_count > 0:
        lines = lines[:max_count]

    # Store lines in array
    for idx, line in enumerate(lines):
        if not strip_trailing:
            # Without -t, retain the delimiter on each line
            # (except the last element if input didn't end with delimiter)
            if idx < len(lines) - 1 or ends_with_delim:
                line = line + delimiter

        ctx.state.env[f"{array_name}_{origin + idx}"] = line

    return _result("", "", 0)
