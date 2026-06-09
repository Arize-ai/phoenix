"""Expand and unexpand command implementations."""

from ...types import CommandContext, ExecResult


class ExpandCommand:
    """The expand command - convert tabs to spaces."""

    name = "expand"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the expand command."""
        tab_width = 8
        tab_stops: list[int] = []
        initial_only = False
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: expand [OPTION]... [FILE]...\nConvert tabs to spaces.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg in ("-i", "--initial"):
                initial_only = True
            elif arg == "-t" and i + 1 < len(args):
                i += 1
                tab_stops = self._parse_tab_stops(args[i])
                if tab_stops:
                    tab_width = tab_stops[0]
            elif arg.startswith("-t"):
                tab_stops = self._parse_tab_stops(arg[2:])
                if tab_stops:
                    tab_width = tab_stops[0]
            elif arg.startswith("--tabs="):
                tab_stops = self._parse_tab_stops(arg[7:])
                if tab_stops:
                    tab_width = tab_stops[0]
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                # Could be -N for tab width
                try:
                    tab_width = int(arg[1:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"expand: invalid option -- '{arg[1]}'\n",
                        exit_code=1,
                    )
            else:
                files.append(arg)
            i += 1

        if tab_width <= 0:
            return ExecResult(
                stdout="",
                stderr="expand: tab size must be greater than 0\n",
                exit_code=1,
            )

        # Read from stdin if no files
        if not files:
            content = ctx.stdin
            result = self._expand_content(content, tab_width, tab_stops, initial_only)
            return ExecResult(stdout=result, stderr="", exit_code=0)

        stdout_parts = []
        stderr = ""
        exit_code = 0

        for file in files:
            try:
                if file == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file(path)

                result = self._expand_content(content, tab_width, tab_stops, initial_only)
                stdout_parts.append(result)

            except FileNotFoundError:
                stderr += f"expand: {file}: No such file or directory\n"
                exit_code = 1

        return ExecResult(stdout="".join(stdout_parts), stderr=stderr, exit_code=exit_code)

    def _parse_tab_stops(self, s: str) -> list[int]:
        """Parse tab stop specification."""
        if not s:
            return []
        try:
            if "," in s:
                return [int(x) for x in s.split(",") if x]
            return [int(s)]
        except ValueError:
            return []

    def _expand_content(
        self, content: str, tab_width: int, tab_stops: list[int], initial_only: bool
    ) -> str:
        """Expand tabs in content."""
        lines = content.split("\n")
        result_lines = []

        for line in lines:
            result_lines.append(self._expand_line(line, tab_width, tab_stops, initial_only))

        return "\n".join(result_lines)

    def _expand_line(
        self, line: str, tab_width: int, tab_stops: list[int], initial_only: bool
    ) -> str:
        """Expand tabs in a single line."""
        result = []
        column = 0
        in_initial = True

        for char in line:
            if char == "\t":
                if initial_only and not in_initial:
                    result.append(char)
                    column += 1
                else:
                    # Calculate spaces needed to reach next tab stop
                    if tab_stops and len(tab_stops) > 1:
                        # Find next tab stop
                        next_stop = None
                        for stop in tab_stops:
                            if stop > column:
                                next_stop = stop
                                break
                        if next_stop is None:
                            # Use last interval
                            interval = tab_stops[-1] - tab_stops[-2] if len(tab_stops) > 1 else tab_width
                            next_stop = column + interval - (column - tab_stops[-1]) % interval
                        spaces = next_stop - column
                    else:
                        spaces = tab_width - (column % tab_width)
                    result.append(" " * spaces)
                    column += spaces
            else:
                if char != " ":
                    in_initial = False
                result.append(char)
                column += 1

        return "".join(result)


class UnexpandCommand:
    """The unexpand command - convert spaces to tabs."""

    name = "unexpand"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the unexpand command."""
        tab_width = 8
        all_spaces = False
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: unexpand [OPTION]... [FILE]...\nConvert spaces to tabs.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg in ("-a", "--all"):
                all_spaces = True
            elif arg == "-t" and i + 1 < len(args):
                i += 1
                try:
                    tab_width = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"unexpand: invalid tab size: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-t"):
                try:
                    tab_width = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"unexpand: invalid tab size: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("--tabs="):
                try:
                    tab_width = int(arg[7:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"unexpand: invalid tab size: '{arg[7:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"unexpand: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        if tab_width <= 0:
            return ExecResult(
                stdout="",
                stderr="unexpand: tab size must be greater than 0\n",
                exit_code=1,
            )

        # Read from stdin if no files
        if not files:
            content = ctx.stdin
            result = self._unexpand_content(content, tab_width, all_spaces)
            return ExecResult(stdout=result, stderr="", exit_code=0)

        stdout_parts = []
        stderr = ""
        exit_code = 0

        for file in files:
            try:
                if file == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file(path)

                result = self._unexpand_content(content, tab_width, all_spaces)
                stdout_parts.append(result)

            except FileNotFoundError:
                stderr += f"unexpand: {file}: No such file or directory\n"
                exit_code = 1

        return ExecResult(stdout="".join(stdout_parts), stderr=stderr, exit_code=exit_code)

    def _unexpand_content(self, content: str, tab_width: int, all_spaces: bool) -> str:
        """Unexpand spaces in content."""
        lines = content.split("\n")
        result_lines = []

        for line in lines:
            result_lines.append(self._unexpand_line(line, tab_width, all_spaces))

        return "\n".join(result_lines)

    def _unexpand_line(self, line: str, tab_width: int, all_spaces: bool) -> str:
        """Unexpand spaces in a single line."""
        if not line:
            return line

        result = []
        space_count = 0
        column = 0
        in_leading = True

        for char in line:
            if char == " ":
                space_count += 1
                column += 1

                # Check if we've reached a tab stop
                if column % tab_width == 0:
                    if in_leading or all_spaces:
                        result.append("\t")
                    else:
                        result.append(" " * space_count)
                    space_count = 0
            else:
                # Flush pending spaces
                if space_count > 0:
                    result.append(" " * space_count)
                    space_count = 0
                result.append(char)
                column += 1
                if char != " ":
                    in_leading = False

        # Flush any remaining spaces
        if space_count > 0:
            result.append(" " * space_count)

        return "".join(result)
