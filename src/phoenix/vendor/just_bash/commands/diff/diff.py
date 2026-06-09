"""Diff command implementation."""

import difflib
from ...types import CommandContext, ExecResult


class DiffCommand:
    """The diff command."""

    name = "diff"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the diff command."""
        brief = False
        report_identical = False
        ignore_case = False
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg in ("-q", "--brief"):
                brief = True
            elif arg in ("-s", "--report-identical-files"):
                report_identical = True
            elif arg in ("-i", "--ignore-case"):
                ignore_case = True
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: diff [OPTION]... FILES\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1 and arg != "-":
                return ExecResult(
                    stdout="",
                    stderr=f"diff: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        if len(files) < 2:
            return ExecResult(
                stdout="",
                stderr="diff: missing operand\n",
                exit_code=2,
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
                stderr=f"diff: {file1}: No such file or directory\n",
                exit_code=2,
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
                stderr=f"diff: {file2}: No such file or directory\n",
                exit_code=2,
            )

        # Compare
        if ignore_case:
            compare1 = content1.lower()
            compare2 = content2.lower()
        else:
            compare1 = content1
            compare2 = content2

        if compare1 == compare2:
            if report_identical:
                return ExecResult(
                    stdout=f"Files {file1} and {file2} are identical\n",
                    stderr="",
                    exit_code=0,
                )
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Files differ
        if brief:
            return ExecResult(
                stdout=f"Files {file1} and {file2} differ\n",
                stderr="",
                exit_code=1,
            )

        # Generate unified diff
        lines1 = content1.splitlines(keepends=True)
        lines2 = content2.splitlines(keepends=True)

        diff = difflib.unified_diff(
            lines1, lines2,
            fromfile=file1, tofile=file2,
        )

        output = "".join(diff)
        return ExecResult(stdout=output, stderr="", exit_code=1)
