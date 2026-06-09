"""Od command implementation."""

from ...types import CommandContext, ExecResult


class OdCommand:
    """The od command - dump files in various formats."""

    name = "od"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the od command."""
        format_type = "o"  # octal (default)
        address_format = "o"  # octal addresses
        suppress_address = False
        skip_bytes = 0
        read_count = -1  # -1 means read all
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: od [OPTION]... [FILE]...\nDump files in various formats.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "-c":
                format_type = "c"  # character
            elif arg == "-x":
                format_type = "x"  # hexadecimal
            elif arg == "-o":
                format_type = "o"  # octal
            elif arg == "-d":
                format_type = "d"  # decimal
            elif arg == "-An":
                suppress_address = True
            elif arg == "-A":
                # -A RADIX: address radix
                if i + 1 < len(args):
                    i += 1
                    radix = args[i]
                    if radix == "n":
                        suppress_address = True
                    elif radix in ("d", "o", "x"):
                        address_format = radix
                else:
                    return ExecResult(
                        stdout="",
                        stderr="od: option requires an argument -- 'A'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-A") and len(arg) == 3:
                radix = arg[2]
                if radix == "n":
                    suppress_address = True
                elif radix in ("d", "o", "x"):
                    address_format = radix
            elif arg == "-j":
                # -j BYTES: skip bytes
                if i + 1 < len(args):
                    i += 1
                    try:
                        skip_bytes = int(args[i])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"od: invalid argument '{args[i]}' for skip\n",
                            exit_code=1,
                        )
                else:
                    return ExecResult(
                        stdout="",
                        stderr="od: option requires an argument -- 'j'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-j") and len(arg) > 2:
                try:
                    skip_bytes = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"od: invalid argument '{arg[2:]}' for skip\n",
                        exit_code=1,
                    )
            elif arg == "-N":
                # -N BYTES: read count
                if i + 1 < len(args):
                    i += 1
                    try:
                        read_count = int(args[i])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"od: invalid argument '{args[i]}' for count\n",
                            exit_code=1,
                        )
                else:
                    return ExecResult(
                        stdout="",
                        stderr="od: option requires an argument -- 'N'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-N") and len(arg) > 2:
                try:
                    read_count = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"od: invalid argument '{arg[2:]}' for count\n",
                        exit_code=1,
                    )
            elif arg == "-t":
                # -t TYPE: type specifier follows
                if i + 1 < len(args):
                    i += 1
                    type_spec = args[i]
                    format_type = self._parse_type_spec(type_spec)
                else:
                    return ExecResult(
                        stdout="",
                        stderr="od: option requires an argument -- 't'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-t"):
                # -tTYPE: type specifier attached
                type_spec = arg[2:]
                format_type = self._parse_type_spec(type_spec)
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"od: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        # Read from stdin if no files
        if not files:
            content = ctx.stdin.encode("latin-1", errors="replace")
            # Apply skip and count
            if skip_bytes > 0:
                content = content[skip_bytes:]
            if read_count >= 0:
                content = content[:read_count]
            result = self._dump(content, format_type, address_format, suppress_address)
            return ExecResult(stdout=result, stderr="", exit_code=0)

        stdout_parts = []
        stderr = ""
        exit_code = 0

        for file in files:
            try:
                if file == "-":
                    content = ctx.stdin.encode("latin-1", errors="replace")
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file_bytes(path)

                # Apply skip and count
                if skip_bytes > 0:
                    content = content[skip_bytes:]
                if read_count >= 0:
                    content = content[:read_count]

                result = self._dump(content, format_type, address_format, suppress_address)
                stdout_parts.append(result)

            except FileNotFoundError:
                stderr += f"od: {file}: No such file or directory\n"
                exit_code = 1

        return ExecResult(stdout="".join(stdout_parts), stderr=stderr, exit_code=exit_code)

    def _parse_type_spec(self, spec: str) -> str:
        """Parse a -t type specifier."""
        if not spec:
            return "o"
        first_char = spec[0].lower()
        if first_char == "c":
            return "c"
        elif first_char == "x":
            return "x"
        elif first_char == "o":
            return "o"
        elif first_char == "d" or first_char == "u":
            return "d"
        else:
            return "o"

    def _dump(
        self, data: bytes, format_type: str, address_format: str, suppress_address: bool
    ) -> str:
        """Dump data in specified format."""
        result_lines = []
        bytes_per_line = 16
        offset = 0

        while offset < len(data):
            line_data = data[offset:offset + bytes_per_line]
            parts = []

            # Add address
            if not suppress_address:
                if address_format == "d":
                    parts.append(f"{offset:07d}")
                elif address_format == "x":
                    parts.append(f"{offset:07x}")
                else:
                    parts.append(f"{offset:07o}")

            # Add data with proper 4-char field formatting
            if format_type == "c":
                # Character format: each char in 4-char field
                chars = []
                for byte in line_data:
                    if byte == 0:
                        chars.append("  \\0")
                    elif byte == 7:
                        chars.append("  \\a")
                    elif byte == 8:
                        chars.append("  \\b")
                    elif byte == 9:
                        chars.append("  \\t")
                    elif byte == 10:
                        chars.append("  \\n")
                    elif byte == 11:
                        chars.append("  \\v")
                    elif byte == 12:
                        chars.append("  \\f")
                    elif byte == 13:
                        chars.append("  \\r")
                    elif 32 <= byte <= 126:
                        chars.append(f"   {chr(byte)}")
                    else:
                        chars.append(f" {byte:03o}")
                parts.append("".join(chars))
            elif format_type == "x":
                # Hexadecimal format: 4-char fields
                hex_vals = [f" {byte:02x}" for byte in line_data]
                parts.append("".join(hex_vals))
            elif format_type == "d":
                # Decimal format: 4-char fields
                dec_vals = [f" {byte:3d}" for byte in line_data]
                parts.append("".join(dec_vals))
            else:
                # Octal format (default): 4-char fields
                oct_vals = [f" {byte:03o}" for byte in line_data]
                parts.append("".join(oct_vals))

            result_lines.append(" ".join(parts))
            offset += bytes_per_line

        # Final address marker
        if not suppress_address and data:
            if address_format == "d":
                result_lines.append(f"{len(data):07d}")
            elif address_format == "x":
                result_lines.append(f"{len(data):07x}")
            else:
                result_lines.append(f"{len(data):07o}")

        if result_lines:
            return "\n".join(result_lines) + "\n"
        return ""
