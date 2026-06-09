"""Join command implementation."""

from ...types import CommandContext, ExecResult


class JoinCommand:
    """The join command - join lines of two files on a common field."""

    name = "join"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the join command."""
        field1 = 1
        field2 = 1
        separator = None
        output_format = None
        print_unpaired_1 = False
        print_unpaired_2 = False
        only_unpaired_1 = False
        only_unpaired_2 = False
        empty_replacement = None
        ignore_case = False
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: join [OPTION]... FILE1 FILE2\nJoin lines of two files on a common field.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "-1" and i + 1 < len(args):
                i += 1
                try:
                    field1 = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"join: invalid field number: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg == "-2" and i + 1 < len(args):
                i += 1
                try:
                    field2 = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"join: invalid field number: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg == "-t" and i + 1 < len(args):
                i += 1
                separator = args[i]
            elif arg.startswith("-t"):
                separator = arg[2:]
            elif arg == "-a" and i + 1 < len(args):
                i += 1
                if args[i] == "1":
                    print_unpaired_1 = True
                elif args[i] == "2":
                    print_unpaired_2 = True
            elif arg == "-v" and i + 1 < len(args):
                i += 1
                if args[i] == "1":
                    only_unpaired_1 = True
                elif args[i] == "2":
                    only_unpaired_2 = True
            elif arg == "-e" and i + 1 < len(args):
                i += 1
                empty_replacement = args[i]
            elif arg == "-o" and i + 1 < len(args):
                i += 1
                output_format = args[i]
            elif arg in ("-i", "--ignore-case"):
                ignore_case = True
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"join: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        if len(files) < 2:
            return ExecResult(
                stdout="",
                stderr="join: missing operand\n",
                exit_code=1,
            )

        file1, file2 = files[0], files[1]

        # Read files
        try:
            if file1 == "-":
                content1 = ctx.stdin
            else:
                path1 = ctx.fs.resolve_path(ctx.cwd, file1)
                content1 = await ctx.fs.read_file(path1)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"join: {file1}: No such file or directory\n",
                exit_code=1,
            )

        try:
            if file2 == "-":
                content2 = ctx.stdin
            else:
                path2 = ctx.fs.resolve_path(ctx.cwd, file2)
                content2 = await ctx.fs.read_file(path2)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"join: {file2}: No such file or directory\n",
                exit_code=1,
            )

        lines1 = content1.rstrip("\n").split("\n") if content1.strip() else []
        lines2 = content2.rstrip("\n").split("\n") if content2.strip() else []

        result = self._join(
            lines1, lines2, field1, field2, separator, output_format,
            print_unpaired_1, print_unpaired_2, only_unpaired_1, only_unpaired_2,
            empty_replacement, ignore_case
        )
        return ExecResult(stdout=result, stderr="", exit_code=0)

    def _join(
        self,
        lines1: list[str],
        lines2: list[str],
        field1: int,
        field2: int,
        separator: str | None,
        output_format: str | None,
        print_unpaired_1: bool,
        print_unpaired_2: bool,
        only_unpaired_1: bool,
        only_unpaired_2: bool,
        empty_replacement: str | None,
        ignore_case: bool,
    ) -> str:
        """Join two lists of lines."""
        sep = separator if separator else " "

        # Parse lines into fields
        def parse_line(line: str) -> list[str]:
            if separator:
                return line.split(separator)
            return line.split()

        def get_key(fields: list[str], field_num: int) -> str:
            if field_num <= 0 or field_num > len(fields):
                return ""
            key = fields[field_num - 1]
            return key.lower() if ignore_case else key

        # Build index for file2
        index2: dict[str, list[tuple[int, list[str]]]] = {}
        for idx, line in enumerate(lines2):
            fields = parse_line(line)
            key = get_key(fields, field2)
            if key not in index2:
                index2[key] = []
            index2[key].append((idx, fields))

        result_lines = []
        matched2 = set()

        # Process file1
        for line1 in lines1:
            fields1 = parse_line(line1)
            key1 = get_key(fields1, field1)

            if key1 in index2:
                for idx2, fields2 in index2[key1]:
                    matched2.add(idx2)
                    if not only_unpaired_1 and not only_unpaired_2:
                        output = self._format_output(
                            key1, fields1, fields2, field1, field2,
                            sep, output_format, empty_replacement
                        )
                        result_lines.append(output)
            else:
                if print_unpaired_1 or only_unpaired_1:
                    result_lines.append(sep.join(fields1))

        # Print unmatched from file2
        if print_unpaired_2 or only_unpaired_2:
            for idx, line2 in enumerate(lines2):
                if idx not in matched2:
                    fields2 = parse_line(line2)
                    result_lines.append(sep.join(fields2))

        if result_lines:
            return "\n".join(result_lines) + "\n"
        return ""

    def _format_output(
        self,
        key: str,
        fields1: list[str],
        fields2: list[str],
        field1: int,
        field2: int,
        sep: str,
        output_format: str | None,
        empty_replacement: str | None,
    ) -> str:
        """Format the output line."""
        if output_format:
            # Parse output format like "1.1,2.2,1.3"
            parts = []
            for spec in output_format.split(","):
                spec = spec.strip()
                if spec == "0":
                    parts.append(key)
                elif "." in spec:
                    file_num, field_num = spec.split(".")
                    file_num = int(file_num)
                    field_num = int(field_num)
                    if file_num == 1:
                        if field_num <= len(fields1):
                            parts.append(fields1[field_num - 1])
                        elif empty_replacement:
                            parts.append(empty_replacement)
                    elif file_num == 2:
                        if field_num <= len(fields2):
                            parts.append(fields2[field_num - 1])
                        elif empty_replacement:
                            parts.append(empty_replacement)
            return sep.join(parts)
        else:
            # Default: key + other fields from both files
            parts = [key]
            for i, f in enumerate(fields1):
                if i + 1 != field1:
                    parts.append(f)
            for i, f in enumerate(fields2):
                if i + 1 != field2:
                    parts.append(f)
            return sep.join(parts)
