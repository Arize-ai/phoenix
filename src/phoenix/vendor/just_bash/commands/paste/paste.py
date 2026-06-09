"""Paste command implementation."""

from ...types import CommandContext, ExecResult


class PasteCommand:
    """The paste command - merge lines of files."""

    name = "paste"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the paste command."""
        delimiter = "\t"
        serial = False
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-d" and i + 1 < len(args):
                i += 1
                delimiter = args[i]
            elif arg.startswith("-d"):
                delimiter = arg[2:]
            elif arg in ("-s", "--serial"):
                serial = True
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: paste [OPTION]... [FILE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                return ExecResult(
                    stdout="",
                    stderr=f"paste: unrecognized option '{arg}'\n",
                    exit_code=1,
                )
            elif arg.startswith("-") and len(arg) > 1 and arg != "-":
                return ExecResult(
                    stdout="",
                    stderr=f"paste: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        if not files:
            return ExecResult(
                stdout="",
                stderr="paste: missing operand\n",
                exit_code=1,
            )

        # Read all files
        file_contents: list[list[str]] = []
        for f in files:
            try:
                if f == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, f)
                    content = await ctx.fs.read_file(path)
                file_contents.append(content.splitlines())
            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"paste: {f}: No such file or directory\n",
                    exit_code=1,
                )

        if serial:
            # Serial mode: paste all lines of each file into one line
            output_lines = []
            for lines in file_contents:
                output_lines.append(delimiter.join(lines))
            output = "\n".join(output_lines) + "\n"
        else:
            # Normal mode: paste corresponding lines
            max_lines = max(len(lines) for lines in file_contents) if file_contents else 0
            output_lines = []

            for line_idx in range(max_lines):
                parts = []
                for file_idx, lines in enumerate(file_contents):
                    if line_idx < len(lines):
                        parts.append(lines[line_idx])
                    else:
                        parts.append("")
                output_lines.append(delimiter.join(parts))

            output = "\n".join(output_lines)
            if output:
                output += "\n"

        return ExecResult(stdout=output, stderr="", exit_code=0)
