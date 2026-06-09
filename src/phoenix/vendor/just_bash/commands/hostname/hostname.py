"""Hostname command implementation."""

from ...types import CommandContext, ExecResult


class HostnameCommand:
    """The hostname command."""

    name = "hostname"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the hostname command."""
        if "--help" in args:
            return ExecResult(
                stdout="Usage: hostname [OPTION]...\n",
                stderr="",
                exit_code=0,
            )

        # Return localhost in sandboxed environment
        return ExecResult(stdout="localhost\n", stderr="", exit_code=0)
