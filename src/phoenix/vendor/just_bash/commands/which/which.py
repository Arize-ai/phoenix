"""Which command implementation."""

import stat

from ..registry import COMMAND_NAMES
from ...types import CommandContext, ExecResult


class WhichCommand:
    """The which command - locate a command."""

    name = "which"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the which command."""
        silent = False
        show_all = False
        commands: list[str] = []

        for arg in args:
            if arg in ("-s", "--silent"):
                silent = True
            elif arg in ("-a", "--all"):
                show_all = True
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: which [OPTION]... COMMAND...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg.startswith("-"):
                pass  # Ignore unknown options
            else:
                commands.append(arg)

        if not commands:
            return ExecResult(stdout="", stderr="", exit_code=1)

        output_lines: list[str] = []
        exit_code = 0

        for cmd in commands:
            found = False

            # Search PATH directories in VFS
            path_str = ctx.env.get("PATH", "")
            if path_str:
                for dir_entry in path_str.split(":"):
                    if not dir_entry:
                        dir_entry = "."
                    candidate = f"{dir_entry}/{cmd}"
                    resolved = ctx.fs.resolve_path(ctx.cwd, candidate)
                    try:
                        if await ctx.fs.exists(resolved):
                            if not await ctx.fs.is_directory(resolved):
                                st = await ctx.fs.stat(resolved)
                                if st.mode & stat.S_IXUSR:
                                    found = True
                                    if not silent:
                                        output_lines.append(candidate)
                                    if not show_all:
                                        break
                    except Exception:
                        pass

            # Fallback: check command registry (for built-in commands)
            if not found and cmd in COMMAND_NAMES:
                found = True
                if not silent:
                    # Use first PATH entry that exists, or default
                    path_dirs = path_str.split(":") if path_str else []
                    prefix = path_dirs[0] if path_dirs else "/usr/bin"
                    output_lines.append(f"{prefix}/{cmd}")

            if not found:
                exit_code = 1

        output = "\n".join(output_lines)
        if output:
            output += "\n"

        return ExecResult(stdout="" if silent else output, stderr="", exit_code=exit_code)
