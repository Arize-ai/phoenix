"""Shell utility command implementations (clear, alias, unalias, history)."""

from ...types import CommandContext, ExecResult


class ClearCommand:
    """The clear command - clear the terminal screen."""

    name = "clear"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the clear command."""
        if "--help" in args or "-h" in args:
            return ExecResult(
                stdout="Usage: clear\nClear the terminal screen.\n",
                stderr="",
                exit_code=0,
            )

        # Output ANSI escape sequence to clear screen
        # ESC[2J clears the screen, ESC[H moves cursor to home
        return ExecResult(stdout="\033[2J\033[H", stderr="", exit_code=0)


class AliasCommand:
    """The alias command - define or display aliases."""

    name = "alias"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the alias command."""
        if "--help" in args:
            return ExecResult(
                stdout="Usage: alias [name[=value] ...]\nDefine or display aliases.\n",
                stderr="",
                exit_code=0,
            )

        # Get existing aliases from environment (stored as BASH_ALIAS_name)
        aliases = {}
        for key, value in ctx.env.items():
            if key.startswith("BASH_ALIAS_"):
                alias_name = key[11:]  # Remove prefix
                aliases[alias_name] = value

        if not args:
            # Display all aliases
            if not aliases:
                return ExecResult(stdout="", stderr="", exit_code=0)

            lines = []
            for name, value in sorted(aliases.items()):
                lines.append(f"alias {name}='{value}'")
            return ExecResult(stdout="\n".join(lines) + "\n", stderr="", exit_code=0)

        stdout_parts = []
        stderr = ""
        exit_code = 0

        for arg in args:
            if "=" in arg:
                # Define alias: alias name=value
                name, value = arg.split("=", 1)
                # Remove surrounding quotes if present
                if (value.startswith("'") and value.endswith("'")) or \
                   (value.startswith('"') and value.endswith('"')):
                    value = value[1:-1]
                ctx.env[f"BASH_ALIAS_{name}"] = value
            else:
                # Display specific alias
                if arg in aliases:
                    stdout_parts.append(f"alias {arg}='{aliases[arg]}'")
                else:
                    stderr += f"alias: {arg}: not found\n"
                    exit_code = 1

        stdout = "\n".join(stdout_parts)
        if stdout:
            stdout += "\n"
        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)


class UnaliasCommand:
    """The unalias command - remove aliases."""

    name = "unalias"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the unalias command."""
        if "--help" in args:
            return ExecResult(
                stdout="Usage: unalias [-a] name [name ...]\nRemove aliases.\n",
                stderr="",
                exit_code=0,
            )

        remove_all = False
        names: list[str] = []

        for arg in args:
            if arg == "-a":
                remove_all = True
            elif arg.startswith("-"):
                return ExecResult(
                    stdout="",
                    stderr=f"unalias: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                names.append(arg)

        if remove_all:
            # Remove all aliases
            to_remove = [k for k in ctx.env if k.startswith("BASH_ALIAS_")]
            for key in to_remove:
                del ctx.env[key]
            return ExecResult(stdout="", stderr="", exit_code=0)

        if not names:
            return ExecResult(
                stdout="",
                stderr="unalias: usage: unalias [-a] name [name ...]\n",
                exit_code=1,
            )

        stderr = ""
        exit_code = 0

        for name in names:
            key = f"BASH_ALIAS_{name}"
            if key in ctx.env:
                del ctx.env[key]
            else:
                stderr += f"unalias: {name}: not found\n"
                exit_code = 1

        return ExecResult(stdout="", stderr=stderr, exit_code=exit_code)


class HistoryCommand:
    """The history command - display command history."""

    name = "history"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the history command."""
        import json

        if "--help" in args:
            return ExecResult(
                stdout="Usage: history [-c] [n]\nDisplay or clear command history.\n",
                stderr="",
                exit_code=0,
            )

        # Handle -c flag to clear history
        if "-c" in args:
            ctx.env["BASH_HISTORY"] = "[]"
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Parse numeric argument for limiting output
        limit = None
        for arg in args:
            if arg.isdigit():
                limit = int(arg)
                break

        # No history available
        if "BASH_HISTORY" not in ctx.env:
            return ExecResult(stdout="", stderr="", exit_code=0)

        history_value = ctx.env["BASH_HISTORY"]

        # Try to parse as JSON array first
        try:
            history = json.loads(history_value)
            if not isinstance(history, list):
                # Fallback to newline-separated
                history = [cmd for cmd in history_value.split("\n") if cmd]
        except json.JSONDecodeError:
            # Fallback to newline-separated format for backward compatibility
            history = [cmd for cmd in history_value.split("\n") if cmd]

        if not history:
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Apply limit if specified
        total = len(history)
        if limit is not None:
            if limit == 0:
                return ExecResult(stdout="", stderr="", exit_code=0)
            # Show last N entries with their original line numbers
            start_idx = max(0, total - limit)
        else:
            start_idx = 0

        # Format output with 5-character right-justified line numbers
        lines = []
        for i, cmd in enumerate(history[start_idx:], start_idx + 1):
            lines.append(f"{str(i).rjust(5)}  {cmd}")

        return ExecResult(
            stdout="\n".join(lines) + "\n" if lines else "",
            stderr="",
            exit_code=0,
        )
