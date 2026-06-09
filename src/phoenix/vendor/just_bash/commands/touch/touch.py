"""Touch command implementation.

Usage: touch [OPTION]... FILE...

Update the access and modification times of each FILE to the current time.
A FILE argument that does not exist is created empty.

Options:
  -c, --no-create  do not create any files
  -d, --date=DATE  parse DATE and use it instead of current time
"""

import time
import re
from ...types import CommandContext, ExecResult


def parse_date(date_str: str) -> float | None:
    """Parse a date string and return timestamp.

    Supports:
    - YYYY-MM-DD
    - YYYY/MM/DD
    - YYYY-MM-DD HH:MM:SS
    - ISO 8601 variations
    """
    date_str = date_str.strip().strip("'\"")

    # Try various date formats
    patterns = [
        # YYYY-MM-DD HH:MM:SS
        (r"^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$",
         lambda m: (int(m[1]), int(m[2]), int(m[3]), int(m[4]), int(m[5]), int(m[6]))),
        # YYYY-MM-DD
        (r"^(\d{4})-(\d{2})-(\d{2})$",
         lambda m: (int(m[1]), int(m[2]), int(m[3]), 0, 0, 0)),
        # YYYY/MM/DD
        (r"^(\d{4})/(\d{2})/(\d{2})$",
         lambda m: (int(m[1]), int(m[2]), int(m[3]), 0, 0, 0)),
        # YYYY/MM/DD HH:MM:SS
        (r"^(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$",
         lambda m: (int(m[1]), int(m[2]), int(m[3]), int(m[4]), int(m[5]), int(m[6]))),
    ]

    for pattern, extractor in patterns:
        match = re.match(pattern, date_str)
        if match:
            year, month, day, hour, minute, second = extractor(match)
            try:
                import calendar
                # Create a struct_time and convert to timestamp
                t = (year, month, day, hour, minute, second, 0, 0, -1)
                return calendar.timegm(t)
            except (ValueError, OverflowError):
                return None

    return None


class TouchCommand:
    """The touch command."""

    name = "touch"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the touch command."""
        no_create = False
        date_time: float | None = None
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--no-create":
                    no_create = True
                elif arg.startswith("--date="):
                    date_str = arg[7:]
                    date_time = parse_date(date_str)
                    if date_time is None:
                        return ExecResult(
                            stdout="",
                            stderr=f"touch: invalid date '{date_str}'\n",
                            exit_code=1,
                        )
                elif arg == "--date":
                    # Next arg is the date
                    if i + 1 >= len(args):
                        return ExecResult(
                            stdout="",
                            stderr="touch: option '--date' requires an argument\n",
                            exit_code=1,
                        )
                    i += 1
                    date_str = args[i]
                    date_time = parse_date(date_str)
                    if date_time is None:
                        return ExecResult(
                            stdout="",
                            stderr=f"touch: invalid date '{date_str}'\n",
                            exit_code=1,
                        )
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"touch: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "c":
                        no_create = True
                    elif c == "d":
                        # -d DATE: next part or next arg is the date
                        if j + 1 < len(arg):
                            # Date is rest of this arg
                            date_str = arg[j + 1:]
                            date_time = parse_date(date_str)
                            if date_time is None:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"touch: invalid date '{date_str}'\n",
                                    exit_code=1,
                                )
                            break
                        elif i + 1 < len(args):
                            # Date is next arg
                            i += 1
                            date_str = args[i]
                            date_time = parse_date(date_str)
                            if date_time is None:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"touch: invalid date '{date_str}'\n",
                                    exit_code=1,
                                )
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="touch: option requires an argument -- 'd'\n",
                                exit_code=1,
                            )
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"touch: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            else:
                files.append(arg)
            i += 1

        if not files:
            return ExecResult(
                stdout="",
                stderr="touch: missing file operand\n",
                exit_code=1,
            )

        stderr = ""
        exit_code = 0

        # Use current time if no date specified
        if date_time is None:
            date_time = time.time()

        for f in files:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, f)
                # Check if file exists
                try:
                    stat = await ctx.fs.stat(path)
                    if stat.is_directory:
                        # Update directory timestamp if possible
                        await ctx.fs.utimes(path, date_time, date_time)
                        continue
                    # File exists - use utimes to update timestamp
                    await ctx.fs.utimes(path, date_time, date_time)
                except FileNotFoundError:
                    # File doesn't exist
                    if no_create:
                        continue
                    # Create empty file and set its time
                    await ctx.fs.write_file(path, "")
                    await ctx.fs.utimes(path, date_time, date_time)
            except FileNotFoundError:
                stderr += f"touch: cannot touch '{f}': No such file or directory\n"
                exit_code = 1
            except IsADirectoryError:
                # Touching a directory is fine
                pass

        return ExecResult(stdout="", stderr=stderr, exit_code=exit_code)
