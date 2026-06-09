"""Pwd command implementation.

Usage: pwd [-LP]

Print the name of the current working directory.

Options:
  -L    Print the value of $PWD if it names the current working directory
  -P    Print the physical directory, without any symbolic links
"""

from ...types import CommandContext, ExecResult


class PwdCommand:
    """The pwd command."""

    name = "pwd"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the pwd command."""
        physical = False

        # Parse arguments
        for arg in args:
            if arg == "-P":
                physical = True
            elif arg == "-L":
                physical = False
            elif arg.startswith("-"):
                # Check for combined flags like -LP or -PL
                for c in arg[1:]:
                    if c == "P":
                        physical = True
                    elif c == "L":
                        physical = False
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"pwd: invalid option -- '{c}'\n",
                            exit_code=1,
                        )

        if physical:
            # Resolve symlinks in cwd
            try:
                resolved = await ctx.fs.realpath(ctx.cwd)
                return ExecResult(stdout=f"{resolved}\n", stderr="", exit_code=0)
            except (FileNotFoundError, OSError):
                return ExecResult(stdout=f"{ctx.cwd}\n", stderr="", exit_code=0)
        else:
            # Return logical path (cwd as-is)
            return ExecResult(stdout=f"{ctx.cwd}\n", stderr="", exit_code=0)
