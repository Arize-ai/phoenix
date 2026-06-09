"""Tac command implementation.

Usage: tac [OPTION]... [FILE]...

Concatenate and print files in reverse.

Options:
  -b, --before             attach the separator before instead of after
  -r, --regex              interpret the separator as a regular expression
  -s, --separator=STRING   use STRING as the separator instead of newline
"""

import re
from ...types import CommandContext, ExecResult


class TacCommand:
    """The tac command - reverse lines."""

    name = "tac"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the tac command."""
        files: list[str] = []
        separator = "\n"
        before = False
        regex_mode = False

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: tac [OPTION]... [FILE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--before":
                    before = True
                elif arg == "--regex":
                    regex_mode = True
                elif arg.startswith("--separator="):
                    separator = arg[12:]
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"tac: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and len(arg) > 1:
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "b":
                        before = True
                    elif c == "r":
                        regex_mode = True
                    elif c == "s":
                        # -s requires a value
                        if j + 1 < len(arg):
                            separator = arg[j + 1:]
                            break
                        elif i + 1 < len(args):
                            i += 1
                            separator = args[i]
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="tac: option requires an argument -- 's'\n",
                                exit_code=1,
                            )
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"tac: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            else:
                files.append(arg)
            i += 1

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
                        stderr=f"tac: {f}: No such file or directory\n",
                        exit_code=1,
                    )
            content = "".join(content_parts)
        else:
            content = ctx.stdin

        if not content:
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Split content by separator
        if regex_mode:
            try:
                pattern = re.compile(separator)
                # Split and keep track of what separators were matched
                records = pattern.split(content)
                # Find all separator matches
                separators = pattern.findall(content)
            except re.error as e:
                return ExecResult(
                    stdout="",
                    stderr=f"tac: invalid regex: {e}\n",
                    exit_code=1,
                )
        else:
            # Literal separator split
            records = content.split(separator)
            # All separators are the same literal
            separators = [separator] * (len(records) - 1) if len(records) > 1 else []

        # Handle trailing empty record (from trailing separator)
        trailing_empty = records and records[-1] == ""
        if trailing_empty:
            records = records[:-1]

        # Reverse the records
        records.reverse()

        # Reconstruct output with separators
        if not before:
            # Normal mode: separator follows each record (except last)
            output_parts = []
            for i, record in enumerate(records):
                output_parts.append(record)
                if i < len(records) - 1:
                    output_parts.append(separators[0] if separators else separator)
            # Add trailing separator if original had one
            if trailing_empty:
                output_parts.append(separators[0] if separators else separator)
            output = "".join(output_parts)
        else:
            # -b mode: separator precedes each record (except first)
            output_parts = []
            for i, record in enumerate(records):
                if i > 0:
                    output_parts.append(separators[0] if separators else separator)
                output_parts.append(record)
            output = "".join(output_parts)

        return ExecResult(stdout=output, stderr="", exit_code=0)
