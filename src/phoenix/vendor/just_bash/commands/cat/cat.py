"""Cat command implementation.

Usage: cat [OPTION]... [FILE]...

Concatenate FILE(s) to standard output.
With no FILE, or when FILE is -, read standard input.

Options:
  -n, --number             number all output lines
  -b, --number-nonblank    number nonempty output lines
  -s, --squeeze-blank      suppress repeated empty output lines
  -E, --show-ends          display $ at end of each line
  -T, --show-tabs          display TAB characters as ^I
  -v, --show-nonprinting   use ^ and M- notation, except for LFD and TAB
  -A, --show-all           equivalent to -vET
  -e                       equivalent to -vE
  -t                       equivalent to -vT
"""

from ...types import Command, CommandContext, ExecResult


class CatCommand:
    """The cat command."""

    name = "cat"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the cat command."""
        # Options
        number_lines = False
        number_nonblank = False
        squeeze_blank = False
        show_ends = False
        show_tabs = False
        show_nonprinting = False

        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1 :])
                break
            elif arg.startswith("--"):
                if arg == "--number":
                    number_lines = True
                elif arg == "--number-nonblank":
                    number_nonblank = True
                elif arg == "--squeeze-blank":
                    squeeze_blank = True
                elif arg == "--show-ends":
                    show_ends = True
                elif arg == "--show-tabs":
                    show_tabs = True
                elif arg == "--show-nonprinting":
                    show_nonprinting = True
                elif arg == "--show-all":
                    show_nonprinting = True
                    show_ends = True
                    show_tabs = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"cat: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                for c in arg[1:]:
                    if c == "n":
                        number_lines = True
                    elif c == "b":
                        number_nonblank = True
                    elif c == "s":
                        squeeze_blank = True
                    elif c == "E":
                        show_ends = True
                    elif c == "T":
                        show_tabs = True
                    elif c == "v":
                        show_nonprinting = True
                    elif c == "A":
                        show_nonprinting = True
                        show_ends = True
                        show_tabs = True
                    elif c == "e":
                        show_nonprinting = True
                        show_ends = True
                    elif c == "t":
                        show_nonprinting = True
                        show_tabs = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"cat: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            else:
                files.append(arg)
            i += 1

        # If number_nonblank is set, don't number all lines
        if number_nonblank:
            number_lines = False

        # If no files, read from stdin
        if not files:
            files = ["-"]

        stdout = ""
        stderr = ""
        exit_code = 0
        line_number = 1
        prev_blank = False

        for file in files:
            try:
                if file == "-" or file == "/dev/stdin":
                    content = ctx.stdin
                elif file == "/dev/stdout":
                    content = ""
                elif file == "/dev/stderr":
                    content = ""
                else:
                    # Resolve path
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file(path)

                lines = content.split("\n")

                # Process each line
                for j, line in enumerate(lines):
                    # Don't output trailing empty string from split
                    if j == len(lines) - 1 and line == "":
                        break

                    is_blank = line == ""

                    # Squeeze blank lines
                    if squeeze_blank and is_blank and prev_blank:
                        continue
                    prev_blank = is_blank

                    # Process line
                    output_line = line

                    # Show tabs
                    if show_tabs:
                        output_line = output_line.replace("\t", "^I")

                    # Show nonprinting (simplified - just shows tab replacement already done)
                    # Full implementation would handle all non-printable chars

                    # Show ends
                    if show_ends:
                        output_line += "$"

                    # Number lines
                    if number_lines or (number_nonblank and not is_blank):
                        output_line = f"{line_number:6}\t{output_line}"
                        line_number += 1

                    stdout += output_line + "\n"

            except FileNotFoundError:
                stderr += f"cat: {file}: No such file or directory\n"
                exit_code = 1
            except IsADirectoryError:
                stderr += f"cat: {file}: Is a directory\n"
                exit_code = 1
            except PermissionError:
                stderr += f"cat: {file}: Permission denied\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
