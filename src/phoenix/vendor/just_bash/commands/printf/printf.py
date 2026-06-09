"""Printf command implementation."""

import os
import re
import time
from ...types import CommandContext, ExecResult


class PrintfCommand:
    """The printf command."""

    name = "printf"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the printf command."""
        if not args:
            return ExecResult(
                stdout="",
                stderr="printf: usage: printf [-v var] format [arguments]\n",
                exit_code=2,
            )

        # Parse -v option and -- end-of-options
        var_name = None
        format_start = 0
        if len(args) >= 2 and args[0] == "-v":
            var_name = args[1]
            format_start = 2
        if format_start < len(args) and args[format_start] == "--":
            format_start += 1

        if len(args) <= format_start:
            return ExecResult(
                stdout="",
                stderr="printf: usage: printf [-v var] format [arguments]\n",
                exit_code=2,
            )

        format_str = args[format_start]
        arguments = args[format_start + 1:]

        self._env = ctx.env
        output, stderr, exit_code = self._format(format_str, arguments)

        if var_name is not None:
            # Assign to variable instead of printing
            import re
            # Handle array subscript in var_name: printf -v 'arr[idx]'
            arr_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]$', var_name)
            if arr_match:
                arr_name = arr_match.group(1)
                subscript = arr_match.group(2)
                ctx.env[f"{arr_name}_{subscript}"] = output
                # Ensure array marker exists
                if f"{arr_name}__is_array" not in ctx.env:
                    ctx.env[f"{arr_name}__is_array"] = "indexed"
            elif '[' in var_name:
                # Malformed subscript like 'a['
                return ExecResult(
                    stdout="",
                    stderr=f"bash: printf: `{var_name}': not a valid identifier\n",
                    exit_code=2,
                )
            else:
                ctx.env[var_name] = output
            return ExecResult(stdout="", stderr=stderr, exit_code=exit_code)

        return ExecResult(stdout=output, stderr=stderr, exit_code=exit_code)

    def _format(self, format_str: str, arguments: list[str]) -> tuple[str, str, int]:
        """Format the string with arguments.

        Returns (output, stderr, exit_code).
        Supports format reuse: if there are more arguments than format specifiers,
        the format string is reused for the remaining arguments.
        """
        result = []
        stderr_parts = []
        exit_code = 0
        arg_index = 0

        # Continue formatting until all arguments are consumed
        while True:
            start_arg_index = arg_index
            formatted, arg_index, err, ec, early_stop = self._format_once(
                format_str, arguments, arg_index
            )
            result.append(formatted)
            if err:
                stderr_parts.append(err)
            if ec != 0:
                exit_code = ec

            if early_stop:
                break

            # If no arguments were consumed or all arguments are consumed, stop
            if arg_index == start_arg_index or arg_index >= len(arguments):
                break

        return "".join(result), "".join(stderr_parts), exit_code

    def _format_once(
        self, format_str: str, arguments: list[str], arg_index: int
    ) -> tuple[str, int, str, int, bool]:
        """Format the string once.

        Returns (formatted_string, new_arg_index, stderr, exit_code, early_stop).
        """
        result = []
        stderr = ""
        exit_code = 0
        i = 0
        early_stop = False

        while i < len(format_str):
            if format_str[i] == "\\" and i + 1 < len(format_str):
                # Handle escape sequences
                escape_result, consumed = self._process_escape(format_str, i)
                result.append(escape_result)
                i += consumed
            elif format_str[i] == "%" and i + 1 < len(format_str):
                # Handle format specifiers
                if format_str[i + 1] == "%":
                    result.append("%")
                    i += 2
                    continue

                # Check for %(fmt)T strftime format
                strftime_match = re.match(
                    r"(%[-+# 0]*\d*(?:\.\d+)?)\(([^)]*)\)T", format_str[i:]
                )
                if strftime_match:
                    prefix_flags = strftime_match.group(1)
                    strftime_fmt = strftime_match.group(2)
                    if arg_index < len(arguments):
                        arg = arguments[arg_index]
                        arg_index += 1
                    else:
                        arg = "-1"  # default: current time

                    try:
                        timestamp = int(arg)
                    except ValueError:
                        timestamp = -1

                    if timestamp == -1:
                        timestamp = int(time.time())
                    elif timestamp == -2:
                        # Shell start time - use current time as approximation
                        timestamp = int(time.time())

                    try:
                        # Temporarily set system TZ to match virtual env
                        tz = getattr(self, '_env', {}).get("TZ")
                        old_tz = os.environ.get("TZ")
                        if tz is not None:
                            os.environ["TZ"] = tz
                            time.tzset()
                        try:
                            formatted = time.strftime(strftime_fmt, time.localtime(timestamp))
                        finally:
                            if old_tz is not None:
                                os.environ["TZ"] = old_tz
                            elif "TZ" in os.environ:
                                del os.environ["TZ"]
                            if tz is not None:
                                time.tzset()
                        # Bash truncates strftime output at 128 characters
                        if len(formatted) > 128:
                            formatted = ""
                    except (ValueError, OSError):
                        formatted = ""

                    # Apply width/precision from prefix flags
                    prefix = prefix_flags[1:]  # strip leading %
                    if prefix:
                        w_match = re.match(r"[-+# 0]*(\d+)?(?:\.(\d+))?", prefix)
                        if w_match:
                            w_str = w_match.group(1)
                            p_str = w_match.group(2)
                            if p_str is not None:
                                formatted = formatted[:int(p_str)]
                            if w_str is not None:
                                w = int(w_str)
                                if "-" in prefix:
                                    formatted = formatted.ljust(w)
                                else:
                                    formatted = formatted.rjust(w)

                    result.append(formatted)
                    i += len(strftime_match.group(0))
                    continue

                # Parse format specifier with full support
                # Pattern: %[flags][width][.precision]specifier
                spec_pattern = r"([-+# 0']*)(\*|-?\d+)?(?:\.(\*|-?\d*))?([diouxXeEfFgGsbcq])"
                spec_match = re.match(spec_pattern, format_str[i + 1:])

                if spec_match:
                    flags = spec_match.group(1) or ""
                    width_spec = spec_match.group(2)
                    precision_spec = spec_match.group(3)
                    spec_type = spec_match.group(4)

                    # Handle * for width
                    width = None
                    if width_spec == "*":
                        if arg_index < len(arguments):
                            try:
                                width = int(arguments[arg_index])
                            except ValueError:
                                width = 0
                            arg_index += 1
                        else:
                            width = 0
                    elif width_spec:
                        width = int(width_spec)

                    # Handle * for precision
                    precision = None
                    if precision_spec == "*":
                        if arg_index < len(arguments):
                            try:
                                precision = int(arguments[arg_index])
                            except ValueError:
                                precision = 0
                            arg_index += 1
                        else:
                            precision = 0
                    elif precision_spec is not None:
                        precision = int(precision_spec) if precision_spec else 0

                    # Get argument
                    if arg_index < len(arguments):
                        arg = arguments[arg_index]
                        arg_index += 1
                    else:
                        arg = ""

                    # Format based on type
                    formatted, err, ec, stop = self._format_specifier(
                        spec_type, arg, flags, width, precision
                    )
                    result.append(formatted)
                    if err:
                        stderr += err
                    if ec != 0:
                        exit_code = ec
                    if stop:
                        early_stop = True
                        break

                    i += 1 + len(spec_match.group(0))
                else:
                    # Invalid format specifier - skip % and the invalid char
                    # Check for flags before the invalid char
                    j = i + 1
                    while j < len(format_str) and format_str[j] in "-+# 0'":
                        j += 1
                    if j < len(format_str):
                        next_char = format_str[j]
                        stderr += f"bash: printf: `{next_char}': invalid format character\n"
                    exit_code = 1
                    i = j + 1
            else:
                result.append(format_str[i])
                i += 1

        return "".join(result), arg_index, stderr, exit_code, early_stop

    def _format_specifier(
        self, spec_type: str, arg: str, flags: str, width: int | None, precision: int | None
    ) -> tuple[str, str, int, bool]:
        """Format a single specifier.

        Returns (formatted, stderr, exit_code, early_stop).
        """
        stderr = ""
        exit_code = 0
        early_stop = False

        try:
            if spec_type == "q":
                # Shell quoting with width support
                quoted = self._shell_quote(arg)
                if width is not None:
                    abs_w = abs(width)
                    if len(quoted) < abs_w:
                        if width < 0 or "-" in flags:
                            quoted = quoted.ljust(abs_w)
                        else:
                            quoted = quoted.rjust(abs_w)
                return (quoted, stderr, exit_code, early_stop)
            elif spec_type in "diouxX":
                val, err = self._parse_numeric_arg_with_error(arg)
                if err:
                    stderr = err
                    exit_code = 1
                # Clamp to 64-bit range (matching bash/C behavior)
                if spec_type in "ouxX":
                    # Unsigned: mask to 64-bit
                    val = val & 0xFFFFFFFFFFFFFFFF
                else:
                    # Signed: clamp to [-2^63, 2^63-1]
                    if val > 0x7FFFFFFFFFFFFFFF:
                        val = 0x7FFFFFFFFFFFFFFF
                    elif val < -0x8000000000000000:
                        val = -0x8000000000000000
                fmt = self._build_format_string(spec_type, flags, width, precision)
                result_str = fmt % val
                # Fix Python's # flag formatting to match C/bash behavior
                if "#" in flags:
                    if spec_type == "o":
                        # Python: 0o52 → C: 052; Python: 0o0 → C: 0
                        result_str = result_str.replace("0o", "0")
                        # %#o with value 0 should be just "0"
                        if val == 0:
                            result_str = re.sub(r'^( *)(0+)$', lambda m: m.group(1) + '0', result_str)
                    elif spec_type in "xX" and val == 0:
                        # Python: 0x0 → C: 0 (no prefix for zero)
                        result_str = result_str.replace("0x", "").replace("0X", "")
                return (result_str, stderr, exit_code, early_stop)
            elif spec_type in "eEfFgG":
                val, err = self._parse_float_arg_with_error(arg)
                if err:
                    stderr = err
                    exit_code = 1
                fmt = self._build_format_string(spec_type, flags, width, precision)
                return (fmt % val, stderr, exit_code, early_stop)
            elif spec_type == "s":
                fmt = self._build_format_string(spec_type, flags, width, precision)
                return (fmt % arg, stderr, exit_code, early_stop)
            elif spec_type == "c":
                # %c outputs the first byte of the first character's UTF-8 encoding
                if arg:
                    first_bytes = arg[0].encode("utf-8")
                    c = chr(first_bytes[0])
                else:
                    c = ""
                if width is not None:
                    abs_w = abs(width)
                    if width < 0 or "-" in flags:
                        c = c.ljust(abs_w)
                    else:
                        c = c.rjust(abs_w)
                return (c, stderr, exit_code, early_stop)
            elif spec_type == "b":
                # %b interprets backslash escapes in the argument
                processed, stop = self._process_b_escapes(arg)
                if stop:
                    early_stop = True
                if width is not None:
                    abs_w = abs(width)
                    if len(processed) < abs_w:
                        if width < 0 or "-" in flags:
                            processed = processed.ljust(abs_w)
                        else:
                            processed = processed.rjust(abs_w)
                return (processed, stderr, exit_code, early_stop)
            else:
                return ("", stderr, exit_code, early_stop)
        except (ValueError, TypeError):
            if spec_type in "diouxXeEfFgG":
                return ("0", stderr, exit_code, early_stop)
            return ("", stderr, exit_code, early_stop)

    def _parse_numeric_arg_with_error(self, arg: str) -> tuple[int, str]:
        """Parse a numeric argument, returning (value, error_string).

        Returns error string for invalid arguments but still returns best-effort value.
        """
        if not arg:
            return (0, "")
        # Character notation: 'c or "c
        if len(arg) >= 2 and arg[0] in ("'", '"'):
            return (ord(arg[1]), "")

        s = arg.lstrip()
        if not s:
            return (0, "")

        # Check for trailing spaces (leading is OK, trailing is not)
        error = ""
        if s != s.rstrip():
            error = f'bash: printf: {arg}: invalid number\n'
            s = s.strip()

        sign = 1
        rest = s
        if rest.startswith("-"):
            sign = -1
            rest = rest[1:]
        elif rest.startswith("+"):
            rest = rest[1:]

        try:
            if rest.startswith("0x") or rest.startswith("0X"):
                val = sign * int(rest, 16)
                return (val, error)
            if len(rest) > 1 and rest[0] == "0" and all(c in "01234567" for c in rest):
                val = sign * int(rest, 8)
                return (val, error)
            val = sign * int(rest)
            return (val, error)
        except ValueError:
            # Try parsing as much as possible
            # Check for leading valid digits
            if rest and rest[0].isdigit():
                digits = ""
                for c in rest:
                    if c.isdigit():
                        digits += c
                    else:
                        break
                if digits:
                    error = f'bash: printf: {arg}: invalid number\n'
                    return (sign * int(digits), error)

            error = f'bash: printf: {arg}: invalid number\n'
            return (0, error)

    def _parse_float_arg_with_error(self, arg: str) -> tuple[float, str]:
        """Parse a float argument, returning (value, error_string)."""
        if not arg:
            return (0.0, "")
        if len(arg) >= 2 and arg[0] in ("'", '"'):
            return (float(ord(arg[1])), "")
        try:
            return (float(arg), "")
        except ValueError:
            return (0.0, f'bash: printf: {arg}: invalid number\n')

    def _parse_numeric_arg(self, arg: str) -> int:
        """Parse a numeric argument, handling hex, octal, and character notation."""
        val, _ = self._parse_numeric_arg_with_error(arg)
        return val

    def _build_format_string(
        self, spec_type: str, flags: str, width: int | None, precision: int | None
    ) -> str:
        """Build a Python format string from components."""
        fmt = "%"

        # Process flags - strip ' (thousands grouping, not supported in Python %)
        clean_flags = flags.replace("'", "")

        # Handle negative width (left-justify)
        if width is not None and width < 0:
            if "-" not in clean_flags:
                clean_flags = "-" + clean_flags
            width = -width

        fmt += clean_flags
        if width is not None:
            fmt += str(width)
        if precision is not None:
            fmt += f".{precision}"
        # Python doesn't have %u - use %d since unsigned conversion already happened
        fmt += "d" if spec_type == "u" else spec_type
        return fmt

    def _shell_quote(self, s: str) -> str:
        """Quote a string for shell use (bash-style backslash escaping)."""
        if not s:
            return "''"

        # Check if quoting is needed
        safe_chars = set(
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
            "0123456789_@%+=:,./-"
        )
        if all(c in safe_chars for c in s):
            return s

        # Check if the string contains non-printable or non-ASCII characters
        has_special = any(ord(c) < 32 or ord(c) > 126 or ord(c) == 127 for c in s)

        if has_special:
            # Use $'...' format
            result = ["$'"]
            for c in s:
                if c == "'":
                    result.append("\\'")
                elif c == "\\":
                    result.append("\\\\")
                elif c == "\n":
                    result.append("\\n")
                elif c == "\t":
                    result.append("\\t")
                elif c == "\r":
                    result.append("\\r")
                elif c == "\a":
                    result.append("\\a")
                elif c == "\b":
                    result.append("\\b")
                elif c == "\x1b":
                    result.append("\\E")
                elif ord(c) < 32 or ord(c) == 127:
                    result.append(f"\\x{ord(c):02x}")
                elif ord(c) > 127:
                    # Encode as UTF-8 bytes and output as octal escapes
                    try:
                        encoded = c.encode("utf-8")
                        for b in encoded:
                            result.append(f"\\{b:03o}")
                    except UnicodeEncodeError:
                        result.append(f"\\x{ord(c):02x}")
                else:
                    result.append(c)
            result.append("'")
            return "".join(result)

        # Use backslash escaping for printable special chars
        result = []
        for c in s:
            if c in " \t!\"#$&'()*;<>?[\\]`{|}~^":
                result.append("\\")
                result.append(c)
            else:
                result.append(c)
        return "".join(result)

    def _process_escape(self, s: str, i: int) -> tuple[str, int]:
        """Process an escape sequence starting at position i.

        Returns (result_string, characters_consumed).
        """
        if i + 1 >= len(s):
            return ("\\", 1)

        escape_char = s[i + 1]
        escape_map = {
            "n": "\n",
            "t": "\t",
            "r": "\r",
            "\\": "\\",
            "a": "\a",
            "b": "\b",
            "f": "\f",
            "v": "\v",
            "e": "\x1b",
            "E": "\x1b",
            "'": "'",
            '"': '"',
        }

        if escape_char in escape_map:
            return (escape_map[escape_char], 2)
        elif escape_char in "01234567":
            # Octal escape: \NNN - first digit plus up to 2 more (3 total)
            octal = escape_char
            j = i + 2
            while j < len(s) and len(octal) < 3 and s[j] in "01234567":
                octal += s[j]
                j += 1
            return (chr(int(octal, 8) & 0xFF), j - i)
        elif escape_char == "x":
            # Hex escape - collect consecutive \xHH sequences and try UTF-8 decoding
            hex_bytes = []
            j = i
            while j < len(s) and s[j : j + 2] == "\\x":
                hex_digits = ""
                k = j + 2
                while (
                    k < len(s)
                    and len(hex_digits) < 2
                    and s[k] in "0123456789abcdefABCDEF"
                ):
                    hex_digits += s[k]
                    k += 1
                if hex_digits:
                    hex_bytes.append(int(hex_digits, 16))
                    j = k
                else:
                    break

            if hex_bytes:
                # Try UTF-8 decoding first
                byte_data = bytes(hex_bytes)
                try:
                    decoded = byte_data.decode("utf-8")
                    return (decoded, j - i)
                except UnicodeDecodeError:
                    # Fall back to Latin-1 (1:1 byte to codepoint)
                    return (byte_data.decode("latin-1"), j - i)
            else:
                return ("\\x", 2)
        elif escape_char == "u":
            # Unicode escape \uHHHH
            hex_digits = ""
            j = i + 2
            while (
                j < len(s)
                and len(hex_digits) < 4
                and s[j] in "0123456789abcdefABCDEF"
            ):
                hex_digits += s[j]
                j += 1
            if hex_digits:
                try:
                    return (chr(int(hex_digits, 16)), j - i)
                except ValueError:
                    return ("\\u", 2)
            return ("\\u", 2)
        elif escape_char == "U":
            # Unicode escape \UHHHHHHHH
            hex_digits = ""
            j = i + 2
            while (
                j < len(s)
                and len(hex_digits) < 8
                and s[j] in "0123456789abcdefABCDEF"
            ):
                hex_digits += s[j]
                j += 1
            if hex_digits:
                try:
                    return (chr(int(hex_digits, 16)), j - i)
                except ValueError:
                    return ("\\U", 2)
            return ("\\U", 2)
        elif escape_char == "c":
            # \c in format string means stop output
            return ("", len(s) - i)  # consume rest
        else:
            # Invalid escape - output backslash + char literally
            return ("\\" + escape_char, 2)

    def _process_b_escapes(self, s: str) -> tuple[str, bool]:
        """Process escape sequences for %b format.

        %b uses slightly different rules than format string escapes:
        - \\0NNN is octal (with leading zero, up to 3 more digits)
        - \\NNN is NOT octal (only \\0NNN is)
        - \\c stops output entirely (returns early_stop=True)

        Returns (processed_string, early_stop).
        """
        result = []
        i = 0
        while i < len(s):
            if s[i] == "\\" and i + 1 < len(s):
                c = s[i + 1]
                if c == "c":
                    # \c: stop output
                    return ("".join(result), True)
                elif c == "0":
                    # \0NNN - octal with leading 0
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
                elif c == "x":
                    # Hex escape
                    hex_digits = ""
                    j = i + 2
                    while (
                        j < len(s)
                        and len(hex_digits) < 2
                        and s[j] in "0123456789abcdefABCDEF"
                    ):
                        hex_digits += s[j]
                        j += 1
                    if hex_digits:
                        result.append(chr(int(hex_digits, 16)))
                        i = j
                    else:
                        result.append("\\x")
                        i += 2
                elif c == "u":
                    hex_digits = ""
                    j = i + 2
                    while (
                        j < len(s)
                        and len(hex_digits) < 4
                        and s[j] in "0123456789abcdefABCDEF"
                    ):
                        hex_digits += s[j]
                        j += 1
                    if hex_digits:
                        try:
                            result.append(chr(int(hex_digits, 16)))
                        except ValueError:
                            result.append("\\u" + hex_digits)
                        i = j
                    else:
                        result.append("\\u")
                        i += 2
                elif c == "U":
                    hex_digits = ""
                    j = i + 2
                    while (
                        j < len(s)
                        and len(hex_digits) < 8
                        and s[j] in "0123456789abcdefABCDEF"
                    ):
                        hex_digits += s[j]
                        j += 1
                    if hex_digits:
                        try:
                            result.append(chr(int(hex_digits, 16)))
                        except ValueError:
                            result.append("\\U" + hex_digits)
                        i = j
                    else:
                        result.append("\\U")
                        i += 2
                elif c in "12345678":
                    # \NNN (no leading zero) - NOT treated as octal in %b
                    # In bash %b, only \0NNN is octal. \NNN passes through.
                    octal = c
                    j = i + 2
                    while j < len(s) and len(octal) < 3 and s[j] in "01234567":
                        octal += s[j]
                        j += 1
                    result.append(chr(int(octal, 8) & 0xFF))
                    i = j
                else:
                    escape_map = {
                        "n": "\n", "t": "\t", "r": "\r", "\\": "\\",
                        "a": "\a", "b": "\b", "f": "\f", "v": "\v",
                        "e": "\x1b", "E": "\x1b", "'": "'", '"': '"',
                    }
                    if c in escape_map:
                        result.append(escape_map[c])
                        i += 2
                    else:
                        # Unknown escape - keep backslash + char
                        result.append("\\" + c)
                        i += 2
            else:
                result.append(s[i])
                i += 1
        return ("".join(result), False)

    def _process_escapes(self, s: str) -> str:
        """Process escape sequences in a string (for %b backward compat)."""
        processed, _ = self._process_b_escapes(s)
        return processed
