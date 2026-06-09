"""Sleep command implementation."""

import asyncio
import re
from ...types import CommandContext, ExecResult


class SleepCommand:
    """The sleep command."""

    name = "sleep"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the sleep command."""
        if not args:
            return ExecResult(
                stdout="",
                stderr="sleep: missing operand\n",
                exit_code=1,
            )

        if "--help" in args:
            return ExecResult(
                stdout="Usage: sleep NUMBER[SUFFIX]...\n",
                stderr="",
                exit_code=0,
            )

        total_seconds = 0.0

        for arg in args:
            try:
                seconds = self._parse_duration(arg)
                total_seconds += seconds
            except ValueError as e:
                return ExecResult(
                    stdout="",
                    stderr=f"sleep: invalid time interval '{arg}'\n",
                    exit_code=1,
                )

        await asyncio.sleep(total_seconds)
        return ExecResult(stdout="", stderr="", exit_code=0)

    def _parse_duration(self, s: str) -> float:
        """Parse a duration string like '1.5', '2s', '1m', '1h', '1d'."""
        match = re.match(r"^(\d+(?:\.\d+)?)(s|m|h|d)?$", s)
        if not match:
            raise ValueError(f"Invalid duration: {s}")

        value = float(match.group(1))
        suffix = match.group(2)

        if suffix == "m":
            value *= 60
        elif suffix == "h":
            value *= 3600
        elif suffix == "d":
            value *= 86400
        # 's' or no suffix = seconds

        return value
