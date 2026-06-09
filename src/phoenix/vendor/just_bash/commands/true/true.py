"""True and false command implementations.

Usage: true
       false

true - do nothing, successfully
false - do nothing, unsuccessfully

Exit with a status code indicating success (true) or failure (false).
"""

from ...types import Command, CommandContext, ExecResult


class TrueCommand:
    """The true command - always succeeds."""

    name = "true"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the true command."""
        return ExecResult(stdout="", stderr="", exit_code=0)


class FalseCommand:
    """The false command - always fails."""

    name = "false"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the false command."""
        return ExecResult(stdout="", stderr="", exit_code=1)
