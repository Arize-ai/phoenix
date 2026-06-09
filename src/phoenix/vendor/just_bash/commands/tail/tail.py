"""Tail command implementation.

Usage: tail [OPTION]... [FILE]...

Print the last 10 lines of each FILE to standard output.
With more than one FILE, precede each with a header giving the file name.
With no FILE, or when FILE is -, read standard input.

Options:
  -n, --lines=NUM      output the last NUM lines, instead of the last 10
  -c, --bytes=NUM      output the last NUM bytes
  -q, --quiet          never output headers giving file names
  -v, --verbose        always output headers giving file names
"""

from ...types import CommandContext, ExecResult


class TailCommand:
    """The tail command."""

    name = "tail"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the tail command."""
        num_lines = 10
        num_bytes = None
        quiet = False
        verbose = False
        from_start = False  # +NUM means from line NUM
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--lines="):
                val = arg[8:]
                if val.startswith("+"):
                    from_start = True
                    val = val[1:]
                try:
                    num_lines = int(val)
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"tail: invalid number of lines: '{arg[8:]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("--bytes="):
                try:
                    num_bytes = int(arg[8:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"tail: invalid number of bytes: '{arg[8:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--quiet" or arg == "-q":
                quiet = True
            elif arg == "--verbose" or arg == "-v":
                verbose = True
            elif arg.startswith("-n"):
                if len(arg) > 2:
                    val = arg[2:]
                else:
                    i += 1
                    if i >= len(args):
                        return ExecResult(
                            stdout="",
                            stderr="tail: option requires an argument -- 'n'\n",
                            exit_code=1,
                        )
                    val = args[i]
                if val.startswith("+"):
                    from_start = True
                    val = val[1:]
                try:
                    num_lines = int(val)
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"tail: invalid number of lines: '{val}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-c"):
                if len(arg) > 2:
                    val = arg[2:]
                else:
                    i += 1
                    if i >= len(args):
                        return ExecResult(
                            stdout="",
                            stderr="tail: option requires an argument -- 'c'\n",
                            exit_code=1,
                        )
                    val = args[i]
                try:
                    num_bytes = int(val)
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"tail: invalid number of bytes: '{val}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("+") and len(arg) > 1:
                # +NUM means from line NUM
                try:
                    num_lines = int(arg[1:])
                    from_start = True
                except ValueError:
                    files.append(arg)
            elif arg.startswith("-") and len(arg) > 1:
                # Check for -NUM shorthand
                try:
                    num_lines = int(arg[1:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"tail: invalid option -- '{arg[1]}'\n",
                        exit_code=1,
                    )
            else:
                files.append(arg)
            i += 1

        # Default to stdin
        if not files:
            files = ["-"]

        stdout = ""
        stderr = ""
        exit_code = 0
        show_headers = (len(files) > 1 and not quiet) or verbose

        for file_idx, file in enumerate(files):
            try:
                if file == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file(path)

                if show_headers:
                    if file_idx > 0:
                        stdout += "\n"
                    stdout += f"==> {file} <==\n"

                if num_bytes is not None:
                    if from_start:
                        stdout += content[num_bytes - 1:]
                    else:
                        stdout += content[-num_bytes:] if num_bytes > 0 else ""
                else:
                    lines = content.split("\n")
                    # Handle the case where content ends with newline
                    if lines and lines[-1] == "":
                        lines = lines[:-1]

                    if from_start:
                        # +NUM means starting from line NUM (1-indexed)
                        selected = lines[num_lines - 1:]
                    else:
                        selected = lines[-num_lines:] if num_lines > 0 else []

                    stdout += "\n".join(selected)
                    if selected:
                        stdout += "\n"

            except FileNotFoundError:
                stderr += f"tail: cannot open '{file}' for reading: No such file or directory\n"
                exit_code = 1
            except IsADirectoryError:
                stderr += f"tail: error reading '{file}': Is a directory\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
