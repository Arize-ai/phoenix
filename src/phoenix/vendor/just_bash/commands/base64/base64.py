"""Base64 command implementation.

Usage: base64 [OPTION]... [FILE]

Base64 encode or decode FILE, or standard input.

Options:
  -d, --decode    decode data
  -w, --wrap=COLS wrap encoded lines after COLS characters (default 76)
"""

import base64 as b64
from ...types import CommandContext, ExecResult


class Base64Command:
    """The base64 command."""

    name = "base64"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the base64 command."""
        decode = False
        wrap_cols = 76
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--decode":
                    decode = True
                elif arg.startswith("--wrap="):
                    try:
                        wrap_cols = int(arg[7:])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"base64: invalid wrap size: '{arg[7:]}'\n",
                            exit_code=1,
                        )
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"base64: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "d":
                        decode = True
                    elif c == "w":
                        # -w requires a value
                        if j + 1 < len(arg):
                            try:
                                wrap_cols = int(arg[j + 1:])
                            except ValueError:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"base64: invalid wrap size\n",
                                    exit_code=1,
                                )
                            break
                        elif i + 1 < len(args):
                            i += 1
                            try:
                                wrap_cols = int(args[i])
                            except ValueError:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"base64: invalid wrap size: '{args[i]}'\n",
                                    exit_code=1,
                                )
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="base64: option requires an argument -- 'w'\n",
                                exit_code=1,
                            )
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"base64: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            else:
                files.append(arg)
            i += 1

        # Default to stdin
        if not files:
            files = ["-"]

        stdout = ""
        stderr = ""
        exit_code = 0

        for f in files:
            try:
                if f == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, f)
                    content = await ctx.fs.read_file(path)

                if decode:
                    # Decode base64
                    # Strip whitespace
                    content = "".join(content.split())
                    try:
                        decoded = b64.b64decode(content)
                        stdout += decoded.decode("utf-8", errors="replace")
                    except Exception as e:
                        stderr += f"base64: invalid input\n"
                        exit_code = 1
                else:
                    # Encode to base64
                    encoded = b64.b64encode(content.encode("utf-8")).decode("utf-8")
                    # Wrap lines
                    if wrap_cols > 0:
                        lines = [encoded[i:i + wrap_cols] for i in range(0, len(encoded), wrap_cols)]
                        stdout += "\n".join(lines) + "\n"
                    else:
                        stdout += encoded

            except FileNotFoundError:
                stderr += f"base64: {f}: No such file or directory\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
