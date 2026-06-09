"""Help command implementation."""

from ..registry import COMMAND_NAMES
from ...types import CommandContext, ExecResult


class HelpCommand:
    """The help command - display help for commands."""

    name = "help"

    # Command categories
    CATEGORIES = {
        "File operations": ["ls", "cat", "cp", "mv", "rm", "mkdir", "touch", "chmod", "ln", "readlink", "stat", "file"],
        "Text processing": ["grep", "sed", "awk", "cut", "tr", "sort", "uniq", "head", "tail", "wc", "nl", "rev", "tac", "paste"],
        "Search": ["find", "rg"],
        "Data processing": ["jq", "base64", "diff"],
        "Utilities": ["echo", "printf", "date", "sleep", "timeout", "seq", "expr", "xargs", "tee"],
        "Path utilities": ["basename", "dirname", "pwd"],
        "Directory info": ["tree", "du"],
        "Environment": ["env", "printenv", "hostname"],
        "Shell": ["true", "false", "which", "help"],
    }

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the help command."""
        if "--help" in args or "-h" in args:
            return ExecResult(
                stdout="Usage: help [COMMAND]\n\nShow help for commands.\n",
                stderr="",
                exit_code=0,
            )

        # Check for specific command
        for arg in args:
            if not arg.startswith("-"):
                return self._help_for_command(arg)

        # Show general help
        lines = ["Available commands:", ""]

        for category, cmds in self.CATEGORIES.items():
            available = [c for c in cmds if c in COMMAND_NAMES]
            if available:
                lines.append(f"{category}:")
                lines.append(f"  {', '.join(available)}")
                lines.append("")

        lines.append("Use 'COMMAND --help' for more information about a command.")

        return ExecResult(stdout="\n".join(lines) + "\n", stderr="", exit_code=0)

    def _help_for_command(self, cmd: str) -> ExecResult:
        """Show help for a specific command."""
        if cmd not in COMMAND_NAMES:
            return ExecResult(
                stdout="",
                stderr=f"help: no help topics match '{cmd}'.\n",
                exit_code=127,
            )

        # Basic help - suggest using --help
        return ExecResult(
            stdout=f"{cmd}: Use '{cmd} --help' for detailed usage information.\n",
            stderr="",
            exit_code=0,
        )
