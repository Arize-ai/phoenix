"""Cut command implementation.

Usage: cut OPTION... [FILE]...

Print selected parts of lines from each FILE to standard output.

Options:
  -b, --bytes=LIST       select only these bytes
  -c, --characters=LIST  select only these characters
  -d, --delimiter=DELIM  use DELIM instead of TAB for field delimiter
  -f, --fields=LIST      select only these fields
  -s, --only-delimited   do not print lines not containing delimiters
  --output-delimiter=STRING  use STRING as the output delimiter

LIST is made up of one range, or many ranges separated by commas.
Each range is one of:
  N     N'th byte, character or field, counted from 1
  N-    from N'th byte, character or field, to end of line
  N-M   from N'th to M'th byte, character or field
  -M    from first to M'th byte, character or field
"""

from ...types import CommandContext, ExecResult


class CutCommand:
    """The cut command."""

    name = "cut"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the cut command."""
        byte_list = ""
        char_list = ""
        field_list = ""
        delimiter = "\t"
        output_delimiter = None
        only_delimited = False
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg.startswith("--bytes="):
                    byte_list = arg[8:]
                elif arg.startswith("--characters="):
                    char_list = arg[13:]
                elif arg.startswith("--delimiter="):
                    delimiter = arg[12:]
                    if len(delimiter) != 1:
                        return ExecResult(
                            stdout="",
                            stderr="cut: the delimiter must be a single character\n",
                            exit_code=1,
                        )
                elif arg.startswith("--fields="):
                    field_list = arg[9:]
                elif arg == "--only-delimited":
                    only_delimited = True
                elif arg.startswith("--output-delimiter="):
                    output_delimiter = arg[19:]
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"cut: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "b":
                        # -b requires a value
                        if j + 1 < len(arg):
                            byte_list = arg[j + 1:]
                            break
                        elif i + 1 < len(args):
                            i += 1
                            byte_list = args[i]
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="cut: option requires an argument -- 'b'\n",
                                exit_code=1,
                            )
                    elif c == "c":
                        # -c requires a value
                        if j + 1 < len(arg):
                            char_list = arg[j + 1:]
                            break
                        elif i + 1 < len(args):
                            i += 1
                            char_list = args[i]
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="cut: option requires an argument -- 'c'\n",
                                exit_code=1,
                            )
                    elif c == "d":
                        # -d requires a value
                        if j + 1 < len(arg):
                            delimiter = arg[j + 1:]
                            break
                        elif i + 1 < len(args):
                            i += 1
                            delimiter = args[i]
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="cut: option requires an argument -- 'd'\n",
                                exit_code=1,
                            )
                        if len(delimiter) != 1:
                            return ExecResult(
                                stdout="",
                                stderr="cut: the delimiter must be a single character\n",
                                exit_code=1,
                            )
                    elif c == "f":
                        # -f requires a value
                        if j + 1 < len(arg):
                            field_list = arg[j + 1:]
                            break
                        elif i + 1 < len(args):
                            i += 1
                            field_list = args[i]
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="cut: option requires an argument -- 'f'\n",
                                exit_code=1,
                            )
                    elif c == "s":
                        only_delimited = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"cut: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            else:
                files.append(arg)
            i += 1

        # Validate - need exactly one of -b, -c, or -f
        modes = sum([bool(byte_list), bool(char_list), bool(field_list)])
        if modes == 0:
            return ExecResult(
                stdout="",
                stderr="cut: you must specify a list of bytes, characters, or fields\n",
                exit_code=1,
            )
        if modes > 1:
            return ExecResult(
                stdout="",
                stderr="cut: only one type of list may be specified\n",
                exit_code=1,
            )

        # Parse the list
        try:
            if byte_list:
                ranges = self._parse_list(byte_list)
                mode = "bytes"
            elif char_list:
                ranges = self._parse_list(char_list)
                mode = "chars"
            else:
                ranges = self._parse_list(field_list)
                mode = "fields"
        except ValueError as e:
            return ExecResult(
                stdout="",
                stderr=f"cut: {e}\n",
                exit_code=1,
            )

        # Set output delimiter
        if output_delimiter is None:
            output_delimiter = delimiter

        # Default to stdin
        if not files:
            files = ["-"]

        stdout = ""
        stderr = ""
        exit_code = 0

        for f in files:
            try:
                if f == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, f)
                    content = await ctx.fs.read_file(path)

                lines = content.split("\n")
                # Remove trailing empty line if present
                if lines and lines[-1] == "":
                    lines = lines[:-1]

                for line in lines:
                    if mode == "fields":
                        result = self._cut_fields(line, ranges, delimiter, output_delimiter, only_delimited)
                    else:
                        result = self._cut_chars(line, ranges)

                    if result is not None:
                        stdout += result + "\n"

            except FileNotFoundError:
                stderr += f"cut: {f}: No such file or directory\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)

    def _parse_list(self, list_str: str) -> list[tuple[int, int | None]]:
        """Parse a list specification into ranges.

        Returns list of (start, end) tuples. end=None means to end of line.
        Indices are 0-based internally.
        """
        ranges: list[tuple[int, int | None]] = []

        for part in list_str.split(","):
            part = part.strip()
            if not part:
                continue

            if "-" in part:
                if part.startswith("-"):
                    # -M: from start to M
                    try:
                        end = int(part[1:])
                        ranges.append((0, end))
                    except ValueError:
                        raise ValueError(f"invalid byte, character or field list: {list_str}")
                elif part.endswith("-"):
                    # N-: from N to end
                    try:
                        start = int(part[:-1])
                        if start < 1:
                            raise ValueError(f"fields and positions are numbered from 1")
                        ranges.append((start - 1, None))
                    except ValueError:
                        raise ValueError(f"invalid byte, character or field list: {list_str}")
                else:
                    # N-M
                    parts = part.split("-", 1)
                    try:
                        start = int(parts[0])
                        end = int(parts[1])
                        if start < 1:
                            raise ValueError(f"fields and positions are numbered from 1")
                        ranges.append((start - 1, end))
                    except ValueError:
                        raise ValueError(f"invalid byte, character or field list: {list_str}")
            else:
                # Single number
                try:
                    n = int(part)
                    if n < 1:
                        raise ValueError(f"fields and positions are numbered from 1")
                    ranges.append((n - 1, n))
                except ValueError:
                    raise ValueError(f"invalid byte, character or field list: {list_str}")

        return ranges

    def _cut_chars(self, line: str, ranges: list[tuple[int, int | None]]) -> str:
        """Cut characters/bytes from a line."""
        result_chars: list[str] = []
        included = set()

        for start, end in ranges:
            if end is None:
                end = len(line)
            for i in range(start, min(end, len(line))):
                if i not in included:
                    included.add(i)
                    result_chars.append((i, line[i]))

        # Sort by position and extract chars
        result_chars.sort(key=lambda x: x[0])
        return "".join(c for _, c in result_chars)

    def _cut_fields(
        self,
        line: str,
        ranges: list[tuple[int, int | None]],
        delimiter: str,
        output_delimiter: str,
        only_delimited: bool,
    ) -> str | None:
        """Cut fields from a line."""
        if delimiter not in line:
            if only_delimited:
                return None
            return line

        fields = line.split(delimiter)
        result_fields: list[tuple[int, str]] = []
        included = set()

        for start, end in ranges:
            if end is None:
                end = len(fields)
            for i in range(start, min(end, len(fields))):
                if i not in included:
                    included.add(i)
                    result_fields.append((i, fields[i]))

        # Sort by position and extract fields
        result_fields.sort(key=lambda x: x[0])
        return output_delimiter.join(f for _, f in result_fields)
