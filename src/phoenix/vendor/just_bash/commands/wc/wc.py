"""Wc command implementation.

Usage: wc [OPTION]... [FILE]...

Print newline, word, and byte counts for each FILE.
With no FILE, or when FILE is -, read standard input.

Options:
  -c, --bytes      print the byte counts
  -m, --chars      print the character counts
  -l, --lines      print the newline counts
  -w, --words      print the word counts
  -L, --max-line-length  print the length of the longest line
"""

from ...types import CommandContext, ExecResult


class WcCommand:
    """The wc command."""

    name = "wc"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the wc command."""
        show_lines = False
        show_words = False
        show_bytes = False
        show_chars = False
        show_max_line = False
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--lines":
                    show_lines = True
                elif arg == "--words":
                    show_words = True
                elif arg == "--bytes":
                    show_bytes = True
                elif arg == "--chars":
                    show_chars = True
                elif arg == "--max-line-length":
                    show_max_line = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"wc: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                for c in arg[1:]:
                    if c == 'l':
                        show_lines = True
                    elif c == 'w':
                        show_words = True
                    elif c == 'c':
                        show_bytes = True
                    elif c == 'm':
                        show_chars = True
                    elif c == 'L':
                        show_max_line = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"wc: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            else:
                files.append(arg)
            i += 1

        # Default to all three counts if none specified
        if not (show_lines or show_words or show_bytes or show_chars or show_max_line):
            show_lines = True
            show_words = True
            show_bytes = True

        # Default to stdin
        if not files:
            files = ["-"]

        stdout = ""
        stderr = ""
        exit_code = 0

        total_lines = 0
        total_words = 0
        total_bytes = 0
        total_chars = 0
        total_max_line = 0

        for file in files:
            try:
                if file == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file(path)

                # Count lines (number of newlines)
                lines = content.count("\n")
                # Count words
                words = len(content.split())
                # Count bytes
                bytes_count = len(content.encode("utf-8"))
                # Count chars
                chars = len(content)
                # Max line length
                max_line = max((len(line) for line in content.split("\n")), default=0)

                total_lines += lines
                total_words += words
                total_bytes += bytes_count
                total_chars += chars
                total_max_line = max(total_max_line, max_line)

                # Build output
                # Use minimal formatting when only one counter is shown
                num_counters = sum([show_lines, show_words, show_bytes, show_chars, show_max_line])
                use_padding = num_counters > 1 or len(files) > 1

                parts = []
                if show_lines:
                    parts.append(f"{lines:7d}" if use_padding else str(lines))
                if show_words:
                    parts.append(f"{words:7d}" if use_padding else str(words))
                if show_bytes:
                    parts.append(f"{bytes_count:7d}" if use_padding else str(bytes_count))
                if show_chars:
                    parts.append(f"{chars:7d}" if use_padding else str(chars))
                if show_max_line:
                    parts.append(f"{max_line:7d}" if use_padding else str(max_line))

                # Don't show filename for stdin when it's the only file
                if file == "-" and len(files) == 1:
                    stdout += " ".join(parts) + "\n"
                else:
                    stdout += " ".join(parts) + f" {file}\n"

            except FileNotFoundError:
                stderr += f"wc: {file}: No such file or directory\n"
                exit_code = 1
            except IsADirectoryError:
                stderr += f"wc: {file}: Is a directory\n"
                exit_code = 1

        # Print total if multiple files
        if len(files) > 1:
            parts = []
            if show_lines:
                parts.append(f"{total_lines:7d}")
            if show_words:
                parts.append(f"{total_words:7d}")
            if show_bytes:
                parts.append(f"{total_bytes:7d}")
            if show_chars:
                parts.append(f"{total_chars:7d}")
            if show_max_line:
                parts.append(f"{total_max_line:7d}")
            stdout += " ".join(parts) + " total\n"

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
