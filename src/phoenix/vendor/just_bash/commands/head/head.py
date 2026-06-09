"""Head command implementation.

Usage: head [OPTION]... [FILE]...

Print the first 10 lines of each FILE to standard output.
With more than one FILE, precede each with a header giving the file name.
With no FILE, or when FILE is -, read standard input.

Options:
  -n, --lines=NUM      print the first NUM lines instead of the first 10
  -c, --bytes=NUM      print the first NUM bytes
  -q, --quiet          never print headers giving file names
  -v, --verbose        always print headers giving file names
"""

from ...types import CommandContext, ExecResult


class HeadCommand:
    """The head command."""

    name = "head"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the head command."""
        num_lines = 10
        num_bytes = None
        quiet = False
        verbose = False
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--lines="):
                try:
                    num_lines = int(arg[8:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"head: invalid number of lines: '{arg[8:]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("--bytes="):
                try:
                    num_bytes = int(arg[8:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"head: invalid number of bytes: '{arg[8:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--quiet" or arg == "-q":
                quiet = True
            elif arg == "--verbose" or arg == "-v":
                verbose = True
            elif arg.startswith("-n"):
                if len(arg) > 2:
                    try:
                        num_lines = int(arg[2:])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"head: invalid number of lines: '{arg[2:]}'\n",
                            exit_code=1,
                        )
                else:
                    i += 1
                    if i >= len(args):
                        return ExecResult(
                            stdout="",
                            stderr="head: option requires an argument -- 'n'\n",
                            exit_code=1,
                        )
                    try:
                        num_lines = int(args[i])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"head: invalid number of lines: '{args[i]}'\n",
                            exit_code=1,
                        )
            elif arg.startswith("-c"):
                if len(arg) > 2:
                    try:
                        num_bytes = int(arg[2:])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"head: invalid number of bytes: '{arg[2:]}'\n",
                            exit_code=1,
                        )
                else:
                    i += 1
                    if i >= len(args):
                        return ExecResult(
                            stdout="",
                            stderr="head: option requires an argument -- 'c'\n",
                            exit_code=1,
                        )
                    try:
                        num_bytes = int(args[i])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"head: invalid number of bytes: '{args[i]}'\n",
                            exit_code=1,
                        )
            elif arg.startswith("-") and len(arg) > 1:
                # Check for -NUM shorthand
                try:
                    num_lines = int(arg[1:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"head: invalid option -- '{arg[1]}'\n",
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
                    stdout += content[:num_bytes]
                else:
                    lines = content.split("\n")
                    # Handle the case where content ends with newline
                    if lines and lines[-1] == "":
                        lines = lines[:-1]
                    stdout += "\n".join(lines[:num_lines])
                    if lines[:num_lines]:
                        stdout += "\n"

            except FileNotFoundError:
                stderr += f"head: cannot open '{file}' for reading: No such file or directory\n"
                exit_code = 1
            except IsADirectoryError:
                stderr += f"head: error reading '{file}': Is a directory\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
