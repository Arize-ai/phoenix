"""Seq command implementation.

Usage: seq [OPTION]... LAST
  or:  seq [OPTION]... FIRST LAST
  or:  seq [OPTION]... FIRST INCREMENT LAST

Print numbers from FIRST to LAST, in steps of INCREMENT.

Options:
  -s, --separator=STRING  use STRING to separate numbers (default: newline)
  -w, --equal-width       equalize width by padding with leading zeroes
"""

from ...types import CommandContext, ExecResult


class SeqCommand:
    """The seq command."""

    name = "seq"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the seq command."""
        separator = "\n"
        equal_width = False
        numbers: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg.startswith("--"):
                if arg.startswith("--separator="):
                    separator = arg[12:]
                elif arg == "--equal-width":
                    equal_width = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"seq: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-" and not self._is_number(arg):
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "s":
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
                                stderr="seq: option requires an argument -- 's'\n",
                                exit_code=1,
                            )
                    elif c == "w":
                        equal_width = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"seq: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            else:
                numbers.append(arg)
            i += 1

        # Parse FIRST, INCREMENT, LAST
        if len(numbers) == 0:
            return ExecResult(
                stdout="",
                stderr="seq: missing operand\n",
                exit_code=1,
            )
        elif len(numbers) == 1:
            first = 1.0
            increment = 1.0
            try:
                last = float(numbers[0])
            except ValueError:
                return ExecResult(
                    stdout="",
                    stderr=f"seq: invalid floating point argument: '{numbers[0]}'\n",
                    exit_code=1,
                )
        elif len(numbers) == 2:
            try:
                first = float(numbers[0])
                last = float(numbers[1])
                increment = 1.0 if first <= last else -1.0
            except ValueError as e:
                return ExecResult(
                    stdout="",
                    stderr=f"seq: invalid floating point argument\n",
                    exit_code=1,
                )
        elif len(numbers) == 3:
            try:
                first = float(numbers[0])
                increment = float(numbers[1])
                last = float(numbers[2])
            except ValueError:
                return ExecResult(
                    stdout="",
                    stderr=f"seq: invalid floating point argument\n",
                    exit_code=1,
                )
        else:
            return ExecResult(
                stdout="",
                stderr="seq: extra operand\n",
                exit_code=1,
            )

        # Validate increment
        if increment == 0:
            return ExecResult(
                stdout="",
                stderr="seq: zero increment\n",
                exit_code=1,
            )

        # Generate sequence
        result_nums: list[str] = []
        current = first
        max_iterations = 100000  # Prevent infinite loops

        # Determine decimal places for formatting
        def get_decimal_places(n: float, s: str) -> int:
            if "." in s:
                return len(s.split(".")[1])
            return 0

        first_decimals = get_decimal_places(first, numbers[0] if numbers else "1")
        incr_decimals = get_decimal_places(increment, numbers[1] if len(numbers) > 2 else "1")
        last_decimals = get_decimal_places(last, numbers[-1] if numbers else "1")
        decimals = max(first_decimals, incr_decimals, last_decimals)

        iterations = 0
        while iterations < max_iterations:
            iterations += 1

            if increment > 0 and current > last + 1e-10:
                break
            if increment < 0 and current < last - 1e-10:
                break

            if decimals == 0 and current == int(current):
                result_nums.append(str(int(current)))
            else:
                result_nums.append(f"{current:.{decimals}f}")

            current += increment

        # Apply equal width padding
        if equal_width and result_nums:
            max_width = max(len(n.split(".")[0].lstrip("-")) for n in result_nums)
            padded = []
            for n in result_nums:
                if n.startswith("-"):
                    padded.append("-" + n[1:].zfill(max_width + (len(n) - len(n.lstrip("-0123456789")) if "." in n else 0)))
                else:
                    if "." in n:
                        int_part, dec_part = n.split(".")
                        padded.append(int_part.zfill(max_width) + "." + dec_part)
                    else:
                        padded.append(n.zfill(max_width))
            result_nums = padded

        if result_nums:
            output = separator.join(result_nums) + "\n"
        else:
            output = ""

        return ExecResult(stdout=output, stderr="", exit_code=0)

    def _is_number(self, s: str) -> bool:
        """Check if string is a number (including negative)."""
        try:
            float(s)
            return True
        except ValueError:
            return False
