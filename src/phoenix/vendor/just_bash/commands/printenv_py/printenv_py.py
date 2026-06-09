"""printenv.py test helper command.

Usage: printenv.py [VARIABLE]...

Print environment variables visible to subprocesses.
Outputs 'None' for variables that are not exported or not set.
Used for testing export/unexport behavior.
"""

from ...types import CommandContext, ExecResult


class PrintenvPyCommand:
    """The printenv.py test helper command for testing environment visibility."""

    name = "printenv.py"

    def _is_exported(self, ctx: CommandContext, name: str) -> bool:
        """Check if a variable is exported (visible to subprocesses)."""
        from ...interpreter.types import VariableStore
        if isinstance(ctx.env, VariableStore):
            return "x" in ctx.env.get_attributes(name)
        # If not a VariableStore, assume all variables are exported
        return True

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the printenv.py command."""
        if not args:
            return ExecResult(stdout="", stderr="", exit_code=0)

        output_lines = []
        for name in args:
            if name in ctx.env and self._is_exported(ctx, name):
                output_lines.append(ctx.env[name])
            else:
                output_lines.append("None")

        return ExecResult(
            stdout="\n".join(output_lines) + "\n" if output_lines else "",
            stderr="",
            exit_code=0,
        )
