"""Uniq command implementation.

Usage: uniq [OPTION]... [INPUT [OUTPUT]]

Filter adjacent matching lines from INPUT (or standard input),
writing to OUTPUT (or standard output).

Options:
  -c, --count           prefix lines by the number of occurrences
  -d, --repeated        only print duplicate lines, one for each group
  -D                    print all duplicate lines
  -i, --ignore-case     ignore differences in case when comparing
  -u, --unique          only print unique lines
  -s, --skip-chars=N    avoid comparing the first N characters
  -w, --check-chars=N   compare no more than N characters in lines
  -f, --skip-fields=N   avoid comparing the first N fields
"""

from ...types import CommandContext, ExecResult


class UniqCommand:
    """The uniq command."""

    name = "uniq"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the uniq command."""
        count = False
        repeated = False
        all_repeated = False
        ignore_case = False
        unique = False
        skip_chars = 0
        check_chars = 0  # 0 means no limit
        skip_fields = 0
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--count":
                    count = True
                elif arg == "--repeated":
                    repeated = True
                elif arg == "--ignore-case":
                    ignore_case = True
                elif arg == "--unique":
                    unique = True
                elif arg.startswith("--skip-chars="):
                    try:
                        skip_chars = int(arg[13:])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"uniq: invalid number of bytes to skip: '{arg[13:]}'\n",
                            exit_code=1,
                        )
                elif arg.startswith("--check-chars="):
                    try:
                        check_chars = int(arg[14:])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"uniq: invalid number of bytes to compare: '{arg[14:]}'\n",
                            exit_code=1,
                        )
                elif arg.startswith("--skip-fields="):
                    try:
                        skip_fields = int(arg[14:])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"uniq: invalid number of fields to skip: '{arg[14:]}'\n",
                            exit_code=1,
                        )
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"uniq: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "c":
                        count = True
                    elif c == "d":
                        repeated = True
                    elif c == "D":
                        all_repeated = True
                    elif c == "i":
                        ignore_case = True
                    elif c == "u":
                        unique = True
                    elif c == "s":
                        # -s requires a value
                        if j + 1 < len(arg):
                            try:
                                skip_chars = int(arg[j + 1:])
                            except ValueError:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"uniq: invalid number of bytes to skip\n",
                                    exit_code=1,
                                )
                            break
                        elif i + 1 < len(args):
                            i += 1
                            try:
                                skip_chars = int(args[i])
                            except ValueError:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"uniq: invalid number of bytes to skip: '{args[i]}'\n",
                                    exit_code=1,
                                )
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="uniq: option requires an argument -- 's'\n",
                                exit_code=1,
                            )
                    elif c == "w":
                        # -w requires a value
                        if j + 1 < len(arg):
                            try:
                                check_chars = int(arg[j + 1:])
                            except ValueError:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"uniq: invalid number of bytes to compare\n",
                                    exit_code=1,
                                )
                            break
                        elif i + 1 < len(args):
                            i += 1
                            try:
                                check_chars = int(args[i])
                            except ValueError:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"uniq: invalid number of bytes to compare: '{args[i]}'\n",
                                    exit_code=1,
                                )
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="uniq: option requires an argument -- 'w'\n",
                                exit_code=1,
                            )
                    elif c == "f":
                        # -f requires a value
                        if j + 1 < len(arg):
                            try:
                                skip_fields = int(arg[j + 1:])
                            except ValueError:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"uniq: invalid number of fields to skip\n",
                                    exit_code=1,
                                )
                            break
                        elif i + 1 < len(args):
                            i += 1
                            try:
                                skip_fields = int(args[i])
                            except ValueError:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"uniq: invalid number of fields to skip: '{args[i]}'\n",
                                    exit_code=1,
                                )
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="uniq: option requires an argument -- 'f'\n",
                                exit_code=1,
                            )
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"uniq: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            else:
                files.append(arg)
            i += 1

        # Get input
        if len(files) == 0:
            content = ctx.stdin
        elif files[0] == "-":
            content = ctx.stdin
        else:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, files[0])
                content = await ctx.fs.read_file(path)
            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"uniq: {files[0]}: No such file or directory\n",
                    exit_code=1,
                )

        # Process lines
        lines = content.split("\n")
        # Remove trailing empty line if present
        if lines and lines[-1] == "":
            lines = lines[:-1]

        def get_compare_key(line: str) -> str:
            """Get the comparison key for a line."""
            # Skip fields first
            if skip_fields > 0:
                parts = line.split()
                line = " ".join(parts[skip_fields:]) if len(parts) > skip_fields else ""

            # Skip characters
            if skip_chars > 0:
                line = line[skip_chars:]

            # Limit check chars
            if check_chars > 0:
                line = line[:check_chars]

            if ignore_case:
                line = line.lower()

            return line

        # Group adjacent lines
        groups: list[tuple[int, str]] = []  # (count, original_line)
        prev_key = None
        prev_line = None
        count_val = 0

        for line in lines:
            key = get_compare_key(line)
            if key == prev_key:
                count_val += 1
                if all_repeated:
                    groups.append((1, line))
            else:
                if prev_line is not None:
                    if not all_repeated:
                        groups.append((count_val, prev_line))
                prev_key = key
                prev_line = line
                count_val = 1
                if all_repeated:
                    # We'll add it later if it has duplicates
                    pass

        # Don't forget the last group
        if prev_line is not None and not all_repeated:
            groups.append((count_val, prev_line))

        # For all_repeated (-D), we need to rebuild groups differently
        if all_repeated:
            groups = []
            prev_key = None
            current_group: list[str] = []

            for line in lines:
                key = get_compare_key(line)
                if key == prev_key:
                    current_group.append(line)
                else:
                    # Output previous group if it had duplicates
                    if len(current_group) > 1:
                        for l in current_group:
                            groups.append((1, l))
                    current_group = [line]
                    prev_key = key

            # Last group
            if len(current_group) > 1:
                for l in current_group:
                    groups.append((1, l))

        # Filter based on options
        output_lines: list[str] = []
        for cnt, line in groups:
            if repeated and cnt < 2:
                continue
            if unique and cnt > 1:
                continue

            if count:
                output_lines.append(f"{cnt:7d} {line}")
            else:
                output_lines.append(line)

        # Generate output
        stdout = "\n".join(output_lines)
        if output_lines:
            stdout += "\n"

        # Write to output file if specified
        if len(files) > 1 and files[1] != "-":
            try:
                path = ctx.fs.resolve_path(ctx.cwd, files[1])
                await ctx.fs.write_file(path, stdout)
                return ExecResult(stdout="", stderr="", exit_code=0)
            except Exception as e:
                return ExecResult(
                    stdout="",
                    stderr=f"uniq: {files[1]}: {e}\n",
                    exit_code=1,
                )

        return ExecResult(stdout=stdout, stderr="", exit_code=0)
