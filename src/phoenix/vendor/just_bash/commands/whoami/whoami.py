"""Whoami command implementation.

Usage: whoami

Print the effective username.
"""

from ...types import CommandContext, ExecResult


class WhoamiCommand:
    """The whoami command."""

    name = "whoami"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the whoami command."""
        return ExecResult(stdout="user\n", stderr="", exit_code=0)
