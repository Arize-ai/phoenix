"""Sort command implementation.

Usage: sort [OPTION]... [FILE]...

Write sorted concatenation of all FILE(s) to standard output.

Options:
  -b, --ignore-leading-blanks  ignore leading blanks
  -f, --ignore-case            fold lower case to upper case characters
  -n, --numeric-sort           compare according to string numerical value
  -r, --reverse                reverse the result of comparisons
  -u, --unique                 output only the first of an equal run
  -t, --field-separator=SEP    use SEP instead of non-blank to blank transition
  -k, --key=KEYDEF             sort via a key; KEYDEF gives location and type
  -o, --output=FILE            write result to FILE instead of standard output
  -s, --stable                 stabilize sort by disabling last-resort comparison

KEYDEF is F[.C][OPTS][,F[.C][OPTS]] for start and stop position.
F is field number, C is character position (both 1-indexed).
OPTS is one or more single-letter ordering options [bfnr].
"""

import re
from ...types import CommandContext, ExecResult


class SortCommand:
    """The sort command."""

    name = "sort"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the sort command."""
        ignore_blanks = False
        ignore_case = False
        numeric = False
        reverse = False
        unique = False
        separator = None
        keys: list[dict] = []
        output_file = None
        stable = False
        check_sorted = False
        human_numeric = False
        version_sort = False
        month_sort = False
        dictionary_order = False
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--ignore-leading-blanks":
                    ignore_blanks = True
                elif arg == "--ignore-case":
                    ignore_case = True
                elif arg == "--numeric-sort":
                    numeric = True
                elif arg == "--reverse":
                    reverse = True
                elif arg == "--unique":
                    unique = True
                elif arg == "--stable":
                    stable = True
                elif arg.startswith("--field-separator="):
                    separator = arg[18:]
                elif arg.startswith("--key="):
                    key = self._parse_key(arg[6:])
                    if key is None:
                        return ExecResult(
                            stdout="",
                            stderr=f"sort: invalid key specification: '{arg[6:]}'\n",
                            exit_code=1,
                        )
                    keys.append(key)
                elif arg.startswith("--output="):
                    output_file = arg[9:]
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"sort: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "b":
                        ignore_blanks = True
                    elif c == "f":
                        ignore_case = True
                    elif c == "n":
                        numeric = True
                    elif c == "r":
                        reverse = True
                    elif c == "u":
                        unique = True
                    elif c == "s":
                        stable = True
                    elif c == "c":
                        check_sorted = True
                    elif c == "h":
                        human_numeric = True
                    elif c == "V":
                        version_sort = True
                    elif c == "M":
                        month_sort = True
                    elif c == "d":
                        dictionary_order = True
                    elif c == "t":
                        # -t requires a value
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
                                stderr="sort: option requires an argument -- 't'\n",
                                exit_code=1,
                            )
                    elif c == "k":
                        # -k requires a value
                        if j + 1 < len(arg):
                            key_spec = arg[j + 1:]
                        elif i + 1 < len(args):
                            i += 1
                            key_spec = args[i]
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="sort: option requires an argument -- 'k'\n",
                                exit_code=1,
                            )
                        key = self._parse_key(key_spec)
                        if key is None:
                            return ExecResult(
                                stdout="",
                                stderr=f"sort: invalid key specification: '{key_spec}'\n",
                                exit_code=1,
                            )
                        keys.append(key)
                        break
                    elif c == "o":
                        # -o requires a value
                        if j + 1 < len(arg):
                            output_file = arg[j + 1:]
                            break
                        elif i + 1 < len(args):
                            i += 1
                            output_file = args[i]
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="sort: option requires an argument -- 'o'\n",
                                exit_code=1,
                            )
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"sort: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            else:
                files.append(arg)
            i += 1

        # Default to stdin
        if not files:
            files = ["-"]

        # Read all lines from all files
        all_lines: list[str] = []
        stderr = ""
        exit_code = 0

        for f in files:
            try:
                if f == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, f)
                    content = await ctx.fs.read_file(path)

                lines = content.split("\n")
                # Remove trailing empty line if present
                if lines and lines[-1] == "":
                    lines = lines[:-1]
                all_lines.extend(lines)

            except FileNotFoundError:
                stderr += f"sort: {f}: No such file or directory\n"
                exit_code = 1

        if exit_code != 0:
            return ExecResult(stdout="", stderr=stderr, exit_code=exit_code)

        # Create sort key function
        def make_key(line: str):
            if version_sort:
                return self._version_key(line)
            if month_sort:
                return self._month_key(line)
            if human_numeric:
                return self._human_numeric_key(line)
            if keys:
                key_values = []
                for key in keys:
                    val = self._extract_key(line, key, separator)
                    key_values.append(self._make_comparable(val, key))
                return tuple(key_values)
            else:
                return self._make_comparable(
                    line,
                    {
                        "ignore_blanks": ignore_blanks,
                        "ignore_case": ignore_case,
                        "numeric": numeric,
                        "dictionary_order": dictionary_order,
                    },
                )

        # Check sorted mode
        if check_sorted:
            for i in range(1, len(all_lines)):
                prev_key = make_key(all_lines[i - 1])
                curr_key = make_key(all_lines[i])
                if reverse:
                    is_sorted = prev_key >= curr_key
                else:
                    is_sorted = prev_key <= curr_key
                if not is_sorted:
                    return ExecResult(
                        stdout="",
                        stderr=f"sort: {files[0]}:{i + 1}: disorder: {all_lines[i]}\n",
                        exit_code=1,
                    )
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Sort
        try:
            sorted_lines = sorted(all_lines, key=make_key, reverse=reverse)
        except Exception:
            # Fallback to string sort
            sorted_lines = sorted(all_lines, reverse=reverse)

        # Apply unique
        if unique:
            unique_lines = []
            seen_keys = set()
            for line in sorted_lines:
                key = make_key(line)
                if key not in seen_keys:
                    seen_keys.add(key)
                    unique_lines.append(line)
            sorted_lines = unique_lines

        # Generate output
        stdout = "\n".join(sorted_lines)
        if sorted_lines:
            stdout += "\n"

        # Write to output file if specified
        if output_file:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, output_file)
                await ctx.fs.write_file(path, stdout)
                return ExecResult(stdout="", stderr=stderr, exit_code=exit_code)
            except Exception as e:
                return ExecResult(
                    stdout="",
                    stderr=f"sort: {output_file}: {e}\n",
                    exit_code=1,
                )

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)

    def _parse_key(self, spec: str) -> dict | None:
        """Parse a key specification like '2,2' or '1.3,1.5n'."""
        # Pattern: F[.C][OPTS][,F[.C][OPTS]]
        pattern = r"^(\d+)(?:\.(\d+))?([bfnr]*)?(?:,(\d+)(?:\.(\d+))?([bfnr]*)?)?$"
        match = re.match(pattern, spec)
        if not match:
            return None

        key = {
            "start_field": int(match.group(1)),
            "start_char": int(match.group(2)) if match.group(2) else 1,
            "end_field": int(match.group(4)) if match.group(4) else None,
            "end_char": int(match.group(5)) if match.group(5) else None,
            "ignore_blanks": "b" in (match.group(3) or "") or "b" in (match.group(6) or ""),
            "ignore_case": "f" in (match.group(3) or "") or "f" in (match.group(6) or ""),
            "numeric": "n" in (match.group(3) or "") or "n" in (match.group(6) or ""),
            "reverse": "r" in (match.group(3) or "") or "r" in (match.group(6) or ""),
        }
        return key

    def _extract_key(self, line: str, key: dict, separator: str | None) -> str:
        """Extract the key portion from a line."""
        if separator:
            fields = line.split(separator)
        else:
            # Split on whitespace runs
            fields = line.split()

        start_field = key["start_field"] - 1  # 0-indexed
        start_char = key["start_char"] - 1  # 0-indexed
        end_field = key.get("end_field")
        end_char = key.get("end_char")

        if start_field >= len(fields):
            return ""

        if end_field is None:
            # Just the start field from start_char
            field_content = fields[start_field] if start_field < len(fields) else ""
            return field_content[start_char:]
        else:
            end_field -= 1  # 0-indexed
            if end_field >= len(fields):
                end_field = len(fields) - 1

            # Extract from start to end field
            parts = []
            for i in range(start_field, end_field + 1):
                if i >= len(fields):
                    break
                if i == start_field:
                    parts.append(fields[i][start_char:])
                elif i == end_field and end_char:
                    parts.append(fields[i][:end_char])
                else:
                    parts.append(fields[i])

            return (separator or " ").join(parts)

    def _make_comparable(self, val: str, opts: dict) -> tuple:
        """Make a value comparable based on options."""
        if opts.get("ignore_blanks"):
            val = val.lstrip()

        # Dictionary order: keep only blanks and alphanumerics for comparison
        if opts.get("dictionary_order"):
            compare_val = ''.join(c for c in val if c.isalnum() or c.isspace())
        else:
            compare_val = val

        if opts.get("ignore_case"):
            compare_val = compare_val.lower()

        if opts.get("numeric"):
            # Try to extract leading number
            match = re.match(r"^\s*(-?\d+(?:\.\d+)?)", compare_val)
            if match:
                try:
                    num = float(match.group(1))
                    return (0, num, compare_val)
                except ValueError:
                    pass
            # Non-numeric sorts before any number
            return (1, 0, compare_val)

        return (0, compare_val)

    def _version_key(self, val: str) -> tuple:
        """Create a sort key for version sorting (v1.2.10 style)."""
        # Extract version components
        parts = []
        for part in re.split(r"(\d+)", val):
            if part.isdigit():
                parts.append((0, int(part)))
            elif part:
                parts.append((1, part))
        return tuple(parts)

    def _month_key(self, val: str) -> tuple:
        """Create a sort key for month sorting."""
        months = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
            "january": 1, "february": 2, "march": 3, "april": 4,
            "june": 6, "july": 7, "august": 8, "september": 9,
            "october": 10, "november": 11, "december": 12,
        }
        val_lower = val.strip().lower()[:3]
        month_num = months.get(val_lower, 0)
        return (month_num, val)

    def _human_numeric_key(self, val: str) -> tuple:
        """Create a sort key for human-readable numeric sorting (1K, 1M, 1G)."""
        suffixes = {"": 1, "k": 1024, "m": 1024**2, "g": 1024**3, "t": 1024**4}
        match = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*([kmgt]?)i?\s*$", val.strip(), re.IGNORECASE)
        if match:
            try:
                num = float(match.group(1))
                suffix = match.group(2).lower()
                multiplier = suffixes.get(suffix, 1)
                return (0, num * multiplier)
            except ValueError:
                pass
        return (1, val)
