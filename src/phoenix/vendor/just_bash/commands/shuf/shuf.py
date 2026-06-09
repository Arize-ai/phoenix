"""Shuf command implementation.

Usage: shuf [OPTION]... [FILE]
   or: shuf -e [OPTION]... [ARG]...
   or: shuf -i LO-HI [OPTION]...

Write a random permutation of the input lines to standard output.

Options:
  -e, --echo              treat each ARG as an input line
  -i, --input-range=LO-HI treat each number LO through HI as an input line
  -n, --head-count=COUNT  output at most COUNT lines
  -o, --output=FILE       write result to FILE instead of standard output
  -r, --repeat            output lines can be repeated (requires -n)
  --random-source=FILE    get random bytes from FILE
"""

import random
from ...types import CommandContext, ExecResult


class ShufCommand:
    """The shuf command."""

    name = "shuf"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the shuf command."""
        # Parse arguments
        echo_mode = False
        input_range = None
        head_count = None
        output_file = None
        repeat = False
        random_source = None
        input_args: list[str] = []
        input_file = None

        i = 0
        while i < len(args):
            arg = args[i]

            if arg in ("-e", "--echo"):
                echo_mode = True
            elif arg in ("-r", "--repeat"):
                repeat = True
            elif arg == "-n":
                if i + 1 >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="shuf: option requires an argument -- 'n'\n",
                        exit_code=1,
                    )
                i += 1
                try:
                    head_count = int(args[i])
                    if head_count < 0:
                        raise ValueError()
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"shuf: invalid line count: '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-n"):
                try:
                    head_count = int(arg[2:])
                    if head_count < 0:
                        raise ValueError()
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"shuf: invalid line count: '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("--head-count="):
                try:
                    head_count = int(arg[13:])
                    if head_count < 0:
                        raise ValueError()
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"shuf: invalid line count: '{arg[13:]}'\n",
                        exit_code=1,
                    )
            elif arg == "-i":
                if i + 1 >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="shuf: option requires an argument -- 'i'\n",
                        exit_code=1,
                    )
                i += 1
                input_range = args[i]
            elif arg.startswith("-i"):
                input_range = arg[2:]
            elif arg.startswith("--input-range="):
                input_range = arg[14:]
            elif arg == "-o":
                if i + 1 >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="shuf: option requires an argument -- 'o'\n",
                        exit_code=1,
                    )
                i += 1
                output_file = args[i]
            elif arg.startswith("-o"):
                output_file = arg[2:]
            elif arg.startswith("--output="):
                output_file = arg[9:]
            elif arg.startswith("--random-source="):
                random_source = arg[16:]
            elif arg == "--random-source":
                if i + 1 >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="shuf: option requires an argument -- 'random-source'\n",
                        exit_code=1,
                    )
                i += 1
                random_source = args[i]
            elif arg.startswith("-") and len(arg) > 1 and arg != "-":
                return ExecResult(
                    stdout="",
                    stderr=f"shuf: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                if echo_mode:
                    input_args.append(arg)
                elif input_file is None:
                    input_file = arg
                else:
                    input_args.append(arg)

            i += 1

        # Set up random generator
        rng = random.Random()
        if random_source:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, random_source)
                seed_data = await ctx.fs.read_file(path)
                # Use hash of file content as seed
                rng.seed(hash(seed_data))
            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"shuf: {random_source}: No such file or directory\n",
                    exit_code=1,
                )

        # Get input lines
        lines: list[str] = []

        if input_range:
            # Parse range LO-HI
            if "-" not in input_range:
                return ExecResult(
                    stdout="",
                    stderr=f"shuf: invalid input range: '{input_range}'\n",
                    exit_code=1,
                )
            parts = input_range.split("-", 1)
            try:
                lo = int(parts[0])
                hi = int(parts[1])
            except ValueError:
                return ExecResult(
                    stdout="",
                    stderr=f"shuf: invalid input range: '{input_range}'\n",
                    exit_code=1,
                )
            if lo > hi:
                return ExecResult(
                    stdout="",
                    stderr=f"shuf: invalid input range: '{input_range}'\n",
                    exit_code=1,
                )
            lines = [str(n) for n in range(lo, hi + 1)]
        elif echo_mode:
            lines = input_args
        else:
            # Read from file or stdin
            if input_file:
                try:
                    path = ctx.fs.resolve_path(ctx.cwd, input_file)
                    content = await ctx.fs.read_file(path)
                except FileNotFoundError:
                    return ExecResult(
                        stdout="",
                        stderr=f"shuf: {input_file}: No such file or directory\n",
                        exit_code=1,
                    )
            else:
                content = ctx.stdin

            if content:
                # Split into lines, preserving empty lines but removing final newline
                if content.endswith("\n"):
                    content = content[:-1]
                if content:
                    lines = content.split("\n")

        # Handle empty input
        if not lines:
            if output_file:
                path = ctx.fs.resolve_path(ctx.cwd, output_file)
                await ctx.fs.write_file(path, "")
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Generate output
        output_lines: list[str] = []

        if repeat:
            # With repeat, we can output more lines than input
            count = head_count if head_count is not None else len(lines)
            for _ in range(count):
                output_lines.append(rng.choice(lines))
        else:
            # Shuffle and optionally limit
            shuffled = lines.copy()
            rng.shuffle(shuffled)
            if head_count is not None:
                output_lines = shuffled[:head_count]
            else:
                output_lines = shuffled

        # Build output
        output = "\n".join(output_lines)
        if output:
            output += "\n"

        # Write to file or stdout
        if output_file:
            path = ctx.fs.resolve_path(ctx.cwd, output_file)
            await ctx.fs.write_file(path, output)
            return ExecResult(stdout="", stderr="", exit_code=0)

        return ExecResult(stdout=output, stderr="", exit_code=0)
