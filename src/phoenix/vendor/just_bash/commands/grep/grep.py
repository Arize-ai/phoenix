"""Grep command implementation.

Usage: grep [OPTION]... PATTERN [FILE]...

Search for PATTERN in each FILE.
With no FILE, or when FILE is -, read standard input.

Options:
  -i, --ignore-case     ignore case distinctions
  -v, --invert-match    select non-matching lines
  -c, --count           print only a count of matching lines per FILE
  -l, --files-with-matches  print only names of FILEs with matches
  -L, --files-without-match  print only names of FILEs without matches
  -n, --line-number     print line number with output lines
  -H, --with-filename   print the file name for each match
  -h, --no-filename     suppress the file name prefix on output
  -o, --only-matching   show only the part of a line matching PATTERN
  -q, --quiet, --silent suppress all normal output
  -r, -R, --recursive   recursively search directories
  -E, --extended-regexp PATTERN is an extended regular expression
  -F, --fixed-strings   PATTERN is a set of newline-separated strings
  -w, --word-regexp     match only whole words
  -x, --line-regexp     match only whole lines
  -A NUM, --after-context=NUM   print NUM lines of trailing context
  -B NUM, --before-context=NUM  print NUM lines of leading context
  -C NUM, --context=NUM         print NUM lines of output context
  -m NUM, --max-count=NUM       stop after NUM matches
  -e PATTERN                    use PATTERN for matching
  --include=GLOB                search only files matching GLOB
  --exclude=GLOB                skip files matching GLOB
"""

import fnmatch
import re
from ...types import CommandContext, ExecResult


class GrepCommand:
    """The grep command."""

    name = "grep"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the grep command."""
        ignore_case = False
        invert_match = False
        count_only = False
        files_with_matches = False
        files_without_match = False
        line_numbers = False
        with_filename = None  # None means auto-detect based on file count
        only_matching = False
        quiet = False
        recursive = False
        extended_regexp = False
        fixed_strings = False
        word_regexp = False
        line_regexp = False
        after_context = 0
        before_context = 0
        max_count = None
        include_globs: list[str] = []
        exclude_globs: list[str] = []
        patterns: list[str] = []

        pattern = None
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                if pattern is None and i + 1 < len(args):
                    pattern = args[i + 1]
                    files.extend(args[i + 2:])
                else:
                    files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--ignore-case":
                    ignore_case = True
                elif arg == "--invert-match":
                    invert_match = True
                elif arg == "--count":
                    count_only = True
                elif arg == "--files-with-matches":
                    files_with_matches = True
                elif arg == "--files-without-match":
                    files_without_match = True
                elif arg == "--line-number":
                    line_numbers = True
                elif arg == "--with-filename":
                    with_filename = True
                elif arg == "--no-filename":
                    with_filename = False
                elif arg == "--only-matching":
                    only_matching = True
                elif arg == "--quiet" or arg == "--silent":
                    quiet = True
                elif arg == "--recursive":
                    recursive = True
                elif arg == "--extended-regexp":
                    extended_regexp = True
                elif arg == "--perl-regexp":
                    # Perl-compatible regex - Python's re is already PCRE-like
                    extended_regexp = True
                elif arg == "--fixed-strings":
                    fixed_strings = True
                elif arg == "--word-regexp":
                    word_regexp = True
                elif arg == "--line-regexp":
                    line_regexp = True
                elif arg.startswith("--after-context="):
                    after_context = int(arg.split("=", 1)[1])
                elif arg.startswith("--before-context="):
                    before_context = int(arg.split("=", 1)[1])
                elif arg.startswith("--context="):
                    ctx_val = int(arg.split("=", 1)[1])
                    before_context = after_context = ctx_val
                elif arg.startswith("--max-count="):
                    max_count = int(arg.split("=", 1)[1])
                elif arg.startswith("--include="):
                    include_globs.append(arg.split("=", 1)[1])
                elif arg.startswith("--exclude="):
                    exclude_globs.append(arg.split("=", 1)[1])
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"grep: unrecognized option '{arg}'\n",
                        exit_code=2,
                    )
            elif arg.startswith("-") and arg != "-":
                # Handle options that take arguments
                if arg in ("-A", "-B", "-C", "-m", "-e"):
                    if i + 1 >= len(args):
                        return ExecResult(
                            stdout="",
                            stderr=f"grep: option requires an argument -- '{arg[-1]}'\n",
                            exit_code=2,
                        )
                    i += 1
                    val = args[i]
                    if arg == "-A":
                        after_context = int(val)
                    elif arg == "-B":
                        before_context = int(val)
                    elif arg == "-C":
                        before_context = after_context = int(val)
                    elif arg == "-m":
                        max_count = int(val)
                    elif arg == "-e":
                        patterns.append(val)
                else:
                    chars = arg[1:]
                    ci = 0
                    while ci < len(chars):
                        c = chars[ci]
                        if c == 'i':
                            ignore_case = True
                        elif c == 'v':
                            invert_match = True
                        elif c == 'c':
                            count_only = True
                        elif c == 'l':
                            files_with_matches = True
                        elif c == 'L':
                            files_without_match = True
                        elif c == 'n':
                            line_numbers = True
                        elif c == 'H':
                            with_filename = True
                        elif c == 'h':
                            with_filename = False
                        elif c == 'o':
                            only_matching = True
                        elif c == 'q':
                            quiet = True
                        elif c == 'r' or c == 'R':
                            recursive = True
                        elif c == 'E':
                            extended_regexp = True
                        elif c == 'F':
                            fixed_strings = True
                        elif c == 'P':
                            # Perl-compatible regex - Python's re is already PCRE-like
                            extended_regexp = True
                        elif c == 'w':
                            word_regexp = True
                        elif c == 'x':
                            line_regexp = True
                        elif c in ('A', 'B', 'C', 'm', 'e'):
                            # These flags take a value: rest of string or next arg
                            rest = chars[ci + 1:]
                            if rest:
                                val = rest
                            elif i + 1 < len(args):
                                i += 1
                                val = args[i]
                            else:
                                return ExecResult(
                                    stdout="",
                                    stderr=f"grep: option requires an argument -- '{c}'\n",
                                    exit_code=2,
                                )
                            if c == 'A':
                                after_context = int(val)
                            elif c == 'B':
                                before_context = int(val)
                            elif c == 'C':
                                before_context = after_context = int(val)
                            elif c == 'm':
                                max_count = int(val)
                            elif c == 'e':
                                patterns.append(val)
                            break  # Rest of chars consumed as value
                        else:
                            return ExecResult(
                                stdout="",
                                stderr=f"grep: invalid option -- '{c}'\n",
                                exit_code=2,
                            )
                        ci += 1
            elif pattern is None and not patterns:
                pattern = arg
            else:
                files.append(arg)
            i += 1

        # Use -e patterns if provided, otherwise use positional pattern
        if patterns:
            if pattern:
                # If pattern was set, it's actually a file
                files.insert(0, pattern)
            # Convert each pattern from BRE before combining (if not ERE mode)
            if not extended_regexp and not fixed_strings:
                converted = [self._bre_to_python_regex(p) for p in patterns]
                pattern = "|".join(f"({p})" for p in converted)
            else:
                pattern = "|".join(f"({p})" for p in patterns)
            # Mark as already converted
            patterns_already_converted = True
        else:
            patterns_already_converted = False

        if pattern is None and not patterns:
            return ExecResult(
                stdout="",
                stderr="grep: pattern not specified\n",
                exit_code=2,
            )

        # Default to stdin
        if not files:
            files = ["-"]

        # Build regex pattern
        try:
            if fixed_strings:
                # Escape all regex metacharacters
                pattern = re.escape(pattern)
            elif not extended_regexp and not patterns_already_converted:
                # Convert BRE (Basic Regular Expression) to Python regex
                pattern = self._bre_to_python_regex(pattern)

            if word_regexp:
                pattern = r'\b' + pattern + r'\b'
            if line_regexp:
                pattern = '^' + pattern + '$'

            flags = re.IGNORECASE if ignore_case else 0
            regex = re.compile(pattern, flags)
        except re.error as e:
            return ExecResult(
                stdout="",
                stderr=f"grep: invalid pattern '{pattern}': {e}\n",
                exit_code=2,
            )

        # Expand files for recursive search
        expanded_files = []
        for file in files:
            if file == "-":
                expanded_files.append(file)
            else:
                path = ctx.fs.resolve_path(ctx.cwd, file)
                try:
                    if await ctx.fs.is_directory(path):
                        if recursive:
                            # Get all files recursively
                            all_files = await self._get_files_recursive(ctx, path)
                            expanded_files.extend(all_files)
                        else:
                            expanded_files.append(file)  # Will error later
                    else:
                        expanded_files.append(file)
                except FileNotFoundError:
                    expanded_files.append(file)  # Will error later

        # Filter by include/exclude globs
        if include_globs or exclude_globs:
            filtered_files = []
            for file in expanded_files:
                if file == "-":
                    filtered_files.append(file)
                    continue
                filename = file.split("/")[-1]
                # Check include
                if include_globs:
                    if not any(fnmatch.fnmatch(filename, g) for g in include_globs):
                        continue
                # Check exclude
                if exclude_globs:
                    if any(fnmatch.fnmatch(filename, g) for g in exclude_globs):
                        continue
                filtered_files.append(file)
            expanded_files = filtered_files

        # Auto-detect filename display
        if with_filename is None:
            with_filename = len(expanded_files) > 1

        stdout = ""
        stderr = ""
        found_match = False
        total_matches = 0

        for file in expanded_files:
            if max_count is not None and total_matches >= max_count:
                break

            try:
                if file == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file(path)

                lines = content.split("\n")
                # Handle trailing empty line from split
                if lines and lines[-1] == "":
                    lines = lines[:-1]

                match_count = 0
                file_has_match = False
                matched_line_nums: list[int] = []

                # First pass: find all matching lines
                for line_num, line in enumerate(lines, 1):
                    if max_count is not None and total_matches >= max_count:
                        break

                    match = regex.search(line)
                    matches_pattern = bool(match)

                    if invert_match:
                        matches_pattern = not matches_pattern

                    if matches_pattern:
                        match_count += 1
                        total_matches += 1
                        file_has_match = True
                        found_match = True
                        matched_line_nums.append(line_num)

                        if quiet:
                            return ExecResult(stdout="", stderr="", exit_code=0)

                # Second pass: output with context
                if not count_only and not files_with_matches and not files_without_match:
                    output_lines: set[int] = set()
                    for ln in matched_line_nums:
                        # Add before context
                        for b in range(max(1, ln - before_context), ln):
                            output_lines.add(b)
                        # Add match line
                        output_lines.add(ln)
                        # Add after context
                        for a in range(ln + 1, min(len(lines) + 1, ln + after_context + 1)):
                            output_lines.add(a)

                    prev_line = 0
                    for line_num in sorted(output_lines):
                        if line_num < 1 or line_num > len(lines):
                            continue
                        # Add separator for non-contiguous blocks
                        if before_context or after_context:
                            if prev_line > 0 and line_num > prev_line + 1:
                                stdout += "--\n"
                        prev_line = line_num

                        line = lines[line_num - 1]
                        is_match = line_num in matched_line_nums
                        match = regex.search(line) if is_match else None

                        if only_matching and match and not invert_match and is_match:
                            output = match.group(0)
                        else:
                            output = line

                        parts = []
                        if with_filename:
                            parts.append(f"{file}:")
                        if line_numbers:
                            sep = ":" if is_match else "-"
                            parts.append(f"{line_num}{sep}")
                        parts.append(output)
                        stdout += "".join(parts) + "\n"

                if count_only:
                    if with_filename:
                        stdout += f"{file}:{match_count}\n"
                    else:
                        stdout += f"{match_count}\n"
                elif files_with_matches and file_has_match:
                    stdout += f"{file}\n"
                elif files_without_match and not file_has_match:
                    stdout += f"{file}\n"

            except FileNotFoundError:
                stderr += f"grep: {file}: No such file or directory\n"
            except IsADirectoryError:
                stderr += f"grep: {file}: Is a directory\n"

        exit_code = 0 if found_match else 1
        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)

    def _bre_to_python_regex(self, pattern: str) -> str:
        """Convert BRE (Basic Regular Expression) to Python regex.

        In BRE:
        - \\| is alternation, | is literal
        - \\+ is one-or-more, + is literal
        - \\? is zero-or-one, ? is literal
        - \\( \\) is grouping, ( ) are literal
        - \\{ \\} is repetition, { } are literal
        - \\< \\> is word boundary

        In Python regex (like ERE):
        - | is alternation, \\| is literal
        - + is one-or-more, \\+ is literal
        - etc.
        """
        result = []
        i = 0
        while i < len(pattern):
            if pattern[i] == '\\' and i + 1 < len(pattern):
                next_char = pattern[i + 1]
                if next_char == '|':
                    # BRE \| -> Python |
                    result.append('|')
                    i += 2
                elif next_char == '+':
                    # BRE \+ -> Python +
                    result.append('+')
                    i += 2
                elif next_char == '?':
                    # BRE \? -> Python ?
                    result.append('?')
                    i += 2
                elif next_char == '(':
                    # BRE \( -> Python (
                    result.append('(')
                    i += 2
                elif next_char == ')':
                    # BRE \) -> Python )
                    result.append(')')
                    i += 2
                elif next_char == '{':
                    # BRE \{ -> Python {
                    result.append('{')
                    i += 2
                elif next_char == '}':
                    # BRE \} -> Python }
                    result.append('}')
                    i += 2
                elif next_char == '<':
                    # BRE \< (word start) -> Python \b
                    result.append(r'\b')
                    i += 2
                elif next_char == '>':
                    # BRE \> (word end) -> Python \b
                    result.append(r'\b')
                    i += 2
                else:
                    # Other escapes pass through as-is
                    result.append(pattern[i:i + 2])
                    i += 2
            elif pattern[i] == '|':
                # BRE literal | -> Python \|
                result.append(r'\|')
                i += 1
            elif pattern[i] == '+':
                # BRE literal + -> Python \+
                result.append(r'\+')
                i += 1
            elif pattern[i] == '?':
                # BRE literal ? -> Python \?
                result.append(r'\?')
                i += 1
            elif pattern[i] == '(':
                # BRE literal ( -> Python \(
                result.append(r'\(')
                i += 1
            elif pattern[i] == ')':
                # BRE literal ) -> Python \)
                result.append(r'\)')
                i += 1
            elif pattern[i] == '{':
                # BRE literal { -> Python \{
                result.append(r'\{')
                i += 1
            elif pattern[i] == '}':
                # BRE literal } -> Python \}
                result.append(r'\}')
                i += 1
            else:
                result.append(pattern[i])
                i += 1

        return ''.join(result)

    async def _get_files_recursive(self, ctx: CommandContext, path: str) -> list[str]:
        """Get all files in a directory recursively."""
        files = []
        try:
            entries = await ctx.fs.readdir(path)
            for entry in entries:
                full_path = f"{path}/{entry}"
                if await ctx.fs.is_directory(full_path):
                    files.extend(await self._get_files_recursive(ctx, full_path))
                else:
                    files.append(full_path)
        except Exception:
            pass
        return sorted(files)


class FgrepCommand(GrepCommand):
    """The fgrep command - grep with fixed strings."""

    name = "fgrep"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute fgrep (grep -F)."""
        return await super().execute(["-F"] + args, ctx)


class EgrepCommand(GrepCommand):
    """The egrep command - grep with extended regexp."""

    name = "egrep"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute egrep (grep -E)."""
        return await super().execute(["-E"] + args, ctx)
