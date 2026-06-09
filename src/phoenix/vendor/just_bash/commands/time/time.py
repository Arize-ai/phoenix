"""Time command implementation.

Usage: time [-p] [COMMAND [ARGS]...]

Run COMMAND and print timing statistics.

Options:
  -p    Use POSIX output format
"""

import time as time_module
from ...types import CommandContext, ExecResult


class TimeCommand:
    """The time command."""

    name = "time"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the time command."""
        posix_format = False
        command_args: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-p" and not command_args:
                posix_format = True
            elif arg == "--":
                command_args.extend(args[i + 1:])
                break
            else:
                command_args.extend(args[i:])
                break
            i += 1

        # If no command, just show timing for empty command
        if not command_args:
            if posix_format:
                timing = "real 0.00\nuser 0.00\nsys 0.00\n"
            else:
                timing = "\nreal\t0m0.000s\nuser\t0m0.000s\nsys\t0m0.000s\n"
            return ExecResult(stdout="", stderr=timing, exit_code=0)

        # Execute the command and measure time
        if ctx.exec is None:
            return ExecResult(
                stdout="",
                stderr="time: cannot execute subcommand\n",
                exit_code=1,
            )

        # Build command string
        command_str = " ".join(command_args)

        start_time = time_module.time()
        result = await ctx.exec(command_str, {"cwd": ctx.cwd})
        elapsed = time_module.time() - start_time

        # Format timing output
        if posix_format:
            timing = f"real {elapsed:.2f}\nuser 0.00\nsys 0.00\n"
        else:
            minutes = int(elapsed // 60)
            seconds = elapsed % 60
            timing = f"\nreal\t{minutes}m{seconds:.3f}s\nuser\t0m0.000s\nsys\t0m0.000s\n"

        return ExecResult(
            stdout=result.stdout,
            stderr=result.stderr + timing,
            exit_code=result.exit_code,
        )
