"""Xargs command implementation."""

from ...types import CommandContext, ExecResult


class XargsCommand:
    """The xargs command."""

    name = "xargs"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the xargs command."""
        batch_size = None
        replace_str = None
        delimiter = None
        null_sep = False
        no_run_empty = False
        verbose = False
        command: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-n" and i + 1 < len(args):
                i += 1
                batch_size = int(args[i])
            elif arg == "-I" and i + 1 < len(args):
                i += 1
                replace_str = args[i]
            elif arg == "-d" and i + 1 < len(args):
                i += 1
                delimiter = args[i]
            elif arg == "-0":
                null_sep = True
            elif arg == "-r" or arg == "--no-run-if-empty":
                no_run_empty = True
            elif arg == "-t":
                verbose = True
            elif arg == "-P":
                # Parallel - skip the value, we don't really parallelize
                i += 1
            elif arg.startswith("-"):
                pass  # Ignore unknown options
            else:
                command = args[i:]
                break
            i += 1

        # Default command is echo
        if not command:
            command = ["echo"]

        # Parse input
        content = ctx.stdin
        if null_sep:
            items = [item for item in content.split("\0") if item]
        elif delimiter:
            if delimiter == "\\n":
                delimiter = "\n"
            elif delimiter == "\\t":
                delimiter = "\t"
            items = [item for item in content.split(delimiter) if item]
        else:
            # Default: split on whitespace and newlines
            items = content.split()

        # Handle empty input
        if not items:
            if no_run_empty:
                return ExecResult(stdout="", stderr="", exit_code=0)
            items = [""]

        # Execute commands
        stdout_parts = []
        stderr_parts = []
        exit_code = 0

        if replace_str:
            # Run command once per item with replacement
            for item in items:
                cmd = [c.replace(replace_str, item) for c in command]
                result = await self._run_command(cmd, ctx, verbose)
                stdout_parts.append(result.stdout)
                stderr_parts.append(result.stderr)
                if result.exit_code != 0:
                    exit_code = result.exit_code
        elif batch_size:
            # Run command in batches
            for j in range(0, len(items), batch_size):
                batch = items[j:j + batch_size]
                cmd = command + batch
                result = await self._run_command(cmd, ctx, verbose)
                stdout_parts.append(result.stdout)
                stderr_parts.append(result.stderr)
                if result.exit_code != 0:
                    exit_code = result.exit_code
        else:
            # Run command once with all items
            cmd = command + items
            result = await self._run_command(cmd, ctx, verbose)
            stdout_parts.append(result.stdout)
            stderr_parts.append(result.stderr)
            exit_code = result.exit_code

        return ExecResult(
            stdout="".join(stdout_parts),
            stderr="".join(stderr_parts),
            exit_code=exit_code,
        )

    async def _run_command(
        self, cmd: list[str], ctx: CommandContext, verbose: bool
    ) -> ExecResult:
        """Run a command."""
        if verbose:
            pass  # Would print command to stderr

        # Quote arguments properly for shell execution
        def quote(s: str) -> str:
            if not s or any(c in s for c in " \t\n'\"\\$`!"):
                # Use single quotes and escape any single quotes
                return "'" + s.replace("'", "'\"'\"'") + "'"
            return s

        cmd_str = " ".join(quote(c) for c in cmd)

        # Execute using ctx.exec
        if ctx.exec:
            return await ctx.exec(cmd_str, {"cwd": ctx.cwd})
        else:
            # Fallback if exec not available
            return ExecResult(
                stdout="",
                stderr="xargs: cannot execute commands\n",
                exit_code=126,
            )
