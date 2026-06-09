"""Split command implementation."""

from ...types import CommandContext, ExecResult


class SplitCommand:
    """The split command - split a file into pieces."""

    name = "split"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the split command."""
        lines_per_file = 1000
        bytes_per_file = None
        num_chunks = None
        numeric_suffix = False
        suffix_length = 2
        prefix = "x"
        file_path = None

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: split [OPTION]... [FILE [PREFIX]]\nSplit a file into pieces.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "-l" and i + 1 < len(args):
                i += 1
                try:
                    lines_per_file = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"split: invalid number of lines: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-l"):
                try:
                    lines_per_file = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"split: invalid number of lines: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg == "-b" and i + 1 < len(args):
                i += 1
                bytes_per_file = self._parse_size(args[i])
                if bytes_per_file is None:
                    return ExecResult(
                        stdout="",
                        stderr=f"split: invalid number of bytes: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-b"):
                bytes_per_file = self._parse_size(arg[2:])
                if bytes_per_file is None:
                    return ExecResult(
                        stdout="",
                        stderr=f"split: invalid number of bytes: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg == "-n" and i + 1 < len(args):
                i += 1
                try:
                    num_chunks = int(args[i])
                    if num_chunks <= 0:
                        raise ValueError("must be positive")
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"split: invalid number of chunks: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-n"):
                try:
                    num_chunks = int(arg[2:])
                    if num_chunks <= 0:
                        raise ValueError("must be positive")
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"split: invalid number of chunks: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg in ("-d", "--numeric-suffixes"):
                numeric_suffix = True
            elif arg == "-a" and i + 1 < len(args):
                i += 1
                try:
                    suffix_length = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"split: invalid suffix length: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-a"):
                try:
                    suffix_length = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"split: invalid suffix length: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--":
                remaining = args[i + 1:]
                if remaining:
                    file_path = remaining[0]
                if len(remaining) > 1:
                    prefix = remaining[1]
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"split: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            elif file_path is None:
                file_path = arg
            else:
                prefix = arg
            i += 1

        # Read content
        try:
            if file_path is None or file_path == "-":
                content = ctx.stdin
                content_bytes = content.encode("utf-8")
            else:
                path = ctx.fs.resolve_path(ctx.cwd, file_path)
                content_bytes = await ctx.fs.read_file_bytes(path)
                content = content_bytes.decode("utf-8", errors="replace")
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"split: {file_path}: No such file or directory\n",
                exit_code=1,
            )

        # Split the content
        if num_chunks is not None:
            chunks = self._split_into_chunks(content_bytes, num_chunks)
        elif bytes_per_file is not None:
            chunks = self._split_by_bytes(content_bytes, bytes_per_file)
        else:
            chunks = self._split_by_lines(content, lines_per_file)

        # Write output files
        for idx, chunk in enumerate(chunks):
            suffix = self._generate_suffix(idx, suffix_length, numeric_suffix)
            output_path = ctx.fs.resolve_path(ctx.cwd, prefix + suffix)

            if isinstance(chunk, bytes):
                await ctx.fs.write_file(output_path, chunk)
            else:
                await ctx.fs.write_file(output_path, chunk)

        return ExecResult(stdout="", stderr="", exit_code=0)

    def _parse_size(self, s: str) -> int | None:
        """Parse a size specification like '100', '1k', '1m'."""
        if not s:
            return None
        try:
            multiplier = 1
            if s[-1].lower() == "k":
                multiplier = 1024
                s = s[:-1]
            elif s[-1].lower() == "m":
                multiplier = 1024 * 1024
                s = s[:-1]
            elif s[-1].lower() == "g":
                multiplier = 1024 * 1024 * 1024
                s = s[:-1]
            return int(s) * multiplier
        except ValueError:
            return None

    def _split_by_lines(self, content: str, lines_per_file: int) -> list[str]:
        """Split content by number of lines."""
        lines = content.split("\n")
        chunks = []

        for i in range(0, len(lines), lines_per_file):
            chunk_lines = lines[i:i + lines_per_file]
            chunk = "\n".join(chunk_lines)
            if i + lines_per_file < len(lines):
                chunk += "\n"
            chunks.append(chunk)

        return chunks if chunks else [""]

    def _split_by_bytes(self, content: bytes, bytes_per_file: int) -> list[bytes]:
        """Split content by number of bytes."""
        chunks = []
        for i in range(0, len(content), bytes_per_file):
            chunks.append(content[i:i + bytes_per_file])
        return chunks if chunks else [b""]

    def _split_into_chunks(self, content: bytes, num_chunks: int) -> list[bytes]:
        """Split content into exactly N chunks."""
        total = len(content)
        if total == 0:
            # Return empty chunks
            return [b""] * num_chunks

        # Calculate base size and remainder
        base_size = total // num_chunks
        remainder = total % num_chunks

        chunks = []
        pos = 0
        for i in range(num_chunks):
            # First 'remainder' chunks get one extra byte
            chunk_size = base_size + (1 if i < remainder else 0)
            chunks.append(content[pos:pos + chunk_size])
            pos += chunk_size

        return chunks

    def _generate_suffix(self, idx: int, length: int, numeric: bool) -> str:
        """Generate suffix for output file."""
        if numeric:
            return str(idx).zfill(length)
        else:
            # Generate alphabetic suffix (aa, ab, ..., az, ba, ...)
            suffix = ""
            remaining = idx
            for _ in range(length):
                suffix = chr(ord("a") + remaining % 26) + suffix
                remaining //= 26
            return suffix
