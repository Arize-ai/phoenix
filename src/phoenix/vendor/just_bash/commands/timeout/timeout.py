"""Timeout command implementation."""

import asyncio
import re
from ...types import CommandContext, ExecResult


class TimeoutCommand:
    """The timeout command."""

    name = "timeout"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the timeout command."""
        duration = None
        kill_after = None
        signal = "TERM"
        preserve_status = False
        command: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-k" and i + 1 < len(args):
                i += 1
                try:
                    kill_after = self._parse_duration(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"timeout: invalid time interval '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-k"):
                try:
                    kill_after = self._parse_duration(arg[2:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"timeout: invalid time interval '{arg[2:]}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("--kill-after="):
                try:
                    kill_after = self._parse_duration(arg[13:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"timeout: invalid time interval '{arg[13:]}'\n",
                        exit_code=1,
                    )
            elif arg == "--kill-after" and i + 1 < len(args):
                i += 1
                try:
                    kill_after = self._parse_duration(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"timeout: invalid time interval '{args[i]}'\n",
                        exit_code=1,
                    )
            elif arg == "-s" and i + 1 < len(args):
                i += 1
                signal = args[i]
            elif arg.startswith("-s"):
                signal = arg[2:]
            elif arg.startswith("--signal="):
                signal = arg[9:]
            elif arg == "--signal" and i + 1 < len(args):
                i += 1
                signal = args[i]
            elif arg == "--preserve-status":
                preserve_status = True
            elif arg == "--foreground":
                pass  # Ignore
            elif arg == "--help":
                return ExecResult(
                    stdout=(
                        "Usage: timeout [OPTION] DURATION COMMAND [ARG]...\n"
                        "Start COMMAND, and kill it if still running after DURATION.\n\n"
                        "Options:\n"
                        "  -k, --kill-after=DURATION  send KILL signal after DURATION\n"
                        "  -s, --signal=SIGNAL        send this signal on timeout (default: TERM)\n"
                        "      --preserve-status      exit with the same status as COMMAND\n"
                        "      --foreground           run command in foreground\n"
                        "      --help                 display this help and exit\n"
                    ),
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                # Rest are command args
                if duration is None and i + 1 < len(args):
                    i += 1
                    try:
                        duration = self._parse_duration(args[i])
                    except ValueError:
                        return ExecResult(
                            stdout="",
                            stderr=f"timeout: invalid duration '{args[i]}'\n",
                            exit_code=1,
                        )
                if i + 1 < len(args):
                    command = args[i + 1:]
                break
            elif arg.startswith("-") and len(arg) > 1 and not arg[1].isdigit():
                return ExecResult(
                    stdout="",
                    stderr=f"timeout: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            elif duration is None:
                try:
                    duration = self._parse_duration(arg)
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"timeout: invalid duration '{arg}'\n",
                        exit_code=1,
                    )
            else:
                command = args[i:]
                break
            i += 1

        if duration is None:
            return ExecResult(
                stdout="",
                stderr="timeout: missing operand\n",
                exit_code=1,
            )

        if not command:
            return ExecResult(
                stdout="",
                stderr="timeout: missing command\n",
                exit_code=1,
            )

        # Quote arguments properly for shell execution
        def quote(s: str) -> str:
            if not s or any(c in s for c in " \t\n'\"\\$`!"):
                return "'" + s.replace("'", "'\"'\"'") + "'"
            return s

        cmd_str = " ".join(quote(c) for c in command)

        # Execute command with timeout
        if not ctx.exec:
            return ExecResult(
                stdout="",
                stderr="timeout: cannot execute commands\n",
                exit_code=126,
            )

        try:
            result = await asyncio.wait_for(
                ctx.exec(cmd_str, {"cwd": ctx.cwd}),
                timeout=duration,
            )
            return result
        except asyncio.TimeoutError:
            # In a sandboxed environment, we can't actually send signals
            # The -k and -s options are parsed but have limited effect
            # Return 124 unless preserve_status is set (then we can't know the status)
            if preserve_status:
                # In real timeout, this would preserve the signal exit status
                # We return 124 + signal number approximation
                return ExecResult(stdout="", stderr="", exit_code=124)
            return ExecResult(stdout="", stderr="", exit_code=124)

    def _parse_duration(self, s: str) -> float:
        """Parse a duration string."""
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

        return value
