"""Dirname command implementation."""

import os
from ...types import CommandContext, ExecResult


class DirnameCommand:
    """The dirname command."""

    name = "dirname"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the dirname command."""
        paths: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: dirname [OPTION] NAME...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                paths.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"dirname: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                paths.append(arg)
            i += 1

        if not paths:
            return ExecResult(
                stdout="",
                stderr="dirname: missing operand\n",
                exit_code=1,
            )

        results = []
        for path in paths:
            dirname = os.path.dirname(path.rstrip("/"))
            if not dirname:
                dirname = "."
            results.append(dirname)

        return ExecResult(
            stdout="\n".join(results) + "\n",
            stderr="",
            exit_code=0,
        )
