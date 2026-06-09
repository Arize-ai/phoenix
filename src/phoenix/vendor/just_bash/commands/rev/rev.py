"""Rev command implementation."""

from ...types import CommandContext, ExecResult


class RevCommand:
    """The rev command - reverse characters in lines."""

    name = "rev"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the rev command."""
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: rev [OPTION]... [FILE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                return ExecResult(
                    stdout="",
                    stderr=f"rev: unrecognized option '{arg}'\n",
                    exit_code=1,
                )
            elif arg.startswith("-") and len(arg) > 1 and arg != "-":
                return ExecResult(
                    stdout="",
                    stderr=f"rev: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        # Read content
        if files:
            content_parts = []
            for f in files:
                if f == "-":
                    content_parts.append(ctx.stdin)
                else:
                    try:
                        path = ctx.fs.resolve_path(ctx.cwd, f)
                        content_parts.append(await ctx.fs.read_file(path))
                    except FileNotFoundError:
                        return ExecResult(
                            stdout="",
                            stderr=f"rev: {f}: No such file or directory\n",
                            exit_code=1,
                        )
            content = "".join(content_parts)
        else:
            content = ctx.stdin

        if not content:
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Reverse each line
        lines = content.splitlines()
        reversed_lines = [line[::-1] for line in lines]

        output = "\n".join(reversed_lines)
        if content.endswith("\n"):
            output += "\n"

        return ExecResult(stdout=output, stderr="", exit_code=0)
