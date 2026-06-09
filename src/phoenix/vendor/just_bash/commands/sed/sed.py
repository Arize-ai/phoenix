"""Sed command implementation.

Usage: sed [OPTION]... {script} [input-file]...

Stream editor for filtering and transforming text.

Options:
  -n, --quiet, --silent  suppress automatic printing of pattern space
  -e script              add the script to commands to be executed
  -i, --in-place         edit files in place
  -E, -r                 use extended regular expressions

Commands:
  s/regexp/replacement/[flags]  substitute
  d                             delete pattern space
  p                             print pattern space
  a\\ text                       append text after line
  i\\ text                       insert text before line
  y/source/dest/                transliterate characters
  q                             quit

Addresses:
  N                line number
  $                last line
  /regexp/         lines matching regexp
  N,M              range from line N to M
"""

import re
from dataclasses import dataclass
from ...types import CommandContext, ExecResult


def _bre_to_python(pattern: str) -> str:
    """Convert a BRE (Basic Regular Expression) pattern to Python ERE.

    In BRE: +, ?, (, ), {, }, | are literal; \\+, \\?, \\(, \\), \\{, \\}, \\| are special.
    In Python ERE: +, ?, (, ), {, }, | are special; \\+, \\?, etc. are literal.
    """
    result = []
    i = 0
    in_bracket = False
    while i < len(pattern):
        ch = pattern[i]
        if in_bracket:
            result.append(ch)
            if ch == "]" and i > 0:
                in_bracket = False
            i += 1
            continue
        if ch == "[":
            in_bracket = True
            result.append(ch)
            i += 1
            # Handle ] as first char in bracket (literal)
            if i < len(pattern) and pattern[i] == "^":
                result.append(pattern[i])
                i += 1
            if i < len(pattern) and pattern[i] == "]":
                result.append(pattern[i])
                i += 1
            continue
        if ch == "\\" and i + 1 < len(pattern):
            nxt = pattern[i + 1]
            if nxt in "+?(){}|":
                # BRE \+ \? \( \) \{ \} \| → ERE special
                result.append(nxt)
                i += 2
                continue
            else:
                # Other escape sequences pass through
                result.append(ch)
                result.append(nxt)
                i += 2
                continue
        if ch in "+?(){}|":
            # Literal in BRE → escape for Python ERE
            result.append("\\")
            result.append(ch)
            i += 1
            continue
        result.append(ch)
        i += 1
    return "".join(result)


@dataclass
class SedAddress:
    """Represents a sed address."""

    type: str  # "line", "last", "regex", "range"
    value: int | str | None = None
    end_value: int | str | None = None
    regex: re.Pattern | None = None
    end_regex: re.Pattern | None = None


@dataclass
class SedCommand_:
    """A parsed sed command."""

    cmd: str  # s, d, p, a, i, y, q, h, H, g, G, x, n, N, etc.
    address: SedAddress | None = None
    negate: bool = False  # ! address negation
    pattern: re.Pattern | None = None
    replacement: str | None = None
    flags: str = ""
    text: str = ""  # For a, i, c commands
    source: str = ""  # For y command
    dest: str = ""  # For y command
    label: str = ""  # For b, t, T commands
    filename: str = ""  # For r, w commands


class SedCommand:
    """The sed command."""

    name = "sed"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the sed command."""
        scripts: list[str] = []
        silent = False
        in_place = False
        extended_regex = False
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg in ("-n", "--quiet", "--silent"):
                silent = True
            elif arg in ("-i", "--in-place"):
                in_place = True
            elif arg.startswith("-i"):
                in_place = True
            elif arg in ("-E", "-r", "--regexp-extended"):
                extended_regex = True
            elif arg == "-e":
                if i + 1 < len(args):
                    i += 1
                    scripts.append(args[i])
                else:
                    return ExecResult(
                        stdout="",
                        stderr="sed: option requires an argument -- 'e'\n",
                        exit_code=1,
                    )
            elif arg == "-f":
                if i + 1 < len(args):
                    i += 1
                    try:
                        path = ctx.fs.resolve_path(ctx.cwd, args[i])
                        content = await ctx.fs.read_file(path)
                        for line in content.split("\n"):
                            line = line.strip()
                            if line and not line.startswith("#"):
                                scripts.append(line)
                    except FileNotFoundError:
                        return ExecResult(
                            stdout="",
                            stderr=f"sed: couldn't open file {args[i]}: No such file or directory\n",
                            exit_code=1,
                        )
                else:
                    return ExecResult(
                        stdout="",
                        stderr="sed: option requires an argument -- 'f'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and len(arg) > 1 and not arg.startswith("--"):
                # Combined short options
                for j, c in enumerate(arg[1:], 1):
                    if c == "n":
                        silent = True
                    elif c == "i":
                        in_place = True
                    elif c == "E" or c == "r":
                        extended_regex = True
                    elif c == "e":
                        if j < len(arg) - 1:
                            scripts.append(arg[j + 1:])
                            break
                        elif i + 1 < len(args):
                            i += 1
                            scripts.append(args[i])
                            break
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"sed: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            elif not scripts:
                # First non-option is the script
                scripts.append(arg)
            else:
                files.append(arg)
            i += 1

        if not scripts:
            return ExecResult(
                stdout="",
                stderr="sed: no script specified\n",
                exit_code=1,
            )

        # Parse scripts into commands
        try:
            commands = self._parse_scripts(scripts, extended_regex)
        except ValueError as e:
            return ExecResult(
                stdout="",
                stderr=f"sed: {e}\n",
                exit_code=1,
            )

        # Default to stdin
        if not files:
            files = ["-"]

        # Process files
        all_output = ""
        stderr = ""

        for f in files:
            try:
                if f == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, f)
                    content = await ctx.fs.read_file(path)

                # Determine the current file name for F command
                current_file = f if f != "-" else ""

                output, write_buffers, read_requests, r_file_pos = self._process_content(
                    content, commands, silent, ctx, current_file
                )

                # Process read requests (r command)
                for idx, filename in read_requests:
                    placeholder = f"__READ_FILE__{idx}__"
                    try:
                        read_path = ctx.fs.resolve_path(ctx.cwd, filename)
                        file_content = await ctx.fs.read_file(read_path)
                        # Ensure content ends with newline
                        if file_content and not file_content.endswith("\n"):
                            file_content += "\n"
                        output = output.replace(placeholder, file_content)
                    except FileNotFoundError:
                        # Real sed silently ignores nonexistent files for r command
                        output = output.replace(placeholder, "")

                # Process R command (read single line)
                # Cache file lines for efficiency
                r_file_cache: dict[str, list[str]] = {}
                for filename, max_pos in r_file_pos.items():
                    if filename not in r_file_cache:
                        try:
                            read_path = ctx.fs.resolve_path(ctx.cwd, filename)
                            file_content = await ctx.fs.read_file(read_path)
                            r_file_cache[filename] = file_content.split("\n")
                            # Remove trailing empty line if file ended with newline
                            if r_file_cache[filename] and r_file_cache[filename][-1] == "":
                                r_file_cache[filename] = r_file_cache[filename][:-1]
                        except FileNotFoundError:
                            r_file_cache[filename] = []

                    # Replace placeholders with actual lines
                    for pos in range(max_pos):
                        placeholder = f"__READ_LINE__{filename}__{pos}__"
                        if pos < len(r_file_cache[filename]):
                            line = r_file_cache[filename][pos] + "\n"
                            output = output.replace(placeholder, line)
                        else:
                            # No more lines in file
                            output = output.replace(placeholder, "")

                # Process write buffers (w command)
                for filename, lines in write_buffers.items():
                    try:
                        write_path = ctx.fs.resolve_path(ctx.cwd, filename)
                        write_content = "\n".join(lines)
                        if write_content and not write_content.endswith("\n"):
                            write_content += "\n"
                        await ctx.fs.write_file(write_path, write_content)
                    except Exception:
                        pass  # Silently ignore write errors like real sed

                if in_place and f != "-":
                    path = ctx.fs.resolve_path(ctx.cwd, f)
                    await ctx.fs.write_file(path, output)
                else:
                    all_output += output

            except FileNotFoundError:
                stderr += f"sed: {f}: No such file or directory\n"
                continue

        if stderr:
            return ExecResult(stdout=all_output, stderr=stderr, exit_code=1)

        return ExecResult(stdout=all_output, stderr="", exit_code=0)

    def _parse_scripts(self, scripts: list[str], extended_regex: bool) -> list[SedCommand_]:
        """Parse sed scripts into commands."""
        commands: list[SedCommand_] = []

        for script in scripts:
            # Split respecting brace nesting
            for cmd_str in self._split_script(script):
                cmd_str = cmd_str.strip()
                if not cmd_str:
                    continue

                # Handle grouped commands: addr{cmd1;cmd2}
                brace_pos = cmd_str.find("{")
                if brace_pos != -1 and cmd_str.endswith("}"):
                    addr_prefix = cmd_str[:brace_pos]
                    inner = cmd_str[brace_pos + 1 : -1]
                    for inner_cmd in inner.split(";"):
                        inner_cmd = inner_cmd.strip()
                        if inner_cmd:
                            full_cmd = addr_prefix + inner_cmd
                            cmd = self._parse_command(full_cmd, extended_regex)
                            if cmd:
                                commands.append(cmd)
                else:
                    cmd = self._parse_command(cmd_str, extended_regex)
                    if cmd:
                        commands.append(cmd)

        return commands

    def _split_script(self, script: str) -> list[str]:
        """Split a script on semicolons and newlines, respecting brace nesting."""
        parts: list[str] = []
        current: list[str] = []
        depth = 0

        for ch in script:
            if ch == "{":
                depth += 1
                current.append(ch)
            elif ch == "}":
                depth -= 1
                current.append(ch)
            elif ch in ";\n" and depth == 0:
                parts.append("".join(current))
                current = []
            else:
                current.append(ch)

        if current:
            parts.append("".join(current))

        return parts

    def _parse_command(self, cmd_str: str, extended_regex: bool) -> SedCommand_ | None:
        """Parse a single sed command."""
        pos = 0
        address = None

        # Parse address if present
        if cmd_str and cmd_str[0].isdigit():
            # Line number address
            match = re.match(r"(\d+)(?:,(\d+|\$))?", cmd_str)
            if match:
                start = int(match.group(1))
                if match.group(2):
                    if match.group(2) == "$":
                        address = SedAddress(type="range", value=start, end_value="$")
                    else:
                        address = SedAddress(type="range", value=start, end_value=int(match.group(2)))
                else:
                    address = SedAddress(type="line", value=start)
                pos = match.end()
        elif cmd_str and cmd_str[0] == "$":
            address = SedAddress(type="last")
            pos = 1
        elif cmd_str and cmd_str[0] == "/":
            # Regex address
            end = self._find_delimiter(cmd_str, 1, "/")
            if end != -1:
                pattern = cmd_str[1:end]
                flags = re.IGNORECASE if extended_regex else 0
                try:
                    py_pat = pattern if extended_regex else _bre_to_python(pattern)
                    address = SedAddress(type="regex", regex=re.compile(py_pat, flags))
                except re.error as e:
                    raise ValueError(f"invalid regex: {e}")
                pos = end + 1

                # Check for range
                if pos < len(cmd_str) and cmd_str[pos] == ",":
                    pos += 1
                    if pos < len(cmd_str):
                        if cmd_str[pos] == "$":
                            address = SedAddress(type="range", regex=address.regex, end_value="$")
                            pos += 1
                        elif cmd_str[pos].isdigit():
                            match = re.match(r"(\d+)", cmd_str[pos:])
                            if match:
                                address = SedAddress(type="range", regex=address.regex, end_value=int(match.group(1)))
                                pos += match.end()
                        elif cmd_str[pos] == "/":
                            end2 = self._find_delimiter(cmd_str, pos + 1, "/")
                            if end2 != -1:
                                pattern2 = cmd_str[pos + 1:end2]
                                py_pat2 = pattern2 if extended_regex else _bre_to_python(pattern2)
                                try:
                                    address = SedAddress(
                                        type="range",
                                        regex=address.regex,
                                        end_regex=re.compile(py_pat2, flags),
                                    )
                                except re.error as e:
                                    raise ValueError(f"invalid regex: {e}")
                                pos = end2 + 1

        # Skip whitespace
        while pos < len(cmd_str) and cmd_str[pos] in " \t":
            pos += 1

        # Check for negation
        negate = False
        if pos < len(cmd_str) and cmd_str[pos] == "!":
            negate = True
            pos += 1
            # Skip whitespace after !
            while pos < len(cmd_str) and cmd_str[pos] in " \t":
                pos += 1

        if pos >= len(cmd_str):
            return None

        cmd_char = cmd_str[pos]
        pos += 1
        result = None

        if cmd_char == "s":
            # Substitution
            if pos >= len(cmd_str):
                raise ValueError("unterminated s command")

            delim = cmd_str[pos]
            pos += 1

            # Find pattern
            end = self._find_delimiter(cmd_str, pos, delim)
            if end == -1:
                raise ValueError("unterminated s command")
            pattern = cmd_str[pos:end]
            pos = end + 1

            # Find replacement
            end = self._find_delimiter(cmd_str, pos, delim)
            if end == -1:
                raise ValueError("unterminated s command")
            replacement = cmd_str[pos:end]
            pos = end + 1

            # Parse flags
            flags = cmd_str[pos:] if pos < len(cmd_str) else ""

            regex_flags = 0
            if "i" in flags or extended_regex:
                regex_flags |= re.IGNORECASE

            try:
                py_pat = pattern if extended_regex else _bre_to_python(pattern)
                compiled = re.compile(py_pat, regex_flags)
            except re.error as e:
                raise ValueError(f"invalid regex: {e}")

            result = SedCommand_(
                cmd="s",
                address=address,
                pattern=compiled,
                replacement=replacement,
                flags=flags,
            )

        elif cmd_char == "y":
            # Transliterate
            if pos >= len(cmd_str):
                raise ValueError("unterminated y command")

            delim = cmd_str[pos]
            pos += 1

            end = self._find_delimiter(cmd_str, pos, delim)
            if end == -1:
                raise ValueError("unterminated y command")
            source = cmd_str[pos:end]
            pos = end + 1

            end = self._find_delimiter(cmd_str, pos, delim)
            if end == -1:
                raise ValueError("unterminated y command")
            dest = cmd_str[pos:end]

            if len(source) != len(dest):
                raise ValueError("y command requires equal length strings")

            result = SedCommand_(
                cmd="y",
                address=address,
                source=source,
                dest=dest,
            )

        elif cmd_char == "d":
            result = SedCommand_(cmd="d", address=address)

        elif cmd_char == "=":
            # Print line number
            result = SedCommand_(cmd="=", address=address)

        elif cmd_char == "p":
            result = SedCommand_(cmd="p", address=address)

        elif cmd_char == "l":
            # List pattern space with escapes
            result = SedCommand_(cmd="l", address=address)

        elif cmd_char == "F":
            # Print filename
            result = SedCommand_(cmd="F", address=address)

        elif cmd_char == "q":
            result = SedCommand_(cmd="q", address=address)

        elif cmd_char in ("a", "i", "c"):
            # Append, insert, or change
            text = cmd_str[pos:].lstrip()
            if text.startswith("\\"):
                text = text[1:].lstrip()
            result = SedCommand_(cmd=cmd_char, address=address, text=text)

        elif cmd_char in ("h", "H", "g", "G", "x"):
            # Hold space commands
            result = SedCommand_(cmd=cmd_char, address=address)

        elif cmd_char in ("n", "N"):
            # Next line commands
            result = SedCommand_(cmd=cmd_char, address=address)

        elif cmd_char in ("P", "D"):
            # Print/delete first line of pattern space
            result = SedCommand_(cmd=cmd_char, address=address)

        elif cmd_char == "b":
            # Branch to label
            label = cmd_str[pos:].strip()
            result = SedCommand_(cmd="b", address=address, label=label)

        elif cmd_char == "t":
            # Branch on successful substitute
            label = cmd_str[pos:].strip()
            result = SedCommand_(cmd="t", address=address, label=label)

        elif cmd_char == "T":
            # Branch on failed substitute
            label = cmd_str[pos:].strip()
            result = SedCommand_(cmd="T", address=address, label=label)

        elif cmd_char == ":":
            # Label definition
            label = cmd_str[pos:].strip()
            result = SedCommand_(cmd=":", label=label)

        elif cmd_char == "r":
            # Read file
            filename = cmd_str[pos:].strip()
            result = SedCommand_(cmd="r", address=address, filename=filename)

        elif cmd_char == "w":
            # Write to file
            filename = cmd_str[pos:].strip()
            result = SedCommand_(cmd="w", address=address, filename=filename)

        elif cmd_char == "R":
            # Read single line from file
            filename = cmd_str[pos:].strip()
            result = SedCommand_(cmd="R", address=address, filename=filename)

        elif cmd_char == "{":
            # Start of block (handled in parsing)
            pass

        elif cmd_char == "}":
            # End of block (handled in parsing)
            pass

        else:
            raise ValueError(f"unknown command: {cmd_char}")

        if result is not None and negate:
            result.negate = True
        return result

    def _find_delimiter(self, s: str, start: int, delim: str) -> int:
        """Find the next unescaped delimiter."""
        i = start
        while i < len(s):
            if s[i] == "\\" and i + 1 < len(s):
                i += 2
            elif s[i] == delim:
                return i
            else:
                i += 1
        return -1

    def _process_content(
        self, content: str, commands: list[SedCommand_], silent: bool,
        ctx: "CommandContext | None" = None,
        current_file: str = ""
    ) -> tuple[str, dict[str, list[str]], list[tuple[int, str]], dict[str, int]]:
        """Process content through sed commands."""
        lines = content.split("\n")
        # Remove trailing empty line if present
        if lines and lines[-1] == "":
            lines = lines[:-1]

        output = ""
        total_lines = len(lines)

        # Track range state for each command
        in_range: dict[int, bool] = {}

        # Build label index
        labels: dict[str, int] = {}
        for cmd_idx, cmd in enumerate(commands):
            if cmd.cmd == ":" and cmd.label:
                labels[cmd.label] = cmd_idx

        # Hold space
        hold_space = ""

        # Track if last substitute succeeded (for t/T branching)
        sub_succeeded = False

        # Write file buffers
        write_buffers: dict[str, list[str]] = {}
        # Read file requests: (output_position, filename)
        read_requests: list[tuple[int, str]] = []
        # R command file state: tracks current line position for each file
        r_file_lines: dict[str, list[str]] = {}
        r_file_pos: dict[str, int] = {}

        line_idx = 0
        while line_idx < len(lines):
            line = lines[line_idx]
            line_num = line_idx + 1
            pattern_space = line
            deleted = False
            insert_text = ""
            append_text = ""
            read_text = ""
            should_quit = False
            restart_cycle = False

            cmd_idx = 0
            while cmd_idx < len(commands):
                cmd = commands[cmd_idx]

                if deleted or should_quit:
                    break

                # Skip label definitions
                if cmd.cmd == ":":
                    cmd_idx += 1
                    continue

                # Check if address matches (with negation support)
                matches = self._address_matches(cmd.address, line_num, total_lines, pattern_space, in_range, cmd_idx)
                if cmd.negate:
                    matches = not matches
                if not matches:
                    cmd_idx += 1
                    continue

                if cmd.cmd == "s":
                    # Substitution
                    if cmd.pattern and cmd.replacement is not None:
                        if "g" in cmd.flags:
                            new_pattern = cmd.pattern.sub(
                                self._expand_replacement(cmd.replacement), pattern_space
                            )
                        else:
                            new_pattern = cmd.pattern.sub(
                                self._expand_replacement(cmd.replacement), pattern_space, count=1
                            )

                        if new_pattern != pattern_space:
                            pattern_space = new_pattern
                            sub_succeeded = True
                            if "p" in cmd.flags:
                                output += pattern_space + "\n"
                        else:
                            sub_succeeded = False

                elif cmd.cmd == "y":
                    # Transliterate
                    trans = str.maketrans(cmd.source, cmd.dest)
                    pattern_space = pattern_space.translate(trans)

                elif cmd.cmd == "d":
                    deleted = True

                elif cmd.cmd == "D":
                    # Delete first line of pattern space
                    if "\n" in pattern_space:
                        pattern_space = pattern_space.split("\n", 1)[1]
                        # Restart with remaining pattern space
                        cmd_idx = 0
                        continue
                    else:
                        deleted = True

                elif cmd.cmd == "=":
                    # Print line number
                    output += str(line_num) + "\n"

                elif cmd.cmd == "p":
                    output += pattern_space + "\n"

                elif cmd.cmd == "l":
                    # List pattern space with escapes
                    escaped = self._escape_for_list(pattern_space)
                    output += escaped + "$\n"

                elif cmd.cmd == "F":
                    # Print current filename
                    output += current_file + "\n"

                elif cmd.cmd == "P":
                    # Print first line of pattern space
                    first_line = pattern_space.split("\n", 1)[0]
                    output += first_line + "\n"

                elif cmd.cmd == "a":
                    append_text += cmd.text + "\n"

                elif cmd.cmd == "i":
                    insert_text += cmd.text + "\n"

                elif cmd.cmd == "c":
                    # Change: replace pattern space and delete
                    output += cmd.text + "\n"
                    deleted = True

                elif cmd.cmd == "q":
                    should_quit = True

                elif cmd.cmd == "h":
                    # Copy pattern space to hold space
                    hold_space = pattern_space

                elif cmd.cmd == "H":
                    # Append pattern space to hold space
                    if hold_space:
                        hold_space += "\n" + pattern_space
                    else:
                        hold_space = pattern_space

                elif cmd.cmd == "g":
                    # Copy hold space to pattern space
                    pattern_space = hold_space

                elif cmd.cmd == "G":
                    # Append hold space to pattern space
                    pattern_space += "\n" + hold_space

                elif cmd.cmd == "x":
                    # Exchange pattern and hold space
                    pattern_space, hold_space = hold_space, pattern_space

                elif cmd.cmd == "n":
                    # Print pattern space (unless silent), read next line
                    if not silent:
                        output += pattern_space + "\n"
                    line_idx += 1
                    if line_idx < len(lines):
                        pattern_space = lines[line_idx]
                        line_num = line_idx + 1
                    else:
                        deleted = True

                elif cmd.cmd == "N":
                    # Append next line to pattern space
                    line_idx += 1
                    if line_idx < len(lines):
                        pattern_space += "\n" + lines[line_idx]
                    else:
                        # No more lines, end
                        should_quit = True

                elif cmd.cmd == "b":
                    # Branch to label (or end if no label)
                    if cmd.label and cmd.label in labels:
                        cmd_idx = labels[cmd.label]
                        continue
                    else:
                        # Branch to end of script
                        break

                elif cmd.cmd == "t":
                    # Branch if last substitute succeeded
                    if sub_succeeded:
                        sub_succeeded = False
                        if cmd.label and cmd.label in labels:
                            cmd_idx = labels[cmd.label]
                            continue
                        else:
                            break

                elif cmd.cmd == "T":
                    # Branch if last substitute failed
                    if not sub_succeeded:
                        if cmd.label and cmd.label in labels:
                            cmd_idx = labels[cmd.label]
                            continue
                        else:
                            break

                elif cmd.cmd == "r":
                    # Read file (content appended after current line)
                    if cmd.filename:
                        # Store placeholder for where to insert file content
                        append_text += f"__READ_FILE__{len(read_requests)}__"
                        read_requests.append((len(read_requests), cmd.filename))

                elif cmd.cmd == "w":
                    # Write pattern space to file
                    if cmd.filename:
                        if cmd.filename not in write_buffers:
                            write_buffers[cmd.filename] = []
                        write_buffers[cmd.filename].append(pattern_space)

                elif cmd.cmd == "R":
                    # Read single line from file
                    if cmd.filename:
                        # Initialize file lines if not already loaded
                        if cmd.filename not in r_file_lines:
                            r_file_lines[cmd.filename] = None  # Placeholder for async load
                            r_file_pos[cmd.filename] = 0
                        # Store placeholder for where to insert the line
                        pos = r_file_pos.get(cmd.filename, 0)
                        append_text += f"__READ_LINE__{cmd.filename}__{pos}__"
                        r_file_pos[cmd.filename] = pos + 1

                cmd_idx += 1

            # Output insert text before line
            if insert_text:
                output += insert_text

            # Output line unless deleted or silent mode
            if not deleted:
                if not silent:
                    output += pattern_space + "\n"

            # Output append text after line
            if append_text:
                output += append_text

            if should_quit:
                break

            line_idx += 1

        return output, write_buffers, read_requests, r_file_pos

    def _address_matches(
        self,
        address: SedAddress | None,
        line_num: int,
        total_lines: int,
        pattern_space: str,
        in_range: dict[int, bool],
        cmd_idx: int,
    ) -> bool:
        """Check if an address matches the current line."""
        if address is None:
            return True

        if address.type == "line":
            return line_num == address.value

        elif address.type == "last":
            return line_num == total_lines

        elif address.type == "regex":
            if address.regex:
                return bool(address.regex.search(pattern_space))
            return False

        elif address.type == "range":
            # Check if we're entering or in a range
            if cmd_idx not in in_range:
                in_range[cmd_idx] = False

            if not in_range[cmd_idx]:
                # Check start condition
                start_match = False
                if address.value is not None:
                    start_match = line_num == address.value
                elif address.regex:
                    start_match = bool(address.regex.search(pattern_space))

                if start_match:
                    in_range[cmd_idx] = True

            if in_range[cmd_idx]:
                # Check end condition
                end_match = False
                if address.end_value == "$":
                    end_match = line_num == total_lines
                elif isinstance(address.end_value, int):
                    end_match = line_num >= address.end_value
                elif address.end_regex:
                    end_match = bool(address.end_regex.search(pattern_space))

                if end_match:
                    in_range[cmd_idx] = False

                return True

            return False

        return False

    def _expand_replacement(self, replacement: str) -> str:
        """Expand replacement string, handling backreferences."""
        # Convert \1, \2, etc. to Python's \g<1>, \g<2>
        result = replacement
        result = re.sub(r"\\(\d)", r"\\g<\1>", result)
        # Handle & for entire match
        result = result.replace("&", r"\g<0>")
        return result

    def _escape_for_list(self, s: str) -> str:
        """Escape a string for the 'l' command output."""
        result = []
        for c in s:
            if c == "\\":
                result.append("\\\\")
            elif c == "\t":
                result.append("\\t")
            elif c == "\n":
                result.append("\\n")
            elif c == "\r":
                result.append("\\r")
            elif c == "\a":
                result.append("\\a")
            elif c == "\b":
                result.append("\\b")
            elif c == "\f":
                result.append("\\f")
            elif c == "\v":
                result.append("\\v")
            elif ord(c) < 32 or ord(c) > 126:
                # Non-printable character - show as octal or hex
                result.append(f"\\x{ord(c):02x}")
            else:
                result.append(c)
        return "".join(result)
