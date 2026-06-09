"""Test helper commands for spec tests.

These replace the Python scripts used in the original Oils shell tests.
"""

from just_bash.types import CommandContext, ExecResult


class ArgvCommand:
    """argv.py - prints arguments in Python repr() format: ['arg1', "arg with '"]

    Python uses single quotes by default, double quotes when string contains single quotes.
    """

    name = "argv.py"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        formatted = []
        for arg in args:
            # Encode to UTF-8 bytes and escape non-ASCII, matching Oils argv.py
            encoded = arg.encode("utf-8")
            parts = []
            for byte in encoded:
                if byte >= 0x80:
                    parts.append(f"\\x{byte:02x}")
                elif byte == ord("'"):
                    parts.append("\\'")
                elif byte == ord("\\"):
                    parts.append("\\\\")
                elif 0x20 <= byte < 0x7F:
                    parts.append(chr(byte))
                elif byte == ord("\n"):
                    parts.append("\\n")
                elif byte == ord("\t"):
                    parts.append("\\t")
                elif byte == ord("\r"):
                    parts.append("\\r")
                else:
                    parts.append(f"\\x{byte:02x}")
            formatted.append("'" + "".join(parts) + "'")

        return ExecResult(
            stdout=f"[{', '.join(formatted)}]\n",
            stderr="",
            exit_code=0,
        )


class PrintenvCommand:
    """printenv.py - prints environment variable values, one per line.

    Prints "None" for variables that are not set or not exported
    (matching Python's printenv.py behavior in subprocess context).
    """

    name = "printenv.py"

    def _is_exported(self, ctx: CommandContext, name: str) -> bool:
        """Check if a variable is exported (visible to subprocesses)."""
        from just_bash.interpreter.types import VariableStore
        if isinstance(ctx.env, VariableStore):
            return "x" in ctx.env.get_attributes(name)
        # If not a VariableStore, assume all variables are exported
        return True

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        values = []
        for name in args:
            if name in ctx.env and self._is_exported(ctx, name):
                values.append(ctx.env[name])
            else:
                values.append("None")
        output = "\n".join(values)
        return ExecResult(
            stdout=f"{output}\n" if output else "",
            stderr="",
            exit_code=0,
        )


class StdoutStderrCommand:
    """stdout_stderr.py - outputs to both stdout and stderr."""

    name = "stdout_stderr.py"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        return ExecResult(
            stdout="STDOUT\n",
            stderr="STDERR\n",
            exit_code=0,
        )


class ReadFromFdCommand:
    """read_from_fd.py - reads from a file descriptor (simplified - reads from stdin)."""

    name = "read_from_fd.py"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        # In real bash, this reads from a specific FD. Here we just return stdin or empty.
        fd = args[0] if args else "0"
        if fd == "0" and ctx.stdin:
            return ExecResult(stdout=ctx.stdin, stderr="", exit_code=0)
        return ExecResult(stdout="", stderr="", exit_code=0)


# All test helper commands
TEST_HELPER_COMMANDS = [
    ArgvCommand(),
    PrintenvCommand(),
    StdoutStderrCommand(),
    ReadFromFdCommand(),
]


def get_test_helper_commands() -> list:
    """Get all test helper commands for registration."""
    return TEST_HELPER_COMMANDS.copy()
