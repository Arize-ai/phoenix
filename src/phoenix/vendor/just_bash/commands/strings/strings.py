"""Strings command implementation."""

from ...types import CommandContext, ExecResult


class StringsCommand:
    """The strings command - find printable strings in files."""

    name = "strings"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the strings command."""
        min_length = 4
        show_offset = False
        offset_format = "o"  # octal by default
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: strings [OPTION]... [FILE]...\nFind printable strings in files.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "-n" and i + 1 < len(args):
                i += 1
                try:
                    min_length = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"strings: invalid minimum string length: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-n"):
                try:
                    min_length = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"strings: invalid minimum string length: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg == "-o":
                show_offset = True
                offset_format = "o"
            elif arg == "-t" and i + 1 < len(args):
                i += 1
                show_offset = True
                offset_format = args[i]
            elif arg.startswith("-t"):
                show_offset = True
                offset_format = arg[2:]
            elif arg.startswith("-") and len(arg) > 1:
                # Could be -N for minimum length
                try:
                    min_length = int(arg[1:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"strings: invalid option -- '{arg[1]}'\n",
                        exit_code=1,
                    )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            else:
                files.append(arg)
            i += 1

        if min_length <= 0:
            return ExecResult(
                stdout="",
                stderr="strings: minimum string length must be greater than 0\n",
                exit_code=1,
            )

        # Read from stdin if no files
        if not files:
            content = ctx.stdin.encode("utf-8", errors="replace")
            result = self._find_strings(content, min_length, show_offset, offset_format)
            return ExecResult(stdout=result, stderr="", exit_code=0)

        stdout_parts = []
        stderr = ""
        exit_code = 0

        for file in files:
            try:
                if file == "-":
                    content = ctx.stdin.encode("utf-8", errors="replace")
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file_bytes(path)

                result = self._find_strings(content, min_length, show_offset, offset_format)
                stdout_parts.append(result)

            except FileNotFoundError:
                stderr += f"strings: {file}: No such file or directory\n"
                exit_code = 1

        return ExecResult(stdout="".join(stdout_parts), stderr=stderr, exit_code=exit_code)

    def _find_strings(
        self, data: bytes, min_length: int, show_offset: bool = False, offset_format: str = "o"
    ) -> str:
        """Find printable strings in binary data."""
        result = []
        current = []
        start_offset = 0

        for idx, byte in enumerate(data):
            # Check if byte is printable ASCII (32-126) or tab/newline
            if 32 <= byte <= 126 or byte in (9, 10, 13):
                if not current:
                    start_offset = idx
                current.append(chr(byte))
            else:
                if len(current) >= min_length:
                    s = "".join(current)
                    if show_offset:
                        if offset_format == "x":
                            result.append(f"{start_offset:7x} {s}")
                        elif offset_format == "d":
                            result.append(f"{start_offset:7d} {s}")
                        else:  # octal
                            result.append(f"{start_offset:7o} {s}")
                    else:
                        result.append(s)
                current = []

        # Check final string
        if len(current) >= min_length:
            s = "".join(current)
            if show_offset:
                if offset_format == "x":
                    result.append(f"{start_offset:7x} {s}")
                elif offset_format == "d":
                    result.append(f"{start_offset:7d} {s}")
                else:  # octal
                    result.append(f"{start_offset:7o} {s}")
            else:
                result.append(s)

        if result:
            return "\n".join(result) + "\n"
        return ""
