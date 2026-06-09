"""Fold command implementation."""

from ...types import CommandContext, ExecResult


class FoldCommand:
    """The fold command - wrap lines to fit in specified width."""

    name = "fold"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the fold command."""
        width = 80
        break_spaces = False
        count_bytes = False
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: fold [OPTION]... [FILE]...\nWrap lines to fit in specified width.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg in ("-s", "--spaces"):
                break_spaces = True
            elif arg in ("-b", "--bytes"):
                count_bytes = True
            elif arg == "-w" and i + 1 < len(args):
                i += 1
                try:
                    width = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"fold: invalid width: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-w"):
                try:
                    width = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"fold: invalid width: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("--width="):
                try:
                    width = int(arg[8:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"fold: invalid width: '{arg[8:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                # Could be -N for width
                try:
                    width = int(arg[1:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"fold: invalid option -- '{arg[1]}'\n",
                        exit_code=1,
                    )
            else:
                files.append(arg)
            i += 1

        if width <= 0:
            return ExecResult(
                stdout="",
                stderr="fold: width must be greater than 0\n",
                exit_code=1,
            )

        # Read from stdin if no files
        if not files:
            content = ctx.stdin
            result = self._fold_content(content, width, break_spaces)
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

                result = self._fold_content(content, width, break_spaces)
                stdout_parts.append(result)

            except FileNotFoundError:
                stderr += f"fold: {file}: No such file or directory\n"
                exit_code = 1

        return ExecResult(stdout="".join(stdout_parts), stderr=stderr, exit_code=exit_code)

    def _fold_content(self, content: str, width: int, break_spaces: bool) -> str:
        """Fold content to specified width."""
        lines = content.split("\n")
        result_lines = []

        for line in lines:
            result_lines.extend(self._fold_line(line, width, break_spaces))

        return "\n".join(result_lines)

    def _fold_line(self, line: str, width: int, break_spaces: bool) -> list[str]:
        """Fold a single line."""
        if len(line) <= width:
            return [line]

        result = []

        if break_spaces:
            # Break at spaces when possible
            current = ""
            for word in line.split(" "):
                if not current:
                    current = word
                elif len(current) + 1 + len(word) <= width:
                    current += " " + word
                else:
                    # Current line is full
                    if len(current) > width:
                        # Word itself is too long, break it
                        while len(current) > width:
                            result.append(current[:width])
                            current = current[width:]
                    if current:
                        result.append(current)
                    current = word

            # Handle remaining content
            while len(current) > width:
                result.append(current[:width])
                current = current[width:]
            if current:
                result.append(current)
        else:
            # Simple character-based folding
            while len(line) > width:
                result.append(line[:width])
                line = line[width:]
            if line:
                result.append(line)

        return result if result else [""]
