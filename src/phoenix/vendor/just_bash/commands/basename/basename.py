"""Basename command implementation."""

import os
from ...types import CommandContext, ExecResult


class BasenameCommand:
    """The basename command."""

    name = "basename"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the basename command."""
        suffix = None
        multiple = False
        paths: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-s" and i + 1 < len(args):
                i += 1
                suffix = args[i]
            elif arg.startswith("--suffix="):
                suffix = arg[9:]
            elif arg == "-a" or arg == "--multiple":
                multiple = True
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: basename NAME [SUFFIX]\n       basename OPTION... NAME...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                paths.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"basename: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                paths.append(arg)
            i += 1

        if not paths:
            return ExecResult(
                stdout="",
                stderr="basename: missing operand\n",
                exit_code=1,
            )

        # If not multiple mode and exactly 2 args, second is suffix
        if not multiple and not suffix and len(paths) == 2:
            suffix = paths[1]
            paths = [paths[0]]

        results = []
        for path in paths:
            base = os.path.basename(path.rstrip("/"))
            if not base:
                base = "/"
            if suffix and base.endswith(suffix):
                base = base[:-len(suffix)]
            results.append(base)

        return ExecResult(
            stdout="\n".join(results) + "\n",
            stderr="",
            exit_code=0,
        )
