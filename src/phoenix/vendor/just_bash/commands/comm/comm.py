"""Comm command implementation."""

from ...types import CommandContext, ExecResult


class CommCommand:
    """The comm command - compare two sorted files line by line."""

    name = "comm"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the comm command."""
        suppress_col1 = False  # Lines unique to file1
        suppress_col2 = False  # Lines unique to file2
        suppress_col3 = False  # Lines common to both
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: comm [OPTION]... FILE1 FILE2\nCompare two sorted files line by line.\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "-1":
                suppress_col1 = True
            elif arg == "-2":
                suppress_col2 = True
            elif arg == "-3":
                suppress_col3 = True
            elif arg.startswith("-") and len(arg) > 1 and not arg.startswith("--"):
                # Handle combined flags like -12, -23, -13, -123
                for c in arg[1:]:
                    if c == "1":
                        suppress_col1 = True
                    elif c == "2":
                        suppress_col2 = True
                    elif c == "3":
                        suppress_col3 = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"comm: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            else:
                files.append(arg)
            i += 1

        if len(files) < 2:
            return ExecResult(
                stdout="",
                stderr="comm: missing operand\n",
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
                stderr=f"comm: {file1}: No such file or directory\n",
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
                stderr=f"comm: {file2}: No such file or directory\n",
                exit_code=1,
            )

        lines1 = content1.rstrip("\n").split("\n") if content1.strip() else []
        lines2 = content2.rstrip("\n").split("\n") if content2.strip() else []

        result = self._compare(lines1, lines2, suppress_col1, suppress_col2, suppress_col3)
        return ExecResult(stdout=result, stderr="", exit_code=0)

    def _compare(
        self,
        lines1: list[str],
        lines2: list[str],
        suppress_col1: bool,
        suppress_col2: bool,
        suppress_col3: bool,
    ) -> str:
        """Compare two sorted lists of lines."""
        result_lines = []
        i, j = 0, 0

        while i < len(lines1) or j < len(lines2):
            if i >= len(lines1):
                # Only file2 lines left (unique to file2 = column 2)
                if not suppress_col2:
                    prefix = ""
                    if not suppress_col1:
                        prefix += "\t"
                    result_lines.append(prefix + lines2[j])
                j += 1
            elif j >= len(lines2):
                # Only file1 lines left (unique to file1 = column 1)
                if not suppress_col1:
                    result_lines.append(lines1[i])
                i += 1
            elif lines1[i] < lines2[j]:
                # Line unique to file1 (column 1)
                if not suppress_col1:
                    result_lines.append(lines1[i])
                i += 1
            elif lines1[i] > lines2[j]:
                # Line unique to file2 (column 2)
                if not suppress_col2:
                    prefix = ""
                    if not suppress_col1:
                        prefix += "\t"
                    result_lines.append(prefix + lines2[j])
                j += 1
            else:
                # Lines are equal (common = column 3)
                if not suppress_col3:
                    prefix = ""
                    if not suppress_col1:
                        prefix += "\t"
                    if not suppress_col2:
                        prefix += "\t"
                    result_lines.append(prefix + lines1[i])
                i += 1
                j += 1

        if result_lines:
            return "\n".join(result_lines) + "\n"
        return ""
