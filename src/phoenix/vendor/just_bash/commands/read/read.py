"""Read command implementation.

Usage: read [-r] [-d delim] [-n nchars] [-N nchars] [-p prompt] [-t timeout] [name ...]

Read a line from stdin and split it into fields.

Options:
  -r        Do not treat backslash as escape character
  -d delim  Use delim as line delimiter instead of newline
  -n nchars Read at most nchars characters
  -N nchars Read exactly nchars characters (no IFS splitting, ignores delimiters)
  -p prompt Output the string prompt before reading
  -t timeout Time out after timeout seconds

If no names are given, the line is stored in REPLY.
"""

from ...types import CommandContext, ExecResult


class ReadCommand:
    """The read builtin command."""

    name = "read"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the read command."""
        # Parse options - expand smooshed flags first (e.g., -rn1 -> -r -n 1)
        expanded_args = self._expand_flags(args)

        raw_mode = False
        delimiter = "\n"
        nchars = None
        no_split = False  # -N mode: no IFS splitting
        array_name = None  # -a option
        fd_num = None  # -u option
        var_names = []

        i = 0
        while i < len(expanded_args):
            arg = expanded_args[i]
            if arg == "-r":
                raw_mode = True
            elif arg == "-s":
                pass  # silent mode - ignore (no terminal)
            elif arg == "-a" and i + 1 < len(expanded_args):
                i += 1
                array_name = expanded_args[i]
            elif arg == "-d" and i + 1 < len(expanded_args):
                i += 1
                delimiter = expanded_args[i] if expanded_args[i] else "\0"
            elif arg == "-n" and i + 1 < len(expanded_args):
                i += 1
                try:
                    nchars = int(expanded_args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"bash: read: {expanded_args[i]}: invalid number\n",
                        exit_code=1,
                    )
            elif arg == "-N" and i + 1 < len(expanded_args):
                i += 1
                try:
                    nchars = int(expanded_args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"bash: read: {expanded_args[i]}: invalid number\n",
                        exit_code=1,
                    )
                no_split = True
                delimiter = ""  # -N ignores delimiters
            elif arg == "-u" and i + 1 < len(expanded_args):
                i += 1
                try:
                    fd_num = int(expanded_args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"bash: read: {expanded_args[i]}: invalid file descriptor\n",
                        exit_code=1,
                    )
            elif arg == "-p" and i + 1 < len(expanded_args):
                i += 1
            elif arg == "-t" and i + 1 < len(expanded_args):
                i += 1
            elif arg.startswith("-"):
                pass
            else:
                var_names.append(arg)
            i += 1

        # Track whether we're using default REPLY
        use_reply = not var_names and not array_name
        if not var_names:
            var_names = ["REPLY"]

        # Get input from stdin or custom FD
        if fd_num is not None and fd_num >= 3:
            fd_contents = getattr(ctx, 'fd_contents', {})
            stdin = fd_contents.get(fd_num, "")
        else:
            stdin = ctx.stdin or ""

        # Read line from stdin, tracking how much was consumed
        line, consumed, eof_reached = self._read_record(
            stdin, delimiter, nchars, no_split, raw_mode
        )

        # Store remaining stdin for subsequent reads in the same group
        remaining = stdin[consumed:]
        ctx.env["__remaining_stdin__"] = remaining

        # Process backslash escapes if not in raw mode and not -N mode
        if not raw_mode and not no_split and nchars is None:
            result = []
            ci = 0
            while ci < len(line):
                if line[ci] == "\\" and ci + 1 < len(line):
                    result.append(line[ci + 1])
                    ci += 2
                else:
                    result.append(line[ci])
                    ci += 1
            line = "".join(result)

        # Get IFS
        ifs = ctx.env.get("IFS", " \t\n")

        # Handle -a option (read into array)
        if array_name:
            # Split on IFS for array assignment
            if no_split:
                words = [line] if line else []
            elif ifs is not None and ifs != "":
                words = self._split_on_ifs(line, ifs)
            else:
                # Empty IFS: no splitting (treat as single word)
                words = [line] if line else []

            # Clear existing array elements
            prefix = f"{array_name}_"
            to_remove = [k for k in ctx.env if k.startswith(prefix) and not k.startswith(f"{array_name}__")]
            for k in to_remove:
                del ctx.env[k]

            ctx.env[f"{array_name}__is_array"] = "indexed"

            for idx, word in enumerate(words):
                ctx.env[f"{array_name}_{idx}"] = word

            return ExecResult(stdout="", stderr="", exit_code=1 if eof_reached else 0)

        # Assign to variables
        if no_split:
            # -N mode: no IFS splitting at all
            if len(var_names) == 1:
                ctx.env[var_names[0]] = line
            else:
                ctx.env[var_names[0]] = line
                for v in var_names[1:]:
                    ctx.env[v] = ""
        elif use_reply:
            # REPLY: preserve the line as-is (no IFS stripping)
            # But strip trailing IFS whitespace for regular reads (not -n)
            if nchars is not None:
                # -n mode: REPLY gets raw characters, no stripping
                ctx.env[var_names[0]] = line
            else:
                ctx.env[var_names[0]] = line
        elif len(var_names) == 1:
            # Single named variable: strip leading/trailing IFS whitespace
            if nchars is not None:
                # -n mode with named variable: strip IFS whitespace
                stripped = self._strip_ifs_whitespace(line, ifs)
                ctx.env[var_names[0]] = stripped
            else:
                stripped = self._strip_ifs_whitespace(line, ifs)
                ctx.env[var_names[0]] = stripped
        elif ifs is not None and ifs == "":
            # Empty IFS: no splitting
            ctx.env[var_names[0]] = line
            for v in var_names[1:]:
                ctx.env[v] = ""
        else:
            # Multiple variables: split on IFS
            self._assign_split_vars(line, var_names, ifs, ctx)

        return ExecResult(stdout="", stderr="", exit_code=1 if eof_reached else 0)

    def _read_record(
        self,
        stdin: str,
        delimiter: str,
        nchars: int | None,
        no_split: bool,
        raw_mode: bool,
    ) -> tuple[str, int, bool]:
        """Read one record from stdin.

        Returns (line, consumed_bytes, eof_reached).
        consumed_bytes is the number of characters consumed from stdin,
        including the delimiter.
        """
        if not stdin:
            return "", 0, True

        # -N mode: read raw bytes, no delimiter processing
        if delimiter == "" and no_split:
            if nchars is not None:
                line = stdin[:nchars]
                eof_reached = len(stdin) < nchars
                return line, len(line), eof_reached
            return stdin, len(stdin), False

        # -n mode: read up to nchars characters, stop at delimiter
        if nchars is not None and not no_split:
            line = ""
            consumed = 0
            for ci in range(min(nchars, len(stdin))):
                if stdin[ci] == delimiter:
                    consumed = ci + 1  # consume the delimiter too
                    break
                line += stdin[ci]
                consumed = ci + 1
            else:
                # Reached nchars limit without hitting delimiter
                pass
            eof_reached = len(stdin) <= consumed and delimiter not in stdin[len(line):]
            return line, consumed, eof_reached

        # Normal mode: read up to delimiter
        if delimiter == "\n" and not raw_mode:
            # Handle line continuation: \<newline> joins lines
            line_parts = []
            pos = 0
            while pos < len(stdin):
                nl_pos = stdin.find("\n", pos)
                if nl_pos == -1:
                    # No more newlines - take rest as line, EOF
                    line_parts.append(stdin[pos:])
                    return "".join(line_parts), len(stdin), True
                segment = stdin[pos:nl_pos]
                if segment.endswith("\\"):
                    # Line continuation: backslash before newline
                    # Remove the backslash and join with next line
                    line_parts.append(segment[:-1])
                    pos = nl_pos + 1
                    continue
                else:
                    line_parts.append(segment)
                    consumed = nl_pos + 1  # include the newline
                    return "".join(line_parts), consumed, False
            # Exhausted input
            return "".join(line_parts), len(stdin), True

        # Default delimiter handling (newline in raw mode, or custom delimiter)
        delim_pos = stdin.find(delimiter)
        if delim_pos == -1:
            # Delimiter not found - read all, EOF
            return stdin, len(stdin), True
        line = stdin[:delim_pos]
        consumed = delim_pos + len(delimiter)
        return line, consumed, False

    @staticmethod
    def _expand_flags(args: list[str]) -> list[str]:
        """Expand smooshed flags like -rn1 into [-r, -n, 1], -rd into [-r, -d].

        Simple flags (no value): r, s
        Value flags (consume rest or next arg): d, n, N, a, u, p, t
        """
        simple_flags = set("rs")
        value_flags = set("dnNaupt")
        result = []

        for arg in args:
            if not arg.startswith("-") or arg == "-" or arg == "--":
                result.append(arg)
                continue

            # Parse the flag characters
            chars = arg[1:]  # strip leading -
            ci = 0
            while ci < len(chars):
                c = chars[ci]
                if c in simple_flags:
                    result.append(f"-{c}")
                    ci += 1
                elif c in value_flags:
                    # Value flag - rest of string is the value (if any)
                    rest = chars[ci + 1:]
                    result.append(f"-{c}")
                    if rest:
                        result.append(rest)
                    break
                else:
                    # Unknown flag character - emit the whole remaining as-is
                    result.append(f"-{chars[ci:]}")
                    break
            continue

        return result

    def _strip_ifs_whitespace(self, value: str, ifs: str) -> str:
        """Strip leading and trailing IFS whitespace characters."""
        if not ifs:
            return value
        ifs_ws = set(c for c in ifs if c in " \t\n")
        if not ifs_ws:
            return value
        # Strip leading
        start = 0
        while start < len(value) and value[start] in ifs_ws:
            start += 1
        # Strip trailing
        end = len(value)
        while end > start and value[end - 1] in ifs_ws:
            end -= 1
        return value[start:end]

    def _assign_split_vars(self, line: str, var_names: list[str], ifs: str, ctx: CommandContext) -> None:
        """Split line on IFS and assign to multiple variables.

        The last variable gets the remainder of the line (preserving
        original separators from the input).
        """
        ifs_ws = set(c for c in ifs if c in " \t\n")
        ifs_nonws = set(c for c in ifs if c not in " \t\n")

        # We need to track positions in the original line so the last
        # variable gets the remainder from the original string
        num_vars = len(var_names)
        words = []
        pos = 0

        # Skip leading IFS whitespace
        while pos < len(line) and line[pos] in ifs_ws:
            pos += 1

        for var_idx in range(num_vars):
            if pos >= len(line):
                # No more input - set remaining vars to empty
                for vi in range(var_idx, num_vars):
                    ctx.env[var_names[vi]] = ""
                return

            if var_idx == num_vars - 1:
                # Last variable: gets the rest of the line, with trailing
                # IFS whitespace stripped
                remainder = line[pos:]
                # Strip trailing IFS whitespace
                end = len(remainder)
                while end > 0 and remainder[end - 1] in ifs_ws:
                    end -= 1
                ctx.env[var_names[var_idx]] = remainder[:end]
                return

            # Collect next word
            word_start = pos
            while pos < len(line) and line[pos] not in ifs_ws and line[pos] not in ifs_nonws:
                pos += 1

            word = line[word_start:pos]
            ctx.env[var_names[var_idx]] = word

            # Skip IFS delimiters between words
            # Whitespace IFS chars: skip all consecutive
            # Non-whitespace IFS chars: each one is a delimiter
            # Whitespace around non-whitespace is part of the delimiter
            if pos < len(line):
                # Skip leading whitespace
                while pos < len(line) and line[pos] in ifs_ws:
                    pos += 1
                # If we hit a non-whitespace delimiter, consume it
                if pos < len(line) and line[pos] in ifs_nonws:
                    pos += 1
                    # Skip trailing whitespace after non-ws delimiter
                    while pos < len(line) and line[pos] in ifs_ws:
                        pos += 1

        # Shouldn't reach here, but just in case
        for vi in range(len(words), num_vars):
            if var_names[vi] not in ctx.env:
                ctx.env[var_names[vi]] = ""

    def _split_on_ifs(self, value: str, ifs: str) -> list[str]:
        """Split a string on IFS characters.

        Follows bash IFS splitting rules:
        - IFS whitespace (space, tab, newline): leading/trailing stripped,
          consecutive act as single separator
        - IFS non-whitespace: each occurrence is a separator, consecutive
          produce empty fields
        - Mixed: whitespace adjacent to non-whitespace is part of the delimiter
        """
        if not value:
            return []

        ifs_ws = set(c for c in ifs if c in " \t\n")
        ifs_nonws = set(c for c in ifs if c not in " \t\n")

        # Whitespace-only IFS: simple split (strips leading/trailing, merges consecutive)
        if not ifs_nonws:
            return value.split()

        result = []
        current = []
        pos = 0

        # Skip leading IFS whitespace
        while pos < len(value) and value[pos] in ifs_ws:
            pos += 1

        while pos < len(value):
            c = value[pos]
            if c in ifs_nonws:
                # Non-whitespace delimiter: always produces field boundary
                result.append("".join(current))
                current = []
                pos += 1
                # Skip trailing IFS whitespace after non-ws delimiter
                while pos < len(value) and value[pos] in ifs_ws:
                    pos += 1
            elif c in ifs_ws:
                # IFS whitespace - check for composite delimiter (ws + nonws)
                if current:
                    saved = "".join(current)
                    current = []
                else:
                    saved = None
                # Skip consecutive whitespace
                while pos < len(value) and value[pos] in ifs_ws:
                    pos += 1
                # Check if followed by non-ws delimiter (composite delimiter)
                if pos < len(value) and value[pos] in ifs_nonws:
                    # Composite: ws + nonws counted as one delimiter
                    if saved is not None:
                        result.append(saved)
                    pos += 1  # consume the nonws char
                    # Skip trailing whitespace after nonws
                    while pos < len(value) and value[pos] in ifs_ws:
                        pos += 1
                else:
                    if saved is not None:
                        result.append(saved)
            else:
                current.append(c)
                pos += 1

        # Add last field if non-empty
        if current:
            result.append("".join(current))

        return result
