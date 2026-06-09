"""Tree command implementation."""

from ...types import CommandContext, ExecResult


class TreeCommand:
    """The tree command - display directory tree."""

    name = "tree"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the tree command."""
        show_all = False
        dirs_only = False
        max_depth = None
        show_full_path = False
        paths: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-a":
                show_all = True
            elif arg == "-d":
                dirs_only = True
            elif arg == "-L" and i + 1 < len(args):
                i += 1
                try:
                    max_depth = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"tree: Invalid level: {args[i]}\n",
                        exit_code=1,
                    )
            elif arg == "-f":
                show_full_path = True
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: tree [OPTIONS] [directory...]\n",
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
        total_dirs = 0
        total_files = 0

        for path in paths:
            try:
                resolved = ctx.fs.resolve_path(ctx.cwd, path)
                stat = await ctx.fs.stat(resolved)

                if not stat.is_directory:
                    return ExecResult(
                        stdout="",
                        stderr=f"tree: {path}: Not a directory\n",
                        exit_code=1,
                    )

                output_lines.append(path)
                dirs, files = await self._tree(
                    ctx, resolved, "", show_all, dirs_only,
                    max_depth, 0, show_full_path, output_lines
                )
                total_dirs += dirs
                total_files += files

            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"tree: {path}: No such file or directory\n",
                    exit_code=1,
                )

        output_lines.append("")
        output_lines.append(f"{total_dirs} directories, {total_files} files")

        return ExecResult(
            stdout="\n".join(output_lines) + "\n",
            stderr="",
            exit_code=0,
        )

    async def _tree(
        self, ctx: CommandContext, path: str, prefix: str,
        show_all: bool, dirs_only: bool, max_depth: int | None,
        current_depth: int, show_full_path: bool, output_lines: list[str]
    ) -> tuple[int, int]:
        """Recursively build tree output."""
        if max_depth is not None and current_depth >= max_depth:
            return 0, 0

        entries = await ctx.fs.readdir(path)
        entries = sorted(entries)

        if not show_all:
            entries = [e for e in entries if not e.startswith(".")]

        dirs = 0
        files = 0

        for idx, entry in enumerate(entries):
            is_last = idx == len(entries) - 1
            connector = "└── " if is_last else "├── "
            entry_path = f"{path}/{entry}"

            try:
                stat = await ctx.fs.stat(entry_path)

                if dirs_only and not stat.is_directory:
                    continue

                display_name = entry_path if show_full_path else entry
                output_lines.append(f"{prefix}{connector}{display_name}")

                if stat.is_directory:
                    dirs += 1
                    new_prefix = prefix + ("    " if is_last else "│   ")
                    sub_dirs, sub_files = await self._tree(
                        ctx, entry_path, new_prefix, show_all, dirs_only,
                        max_depth, current_depth + 1, show_full_path, output_lines
                    )
                    dirs += sub_dirs
                    files += sub_files
                else:
                    files += 1
            except Exception:
                pass

        return dirs, files
