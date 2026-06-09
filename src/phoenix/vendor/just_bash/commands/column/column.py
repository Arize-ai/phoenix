"""Column command implementation."""

from ...types import CommandContext, ExecResult


class ColumnCommand:
    """The column command - columnate lists."""

    name = "column"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the column command."""
        table_mode = False
        separator = None
        output_separator = "  "
        no_merge = False
        column_width = 80
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: column [OPTION]... [FILE]...\nColumnate lists.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg in ("-t", "--table"):
                table_mode = True
            elif arg in ("-n", "--no-merge"):
                no_merge = True
            elif arg == "-s" and i + 1 < len(args):
                i += 1
                separator = args[i]
            elif arg.startswith("-s"):
                separator = arg[2:]
            elif arg == "-o" and i + 1 < len(args):
                i += 1
                output_separator = args[i]
            elif arg.startswith("-o"):
                output_separator = arg[2:]
            elif arg == "-c" and i + 1 < len(args):
                i += 1
                try:
                    column_width = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"column: invalid column width: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-c"):
                try:
                    column_width = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"column: invalid column width: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"column: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        # Read content
        content = ""
        if not files:
            content = ctx.stdin
        else:
            parts = []
            for file in files:
                try:
                    if file == "-":
                        parts.append(ctx.stdin)
                    else:
                        path = ctx.fs.resolve_path(ctx.cwd, file)
                        parts.append(await ctx.fs.read_file(path))
                except FileNotFoundError:
                    return ExecResult(
                        stdout="",
                        stderr=f"column: {file}: No such file or directory\n",
                        exit_code=1,
                    )
            content = "".join(parts)

        if not content.strip():
            return ExecResult(stdout="", stderr="", exit_code=0)

        if table_mode:
            result = self._format_table(content, separator, output_separator, no_merge)
        else:
            result = self._format_columns(content, column_width)

        return ExecResult(stdout=result, stderr="", exit_code=0)

    def _format_table(
        self, content: str, separator: str | None, output_separator: str, no_merge: bool
    ) -> str:
        """Format content as a table."""
        lines = content.rstrip("\n").split("\n")
        rows: list[list[str]] = []

        for line in lines:
            if separator:
                if no_merge:
                    fields = line.split(separator)
                else:
                    fields = [f for f in line.split(separator) if f]
            else:
                if no_merge:
                    fields = line.split()
                else:
                    fields = line.split()
            rows.append(fields)

        if not rows:
            return ""

        # Calculate column widths
        max_cols = max(len(row) for row in rows)
        col_widths = [0] * max_cols

        for row in rows:
            for i, field in enumerate(row):
                if i < max_cols:
                    col_widths[i] = max(col_widths[i], len(field))

        # Format output
        result_lines = []
        for row in rows:
            formatted = []
            for i, field in enumerate(row):
                if i < len(row) - 1:
                    formatted.append(field.ljust(col_widths[i]))
                else:
                    formatted.append(field)
            result_lines.append(output_separator.join(formatted))

        return "\n".join(result_lines) + "\n"

    def _format_columns(self, content: str, width: int) -> str:
        """Format content as columns (fill mode)."""
        lines = content.rstrip("\n").split("\n")
        items = []
        for line in lines:
            items.extend(line.split())

        if not items:
            return ""

        # Find maximum item width
        max_item_width = max(len(item) for item in items)
        col_width = max_item_width + 2

        # Calculate number of columns
        num_cols = max(1, width // col_width)

        # Format output
        result_lines = []
        for i in range(0, len(items), num_cols):
            row_items = items[i:i + num_cols]
            formatted = []
            for j, item in enumerate(row_items):
                if j < len(row_items) - 1:
                    formatted.append(item.ljust(col_width))
                else:
                    formatted.append(item)
            result_lines.append("".join(formatted))

        return "\n".join(result_lines) + "\n"
