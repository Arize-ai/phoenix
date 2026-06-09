"""Echo command implementation.

Usage: echo [-neE] [string ...]

Options:
  -n    Do not output the trailing newline
  -e    Enable interpretation of backslash escapes
  -E    Disable interpretation of backslash escapes (default)
"""

from ...types import Command, CommandContext, ExecResult


def _process_escapes(s: str) -> str:
    """Process backslash escape sequences in a string."""
    result = []
    i = 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            next_char = s[i + 1]
            if next_char == "n":
                result.append("\n")
                i += 2
            elif next_char == "t":
                result.append("\t")
                i += 2
            elif next_char == "r":
                result.append("\r")
                i += 2
            elif next_char == "\\":
                result.append("\\")
                i += 2
            elif next_char == "a":
                result.append("\a")
                i += 2
            elif next_char == "b":
                result.append("\b")
                i += 2
            elif next_char == "f":
                result.append("\f")
                i += 2
            elif next_char == "v":
                result.append("\v")
                i += 2
            elif next_char == "e":
                result.append("\x1b")
                i += 2
            elif next_char == "0":
                # Octal escape: \0nnn
                octal = ""
                j = i + 2
                while j < len(s) and len(octal) < 3 and s[j] in "01234567":
                    octal += s[j]
                    j += 1
                if octal:
                    result.append(chr(int(octal, 8) & 0xFF))
                else:
                    result.append("\0")
                i = j
            elif next_char == "x":
                # Hex escape: \xHH
                hex_digits = ""
                j = i + 2
                while j < len(s) and len(hex_digits) < 2 and s[j] in "0123456789abcdefABCDEF":
                    hex_digits += s[j]
                    j += 1
                if hex_digits:
                    result.append(chr(int(hex_digits, 16)))
                    i = j
                else:
                    result.append(s[i])
                    i += 1
            elif next_char == "u":
                # Unicode escape: \uHHHH (4 hex digits)
                hex_digits = ""
                j = i + 2
                while j < len(s) and len(hex_digits) < 4 and s[j] in "0123456789abcdefABCDEF":
                    hex_digits += s[j]
                    j += 1
                if hex_digits:
                    try:
                        result.append(chr(int(hex_digits, 16)))
                    except (ValueError, OverflowError):
                        result.append("\\u" + hex_digits)
                    i = j
                else:
                    result.append("\\u")
                    i += 2
            elif next_char == "U":
                # Unicode escape: \UHHHHHHHH (8 hex digits)
                hex_digits = ""
                j = i + 2
                while j < len(s) and len(hex_digits) < 8 and s[j] in "0123456789abcdefABCDEF":
                    hex_digits += s[j]
                    j += 1
                if hex_digits:
                    try:
                        result.append(chr(int(hex_digits, 16)))
                    except (ValueError, OverflowError):
                        result.append("\\U" + hex_digits)
                    i = j
                else:
                    result.append("\\U")
                    i += 2
            elif next_char == "c":
                # \c stops output
                return "".join(result)
            else:
                result.append(s[i])
                i += 1
        else:
            result.append(s[i])
            i += 1
    return "".join(result)


class EchoCommand:
    """The echo command."""

    name = "echo"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the echo command."""
        newline = True
        enable_escapes = False

        # Parse options
        i = 0
        while i < len(args):
            arg = args[i]
            if arg.startswith("-") and len(arg) > 1 and all(c in "neE" for c in arg[1:]):
                for c in arg[1:]:
                    if c == "n":
                        newline = False
                    elif c == "e":
                        enable_escapes = True
                    elif c == "E":
                        enable_escapes = False
                i += 1
            else:
                break

        # Get remaining arguments
        text_args = args[i:]

        # Build output
        output = " ".join(text_args)

        # Process escape sequences if enabled
        if enable_escapes:
            output = _process_escapes(output)

        # Add newline if needed
        if newline:
            output += "\n"

        return ExecResult(stdout=output, stderr="", exit_code=0)
