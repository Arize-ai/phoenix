"""Nl command implementation - number lines."""

from ...types import CommandContext, ExecResult


class NlCommand:
    """The nl command - number lines."""

    name = "nl"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the nl command."""
        body_style = "t"  # t=non-empty, a=all, n=none
        number_format = "rn"  # rn=right, ln=left, rz=right-zero
        width = 6
        separator = "\t"
        start_num = 1
        increment = 1
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-b" and i + 1 < len(args):
                i += 1
                body_style = args[i]
            elif arg.startswith("-b"):
                body_style = arg[2:]
            elif arg == "-n" and i + 1 < len(args):
                i += 1
                number_format = args[i]
            elif arg.startswith("-n"):
                number_format = arg[2:]
            elif arg == "-w" and i + 1 < len(args):
                i += 1
                try:
                    width = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"nl: invalid width: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-w"):
                try:
                    width = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"nl: invalid width: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg == "-s" and i + 1 < len(args):
                i += 1
                separator = args[i]
            elif arg.startswith("-s"):
                separator = arg[2:]
            elif arg == "-v" and i + 1 < len(args):
                i += 1
                try:
                    start_num = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"nl: invalid starting number: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-v"):
                try:
                    start_num = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"nl: invalid starting number: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg == "-i" and i + 1 < len(args):
                i += 1
                try:
                    increment = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"nl: invalid increment: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-i"):
                try:
                    increment = int(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"nl: invalid increment: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: nl [OPTION]... [FILE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"nl: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        # Validate body style
        if body_style not in ("a", "t", "n"):
            return ExecResult(
                stdout="",
                stderr=f"nl: invalid body numbering style: '{body_style}'\n",
                exit_code=1,
            )

        # Validate number format
        if number_format not in ("ln", "rn", "rz"):
            return ExecResult(
                stdout="",
                stderr=f"nl: invalid line number format: '{number_format}'\n",
                exit_code=1,
            )

        # Read content
        if files:
            content_parts = []
            for f in files:
                try:
                    path = ctx.fs.resolve_path(ctx.cwd, f)
                    content_parts.append(await ctx.fs.read_file(path))
                except FileNotFoundError:
                    return ExecResult(
                        stdout="",
                        stderr=f"nl: {f}: No such file or directory\n",
                        exit_code=1,
                    )
            content = "".join(content_parts)
        else:
            content = ctx.stdin

        if not content:
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Number lines
        lines = content.splitlines()
        output_lines = []
        line_num = start_num

        for line in lines:
            should_number = False
            if body_style == "a":
                should_number = True
            elif body_style == "t":
                should_number = bool(line.strip())
            # body_style == "n" means never number

            if should_number:
                if number_format == "ln":
                    num_str = str(line_num).ljust(width)
                elif number_format == "rz":
                    num_str = str(line_num).zfill(width)
                else:  # rn
                    num_str = str(line_num).rjust(width)
                output_lines.append(f"{num_str}{separator}{line}")
                line_num += increment
            else:
                output_lines.append(" " * width + separator + line)

        output = "\n".join(output_lines)
        if content.endswith("\n"):
            output += "\n"

        return ExecResult(stdout=output, stderr="", exit_code=0)
