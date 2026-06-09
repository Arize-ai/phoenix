"""Du command implementation - disk usage."""

from ...types import CommandContext, ExecResult


class DuCommand:
    """The du command - disk usage."""

    name = "du"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the du command."""
        show_all = False
        summary_only = False
        human_readable = False
        show_total = False
        max_depth = None
        paths: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-a" or arg == "--all":
                show_all = True
            elif arg == "-s" or arg == "--summarize":
                summary_only = True
            elif arg == "-h" or arg == "--human-readable":
                human_readable = True
            elif arg == "-c" or arg == "--total":
                show_total = True
            elif arg.startswith("--max-depth="):
                try:
                    max_depth = int(arg[12:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"du: invalid maximum depth '{arg[12:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: du [OPTION]... [FILE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg.startswith("-"):
                pass  # Ignore unknown options
            else:
                paths.append(arg)
            i += 1

        if not paths:
            paths = ["."]

        output_lines = []
        total_size = 0

        for path in paths:
            try:
                resolved = ctx.fs.resolve_path(ctx.cwd, path)
                stat = await ctx.fs.stat(resolved)

                if stat.is_directory:
                    size = await self._get_dir_size(
                        ctx, resolved, path, show_all, summary_only,
                        max_depth, 0, output_lines, human_readable
                    )
                else:
                    size = stat.size
                    size_str = self._format_size(size, human_readable)
                    output_lines.append(f"{size_str}\t{path}")

                total_size += size

            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"du: cannot access '{path}': No such file or directory\n",
                    exit_code=1,
                )

        if show_total:
            size_str = self._format_size(total_size, human_readable)
            output_lines.append(f"{size_str}\ttotal")

        return ExecResult(
            stdout="\n".join(output_lines) + "\n" if output_lines else "",
            stderr="",
            exit_code=0,
        )

    async def _get_dir_size(
        self, ctx: CommandContext, path: str, display_path: str,
        show_all: bool, summary_only: bool, max_depth: int | None,
        current_depth: int, output_lines: list[str], human_readable: bool
    ) -> int:
        """Get directory size recursively."""
        total = 0

        try:
            entries = await ctx.fs.readdir(path)

            for entry in entries:
                entry_path = f"{path}/{entry}"
                entry_display = f"{display_path}/{entry}"

                try:
                    stat = await ctx.fs.stat(entry_path)

                    if stat.is_directory:
                        size = await self._get_dir_size(
                            ctx, entry_path, entry_display, show_all,
                            summary_only, max_depth, current_depth + 1,
                            output_lines, human_readable
                        )
                    else:
                        size = stat.size
                        if show_all and not summary_only:
                            if max_depth is None or current_depth < max_depth:
                                size_str = self._format_size(size, human_readable)
                                output_lines.append(f"{size_str}\t{entry_display}")

                    total += size
                except Exception:
                    pass

        except Exception:
            pass

        # Output this directory
        if not summary_only or current_depth == 0:
            if max_depth is None or current_depth <= max_depth:
                size_str = self._format_size(total, human_readable)
                output_lines.append(f"{size_str}\t{display_path}")

        return total

    def _format_size(self, size: int, human_readable: bool) -> str:
        """Format size for display."""
        if not human_readable:
            return str(size // 1024 or 1)  # Return in KB, minimum 1

        if size < 1024:
            return f"{size}B"
        elif size < 1024 * 1024:
            return f"{size // 1024}K"
        elif size < 1024 * 1024 * 1024:
            return f"{size // (1024 * 1024)}M"
        else:
            return f"{size // (1024 * 1024 * 1024)}G"
