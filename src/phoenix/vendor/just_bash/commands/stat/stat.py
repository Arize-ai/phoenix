"""Stat command implementation."""

from datetime import datetime
from ...types import CommandContext, ExecResult


class StatCommand:
    """The stat command."""

    name = "stat"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the stat command."""
        format_str = None
        paths: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-c" and i + 1 < len(args):
                i += 1
                format_str = args[i]
            elif arg.startswith("--format="):
                format_str = arg[9:]
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: stat [OPTION]... FILE...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                paths.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"stat: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                paths.append(arg)
            i += 1

        if not paths:
            return ExecResult(
                stdout="",
                stderr="stat: missing operand\n",
                exit_code=1,
            )

        stdout_parts = []
        stderr = ""
        exit_code = 0

        for path in paths:
            try:
                resolved = ctx.fs.resolve_path(ctx.cwd, path)
                stat = await ctx.fs.stat(resolved)

                if format_str:
                    output = self._format(format_str, path, stat)
                else:
                    output = self._default_format(path, stat)

                stdout_parts.append(output)
            except FileNotFoundError:
                stderr += f"stat: cannot stat '{path}': No such file or directory\n"
                exit_code = 1
            except Exception as e:
                stderr += f"stat: {path}: {e}\n"
                exit_code = 1

        return ExecResult(
            stdout="\n".join(stdout_parts),
            stderr=stderr,
            exit_code=exit_code,
        )

    def _format(self, format_str: str, path: str, stat) -> str:
        """Format stat output using format string."""
        result = format_str

        # %n - file name
        result = result.replace("%n", path)

        # %s - size
        result = result.replace("%s", str(stat.size))

        # %F - file type
        if stat.is_directory:
            file_type = "directory"
        elif stat.is_symbolic_link:
            file_type = "symbolic link"
        else:
            file_type = "regular file"
        result = result.replace("%F", file_type)

        # %a - access rights in octal
        result = result.replace("%a", oct(stat.mode & 0o777)[2:])

        # %A - access rights in human readable form
        result = result.replace("%A", self._mode_to_string(stat.mode, stat.is_directory))

        # %u - user ID (hardcoded for virtual FS)
        result = result.replace("%u", "1000")

        # %U - username (hardcoded for virtual FS)
        result = result.replace("%U", "user")

        # %g - group ID (hardcoded for virtual FS)
        result = result.replace("%g", "1000")

        # %G - group name (hardcoded for virtual FS)
        result = result.replace("%G", "group")

        # %Y - modification time as seconds since Epoch
        result = result.replace("%Y", str(int(stat.mtime)))

        # %X - access time as seconds since Epoch (same as mtime for our FS)
        result = result.replace("%X", str(int(stat.mtime)))

        # %Z - change time as seconds since Epoch (same as mtime for our FS)
        result = result.replace("%Z", str(int(stat.mtime)))

        return result + "\n"

    def _default_format(self, path: str, stat) -> str:
        """Generate default stat output."""
        lines = []
        lines.append(f"  File: {path}")
        lines.append(f"  Size: {stat.size}")

        if stat.is_directory:
            file_type = "directory"
        elif stat.is_symbolic_link:
            file_type = "symbolic link"
        else:
            file_type = "regular file"

        lines.append(f"  Type: {file_type}")
        lines.append(f"Access: ({oct(stat.mode & 0o777)[2:]}/{self._mode_to_string(stat.mode, stat.is_directory)})")

        if stat.mtime:
            mtime = datetime.fromtimestamp(stat.mtime)
            lines.append(f"Modify: {mtime.isoformat()}")

        return "\n".join(lines) + "\n"

    def _mode_to_string(self, mode: int, is_dir: bool) -> str:
        """Convert mode to rwx string."""
        result = "d" if is_dir else "-"

        for i in range(2, -1, -1):
            bits = (mode >> (i * 3)) & 0o7
            result += "r" if bits & 0o4 else "-"
            result += "w" if bits & 0o2 else "-"
            result += "x" if bits & 0o1 else "-"

        return result
