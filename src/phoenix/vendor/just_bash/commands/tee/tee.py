"""Tee command implementation."""

from ...types import CommandContext, ExecResult


class TeeCommand:
    """The tee command."""

    name = "tee"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the tee command."""
        append = False
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg in ("-a", "--append"):
                append = True
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: tee [OPTION]... [FILE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"tee: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        # Read stdin
        content = ctx.stdin

        # Write to files
        stderr = ""
        exit_code = 0

        for f in files:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, f)
                if append:
                    try:
                        existing = await ctx.fs.read_file(path)
                        await ctx.fs.write_file(path, existing + content)
                    except FileNotFoundError:
                        await ctx.fs.write_file(path, content)
                else:
                    await ctx.fs.write_file(path, content)
            except Exception as e:
                stderr += f"tee: {f}: {e}\n"
                exit_code = 1

        # Output to stdout
        return ExecResult(stdout=content, stderr=stderr, exit_code=exit_code)
