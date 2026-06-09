"""Argv command implementation.

Usage: argv.py [arg ...]

Print arguments as a Python-style list.
Used for testing word splitting and expansion.
"""

from ...types import CommandContext, ExecResult


class ArgvCommand:
    """The argv.py command for testing argument handling."""

    name = "argv.py"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the argv.py command."""
        # Format as Python list, escaping non-ASCII bytes like the Oils argv.py
        formatted_args = []
        for arg in args:
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
            formatted_args.append("'" + "".join(parts) + "'")
        output = "[" + ", ".join(formatted_args) + "]\n"
        return ExecResult(stdout=output, stderr="", exit_code=0)
