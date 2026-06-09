"""Ls command implementation.

Usage: ls [OPTION]... [FILE]...

List information about the FILEs (the current directory by default).

Options:
  -a, --all            do not ignore entries starting with .
  -A, --almost-all     do not list implied . and ..
  -l                   use a long listing format
  -1                   list one file per line
  -R, --recursive      list subdirectories recursively
  -h, --human-readable with -l, print sizes in human readable format
  -d, --directory      list directories themselves, not their contents
  -F, --classify       append indicator (one of */=>@|) to entries
  -S                   sort by file size, largest first
  -t                   sort by modification time, newest first
  -r, --reverse        reverse order while sorting
"""

import stat
from ...types import CommandContext, ExecResult


def format_size(size: int, human_readable: bool = False) -> str:
    """Format file size."""
    if not human_readable:
        return str(size)

    for unit in ['B', 'K', 'M', 'G', 'T']:
        if size < 1024:
            if unit == 'B':
                return str(size)
            return f"{size:.1f}{unit}"
        size //= 1024
    return f"{size:.1f}P"


def format_mode(mode: int, is_dir: bool, is_link: bool) -> str:
    """Format file mode as rwxrwxrwx string."""
    if is_dir:
        result = 'd'
    elif is_link:
        result = 'l'
    else:
        result = '-'

    # Owner
    result += 'r' if mode & stat.S_IRUSR else '-'
    result += 'w' if mode & stat.S_IWUSR else '-'
    result += 'x' if mode & stat.S_IXUSR else '-'
    # Group
    result += 'r' if mode & stat.S_IRGRP else '-'
    result += 'w' if mode & stat.S_IWGRP else '-'
    result += 'x' if mode & stat.S_IXGRP else '-'
    # Other
    result += 'r' if mode & stat.S_IROTH else '-'
    result += 'w' if mode & stat.S_IWOTH else '-'
    result += 'x' if mode & stat.S_IXOTH else '-'

    return result


class LsCommand:
    """The ls command."""

    name = "ls"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the ls command."""
        # Options
        show_all = False
        almost_all = False
        long_format = False
        one_per_line = False
        recursive = False
        human_readable = False
        dir_only = False
        classify = False
        reverse = False
        sort_by_size = False
        sort_by_time = False

        paths: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                paths.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--all":
                    show_all = True
                elif arg == "--almost-all":
                    almost_all = True
                elif arg == "--recursive":
                    recursive = True
                elif arg == "--human-readable":
                    human_readable = True
                elif arg == "--directory":
                    dir_only = True
                elif arg == "--classify":
                    classify = True
                elif arg == "--reverse":
                    reverse = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"ls: unrecognized option '{arg}'\n",
                        exit_code=2,
                    )
            elif arg.startswith("-") and arg != "-":
                for c in arg[1:]:
                    if c == 'a':
                        show_all = True
                    elif c == 'A':
                        almost_all = True
                    elif c == 'l':
                        long_format = True
                    elif c == '1':
                        one_per_line = True
                    elif c == 'R':
                        recursive = True
                    elif c == 'h':
                        human_readable = True
                    elif c == 'd':
                        dir_only = True
                    elif c == 'F':
                        classify = True
                    elif c == 'r':
                        reverse = True
                    elif c == 'S':
                        sort_by_size = True
                    elif c == 't':
                        sort_by_time = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"ls: invalid option -- '{c}'\n",
                            exit_code=2,
                        )
            else:
                paths.append(arg)
            i += 1

        # Default to current directory
        if not paths:
            paths = ["."]

        stdout = ""
        stderr = ""
        exit_code = 0

        for path_idx, path in enumerate(paths):
            # Resolve path
            full_path = ctx.fs.resolve_path(ctx.cwd, path)

            try:
                st = await ctx.fs.stat(full_path)
            except FileNotFoundError:
                stderr += f"ls: cannot access '{path}': No such file or directory\n"
                exit_code = 2
                continue

            if st.is_directory and not dir_only:
                # List directory contents
                if len(paths) > 1:
                    if path_idx > 0:
                        stdout += "\n"
                    stdout += f"{path}:\n"

                try:
                    entries = await ctx.fs.readdir(full_path)
                except PermissionError:
                    stderr += f"ls: cannot open directory '{path}': Permission denied\n"
                    exit_code = 2
                    continue

                # Filter hidden files
                if not show_all and not almost_all:
                    entries = [e for e in entries if not e.startswith('.')]
                elif almost_all:
                    # -A shows hidden files but not . and ..
                    entries = [e for e in entries if e not in (".", "..")]
                # else: show_all shows everything including . and ..

                # Sort entries
                if sort_by_size or sort_by_time:
                    # Get stat for each entry
                    entries_with_stats: list[tuple[str, int, float]] = []
                    for e in entries:
                        entry_path = f"{full_path}/{e}" if full_path != "/" else f"/{e}"
                        try:
                            entry_stat = await ctx.fs.stat(entry_path)
                            entries_with_stats.append((e, entry_stat.size, entry_stat.mtime or 0))
                        except Exception:
                            entries_with_stats.append((e, 0, 0))

                    if sort_by_time:
                        # Sort by mtime, newest first (descending)
                        entries_with_stats.sort(key=lambda x: (x[2], x[0]), reverse=True)
                    elif sort_by_size:
                        # Sort by size, largest first (descending)
                        entries_with_stats.sort(key=lambda x: (x[1], x[0]), reverse=True)

                    entries = [e for e, _, _ in entries_with_stats]
                    if reverse:
                        entries.reverse()
                else:
                    entries.sort(reverse=reverse)

                if long_format:
                    for entry in entries:
                        entry_path = f"{full_path}/{entry}" if full_path != "/" else f"/{entry}"
                        try:
                            entry_stat = await ctx.fs.stat(entry_path)
                            mode_str = format_mode(entry_stat.mode, entry_stat.is_directory, entry_stat.is_symbolic_link)
                            size_str = format_size(entry_stat.size, human_readable)
                            name = entry
                            if classify:
                                if entry_stat.is_directory:
                                    name += "/"
                                elif entry_stat.is_symbolic_link:
                                    name += "@"
                                elif entry_stat.mode & stat.S_IXUSR:
                                    name += "*"
                            stdout += f"{mode_str}  {entry_stat.nlink:2d} user user {size_str:>8s} Jan  1 00:00 {name}\n"
                        except FileNotFoundError:
                            stdout += f"?????????  ? ? ? ? ? {entry}\n"
                elif one_per_line:
                    for entry in entries:
                        name = entry
                        if classify:
                            entry_path = f"{full_path}/{entry}" if full_path != "/" else f"/{entry}"
                            try:
                                entry_stat = await ctx.fs.stat(entry_path)
                                if entry_stat.is_directory:
                                    name += "/"
                                elif entry_stat.is_symbolic_link:
                                    name += "@"
                            except FileNotFoundError:
                                pass
                        stdout += f"{name}\n"
                else:
                    # Simple format
                    output_entries = []
                    for entry in entries:
                        name = entry
                        if classify:
                            entry_path = f"{full_path}/{entry}" if full_path != "/" else f"/{entry}"
                            try:
                                entry_stat = await ctx.fs.stat(entry_path)
                                if entry_stat.is_directory:
                                    name += "/"
                                elif entry_stat.is_symbolic_link:
                                    name += "@"
                            except FileNotFoundError:
                                pass
                        output_entries.append(name)
                    stdout += "\n".join(output_entries) + "\n"
            else:
                # Single file/directory
                name = path
                if classify and st.is_directory:
                    name += "/"
                elif classify and st.is_symbolic_link:
                    name += "@"
                elif classify and st.mode & stat.S_IXUSR:
                    name += "*"

                if long_format:
                    mode_str = format_mode(st.mode, st.is_directory, st.is_symbolic_link)
                    size_str = format_size(st.size, human_readable)
                    stdout += f"{mode_str}  {st.nlink:2d} user user {size_str:>8s} Jan  1 00:00 {name}\n"
                else:
                    stdout += f"{name}\n"

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
