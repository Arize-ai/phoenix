"""Rg (ripgrep) command implementation.

A feature-complete ripgrep emulation with:
- Recursive search by default
- Smart case sensitivity
- .gitignore support
- File type filtering
- Glob patterns
- Context lines
- Multiple output formats
"""

import fnmatch
import re
from typing import Optional
from ...types import CommandContext, ExecResult


# File type definitions (subset of ripgrep's types)
FILE_TYPES: dict[str, list[str]] = {
    "py": ["*.py", "*.pyi", "*.pyw"],
    "python": ["*.py", "*.pyi", "*.pyw"],
    "js": ["*.js", "*.mjs", "*.cjs", "*.jsx"],
    "javascript": ["*.js", "*.mjs", "*.cjs", "*.jsx"],
    "ts": ["*.ts", "*.tsx", "*.mts", "*.cts"],
    "typescript": ["*.ts", "*.tsx", "*.mts", "*.cts"],
    "json": ["*.json", "*.jsonl", "*.geojson"],
    "yaml": ["*.yaml", "*.yml"],
    "yml": ["*.yaml", "*.yml"],
    "xml": ["*.xml", "*.xsl", "*.xslt", "*.svg"],
    "html": ["*.html", "*.htm", "*.xhtml"],
    "css": ["*.css", "*.scss", "*.sass", "*.less"],
    "md": ["*.md", "*.markdown", "*.mdown"],
    "markdown": ["*.md", "*.markdown", "*.mdown"],
    "txt": ["*.txt", "*.text"],
    "c": ["*.c", "*.h"],
    "cpp": ["*.cpp", "*.cc", "*.cxx", "*.hpp", "*.hh", "*.hxx", "*.c++", "*.h++"],
    "java": ["*.java"],
    "go": ["*.go"],
    "rust": ["*.rs"],
    "rs": ["*.rs"],
    "rb": ["*.rb", "*.ruby", "*.gemspec", "Rakefile"],
    "ruby": ["*.rb", "*.ruby", "*.gemspec", "Rakefile"],
    "sh": ["*.sh", "*.bash", "*.zsh", "*.fish"],
    "shell": ["*.sh", "*.bash", "*.zsh", "*.fish"],
    "sql": ["*.sql"],
    "r": ["*.r", "*.R", "*.Rmd"],
    "php": ["*.php", "*.php3", "*.php4", "*.php5", "*.phtml"],
    "swift": ["*.swift"],
    "kotlin": ["*.kt", "*.kts"],
    "scala": ["*.scala", "*.sc"],
    "lua": ["*.lua"],
    "perl": ["*.pl", "*.pm", "*.t"],
    "toml": ["*.toml"],
    "ini": ["*.ini", "*.cfg", "*.conf"],
    "make": ["Makefile", "*.mk", "GNUmakefile"],
    "cmake": ["CMakeLists.txt", "*.cmake"],
    "docker": ["Dockerfile", "*.dockerfile"],
    "tf": ["*.tf", "*.tfvars"],
    "terraform": ["*.tf", "*.tfvars"],
}


def format_type_list() -> str:
    """Format the type list for --type-list output."""
    lines = []
    seen = set()
    for name, patterns in sorted(FILE_TYPES.items()):
        if name not in seen:
            lines.append(f"{name}: {', '.join(patterns)}")
            seen.add(name)
    return "\n".join(lines) + "\n"


class RgOptions:
    """Parsed options for rg command."""

    def __init__(self):
        # Patterns
        self.patterns: list[str] = []
        self.pattern_file: Optional[str] = None

        # Case sensitivity
        self.ignore_case = False
        self.case_sensitive = False
        self.smart_case = False

        # Pattern matching
        self.fixed_strings = False
        self.word_regexp = False
        self.line_regexp = False
        self.invert_match = False
        self.multiline = False
        self.multiline_dotall = False

        # Output modes
        self.count = False
        self.count_matches = False
        self.files_with_matches = False
        self.files_without_match = False
        self.files_only = False  # --files
        self.only_matching = False
        self.quiet = False
        self.stats = False

        # Line/column display
        self.line_numbers = True  # On by default
        self.explicit_line_numbers = False
        self.no_filename = False
        self.column = False
        self.byte_offset = False
        self.null_separator = False

        # Output formats
        self.json = False
        self.vimgrep = False
        self.heading = False

        # Context
        self.after_context = 0
        self.before_context = 0

        # Replacement
        self.replace: Optional[str] = None

        # Limits
        self.max_count: Optional[int] = None
        self.max_depth: Optional[int] = None

        # File selection
        self.hidden = False
        self.no_ignore = False
        self.unrestricted_level = 0
        self.globs: list[str] = []
        self.types: list[str] = []
        self.types_not: list[str] = []
        self.search_binary = False

        # Other
        self.sort_by: Optional[str] = None
        self.passthru = False


class RgCommand:
    """The rg (ripgrep) command - recursive grep."""

    name = "rg"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the rg command."""
        # Parse arguments
        opts, paths, error = self._parse_args(args, ctx)
        if error:
            return error

        # Handle special modes
        if opts.files_only:
            return await self._list_files(ctx, paths, opts)

        # Load patterns from file if specified
        if opts.pattern_file:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, opts.pattern_file)
                content = await ctx.fs.read_file(path)
                for line in content.splitlines():
                    if line.strip():
                        opts.patterns.append(line.strip())
            except Exception as e:
                return ExecResult(
                    stdout="",
                    stderr=f"rg: {opts.pattern_file}: {e}\n",
                    exit_code=2,
                )

        if not opts.patterns:
            return ExecResult(
                stdout="",
                stderr="rg: no pattern given\n",
                exit_code=2,
            )

        # Build regex
        try:
            regex = self._build_regex(opts)
        except re.error as e:
            return ExecResult(
                stdout="",
                stderr=f"rg: regex error: {e}\n",
                exit_code=2,
            )

        # Execute search
        return await self._search(ctx, paths, regex, opts)

    def _parse_args(self, args: list[str], ctx: CommandContext) -> tuple[RgOptions, list[str], Optional[ExecResult]]:
        """Parse command line arguments."""
        opts = RgOptions()
        paths: list[str] = []
        i = 0

        while i < len(args):
            arg = args[i]

            if arg == "--":
                # Everything after -- is paths
                paths.extend(args[i + 1:])
                break
            elif arg == "--help":
                return opts, paths, self._show_help()
            elif arg == "--type-list":
                return opts, paths, ExecResult(
                    stdout=format_type_list(),
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--version":
                return opts, paths, ExecResult(
                    stdout="rg (just-bash) 0.1.0\n",
                    stderr="",
                    exit_code=0,
                )

            # Long options with values
            elif arg.startswith("--") and "=" in arg:
                key, value = arg.split("=", 1)
                if key in ("--regexp", "-e"):
                    opts.patterns.append(value)
                elif key in ("--file", "-f"):
                    opts.pattern_file = value
                elif key in ("--replace", "-r"):
                    opts.replace = value
                elif key in ("--max-count", "-m"):
                    opts.max_count = int(value)
                elif key in ("--max-depth", "-d"):
                    opts.max_depth = int(value)
                elif key in ("--glob", "-g"):
                    opts.globs.append(value)
                elif key in ("--type", "-t"):
                    opts.types.append(value)
                elif key in ("--type-not", "-T"):
                    opts.types_not.append(value)
                elif key == "--context-separator":
                    pass  # Accept but ignore
                elif key == "--sort":
                    opts.sort_by = value
                elif key in ("-A", "--after-context"):
                    opts.after_context = int(value)
                elif key in ("-B", "--before-context"):
                    opts.before_context = int(value)
                elif key in ("-C", "--context"):
                    opts.before_context = opts.after_context = int(value)

            # Long options
            elif arg.startswith("--"):
                if arg == "--ignore-case":
                    opts.ignore_case = True
                elif arg == "--case-sensitive":
                    opts.case_sensitive = True
                elif arg == "--smart-case":
                    opts.smart_case = True
                elif arg == "--fixed-strings":
                    opts.fixed_strings = True
                elif arg == "--word-regexp":
                    opts.word_regexp = True
                elif arg == "--line-regexp":
                    opts.line_regexp = True
                elif arg == "--invert-match":
                    opts.invert_match = True
                elif arg == "--multiline":
                    opts.multiline = True
                elif arg == "--multiline-dotall":
                    opts.multiline_dotall = True
                elif arg == "--count":
                    opts.count = True
                elif arg == "--count-matches":
                    opts.count_matches = True
                elif arg == "--files-with-matches":
                    opts.files_with_matches = True
                elif arg == "--files-without-match":
                    opts.files_without_match = True
                elif arg == "--files":
                    opts.files_only = True
                elif arg == "--only-matching":
                    opts.only_matching = True
                elif arg == "--quiet":
                    opts.quiet = True
                elif arg == "--stats":
                    opts.stats = True
                elif arg == "--line-number":
                    opts.line_numbers = True
                    opts.explicit_line_numbers = True
                elif arg == "--no-line-number":
                    opts.line_numbers = False
                elif arg == "--with-filename":
                    opts.no_filename = False
                elif arg == "--no-filename":
                    opts.no_filename = True
                elif arg == "--column":
                    opts.column = True
                elif arg == "--no-column":
                    opts.column = False
                elif arg == "--byte-offset":
                    opts.byte_offset = True
                elif arg == "--null":
                    opts.null_separator = True
                elif arg == "--json":
                    opts.json = True
                elif arg == "--vimgrep":
                    opts.vimgrep = True
                    opts.line_numbers = True
                    opts.column = True
                elif arg == "--heading":
                    opts.heading = True
                elif arg == "--passthru":
                    opts.passthru = True
                elif arg == "--hidden":
                    opts.hidden = True
                elif arg == "--no-ignore":
                    opts.no_ignore = True
                elif arg == "--no-ignore-dot":
                    opts.no_ignore = True
                elif arg == "--no-ignore-vcs":
                    opts.no_ignore = True
                elif arg == "--text":
                    opts.search_binary = True
                elif arg == "--sort":
                    # Next arg is value
                    if i + 1 < len(args):
                        i += 1
                        opts.sort_by = args[i]
                elif arg in ("--regexp", "--file", "--replace", "--max-count",
                             "--max-depth", "--glob", "--type", "--type-not",
                             "--after-context", "--before-context", "--context"):
                    # These need values
                    if i + 1 < len(args):
                        i += 1
                        value = args[i]
                        if arg == "--regexp":
                            opts.patterns.append(value)
                        elif arg == "--file":
                            opts.pattern_file = value
                        elif arg == "--replace":
                            opts.replace = value
                        elif arg == "--max-count":
                            opts.max_count = int(value)
                        elif arg == "--max-depth":
                            opts.max_depth = int(value)
                        elif arg == "--glob":
                            opts.globs.append(value)
                        elif arg == "--type":
                            opts.types.append(value)
                        elif arg == "--type-not":
                            opts.types_not.append(value)
                        elif arg == "--after-context":
                            opts.after_context = int(value)
                        elif arg == "--before-context":
                            opts.before_context = int(value)
                        elif arg == "--context":
                            opts.before_context = opts.after_context = int(value)
                # Ignore other unknown long options

            # Short options
            elif arg.startswith("-") and arg != "-":
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "i":
                        opts.ignore_case = True
                    elif c == "s":
                        opts.case_sensitive = True
                    elif c == "S":
                        opts.smart_case = True
                    elif c == "F":
                        opts.fixed_strings = True
                    elif c == "w":
                        opts.word_regexp = True
                    elif c == "x":
                        opts.line_regexp = True
                    elif c == "v":
                        opts.invert_match = True
                    elif c == "U":
                        opts.multiline = True
                    elif c == "c":
                        opts.count = True
                    elif c == "l":
                        opts.files_with_matches = True
                    elif c == "o":
                        opts.only_matching = True
                    elif c == "q":
                        opts.quiet = True
                    elif c == "n":
                        opts.line_numbers = True
                        opts.explicit_line_numbers = True
                    elif c == "N":
                        opts.line_numbers = False
                    elif c == "H":
                        opts.no_filename = False
                    elif c == "I":
                        opts.no_filename = True
                    elif c == "b":
                        opts.byte_offset = True
                    elif c == "0":
                        opts.null_separator = True
                    elif c == "a":
                        opts.search_binary = True
                    elif c == "u":
                        opts.unrestricted_level += 1
                        if opts.unrestricted_level >= 1:
                            opts.no_ignore = True
                        if opts.unrestricted_level >= 2:
                            opts.hidden = True
                        if opts.unrestricted_level >= 3:
                            opts.search_binary = True
                    elif c in ("e", "f", "r", "m", "d", "g", "t", "T", "A", "B", "C"):
                        # These need values - either rest of arg or next arg
                        if j + 1 < len(arg):
                            value = arg[j + 1:]
                        elif i + 1 < len(args):
                            i += 1
                            value = args[i]
                        else:
                            value = ""
                        if c == "e":
                            opts.patterns.append(value)
                        elif c == "f":
                            opts.pattern_file = value
                        elif c == "r":
                            opts.replace = value
                        elif c == "m":
                            opts.max_count = int(value)
                        elif c == "d":
                            opts.max_depth = int(value)
                        elif c == "g":
                            opts.globs.append(value)
                        elif c == "t":
                            opts.types.append(value)
                        elif c == "T":
                            opts.types_not.append(value)
                        elif c == "A":
                            opts.after_context = int(value)
                        elif c == "B":
                            opts.before_context = int(value)
                        elif c == "C":
                            opts.before_context = opts.after_context = int(value)
                        break
                    j += 1

            # Positional arguments
            # In --files mode, all positional args are paths (no pattern needed)
            # With -f (pattern file), all positional args are also paths
            elif opts.files_only or opts.pattern_file:
                paths.append(arg)
            elif not opts.patterns:
                opts.patterns.append(arg)
            else:
                paths.append(arg)
            i += 1

        # Default to current directory
        if not paths:
            paths = ["."]

        return opts, paths, None

    def _build_regex(self, opts: RgOptions) -> re.Pattern:
        """Build the regex pattern from options."""
        # Combine patterns with OR
        if len(opts.patterns) == 1:
            pattern = opts.patterns[0]
        else:
            # Escape for combining if using fixed strings
            if opts.fixed_strings:
                parts = [re.escape(p) for p in opts.patterns]
            else:
                parts = [f"(?:{p})" for p in opts.patterns]
            pattern = "|".join(parts)

        # Handle fixed strings
        if opts.fixed_strings and len(opts.patterns) == 1:
            pattern = re.escape(pattern)

        # Handle word/line matching
        if opts.word_regexp:
            pattern = r"\b(?:" + pattern + r")\b"
        if opts.line_regexp:
            pattern = "^(?:" + pattern + ")$"

        # Determine case sensitivity
        flags = 0
        if opts.case_sensitive:
            pass  # Case sensitive
        elif opts.ignore_case:
            flags |= re.IGNORECASE
        elif opts.smart_case:
            # Smart case: case insensitive unless pattern has uppercase
            has_upper = any(c.isupper() for c in pattern if c.isalpha())
            if not has_upper:
                flags |= re.IGNORECASE

        # Multiline
        if opts.multiline:
            flags |= re.MULTILINE
            if opts.multiline_dotall:
                flags |= re.DOTALL

        return re.compile(pattern, flags)

    async def _search(self, ctx: CommandContext, paths: list[str], regex: re.Pattern, opts: RgOptions) -> ExecResult:
        """Execute the search."""
        results: list[str] = []
        stats = {"files": 0, "matches": 0, "lines": 0}
        found_any = False

        for path in paths:
            if path == "-":
                # Search stdin
                found = await self._search_content(
                    ctx, "(standard input)", ctx.stdin, regex, opts, results, stats
                )
                if found:
                    found_any = True
            else:
                try:
                    resolved = ctx.fs.resolve_path(ctx.cwd, path)
                    stat = await ctx.fs.stat(resolved)

                    if stat.is_directory:
                        found = await self._search_directory(
                            ctx, resolved, path, regex, opts, results, stats, depth=0
                        )
                        if found:
                            found_any = True
                    else:
                        found = await self._search_file(
                            ctx, resolved, path, regex, opts, results, stats
                        )
                        if found:
                            found_any = True
                except FileNotFoundError:
                    pass
                except Exception:
                    pass

        # Handle quiet mode
        if opts.quiet:
            return ExecResult(
                stdout="",
                stderr="",
                exit_code=0 if found_any else 1,
            )

        # Build output
        output = "\n".join(results)
        if output:
            output += "\n"

        # Add stats if requested
        if opts.stats:
            output += f"\n{stats['matches']} matches\n"
            output += f"{stats['lines']} matched lines\n"
            output += f"{stats['files']} files contained matches\n"

        return ExecResult(
            stdout=output,
            stderr="",
            exit_code=0 if found_any else 1,
        )

    async def _search_directory(
        self, ctx: CommandContext, path: str, display_path: str,
        regex: re.Pattern, opts: RgOptions, results: list[str],
        stats: dict, depth: int
    ) -> bool:
        """Search a directory recursively."""
        # Check max depth
        if opts.max_depth is not None and depth >= opts.max_depth:
            return False

        found_any = False

        try:
            entries = await ctx.fs.readdir(path)
            if opts.sort_by == "path":
                entries = sorted(entries)

            for entry in entries:
                # Skip hidden files/directories unless --hidden
                if entry.startswith(".") and not opts.hidden:
                    continue

                entry_path = f"{path}/{entry}"
                entry_display = f"{display_path}/{entry}" if display_path != "." else entry

                try:
                    stat = await ctx.fs.stat(entry_path)

                    if stat.is_directory:
                        # Skip .git directories unless --hidden
                        if entry == ".git" and not opts.hidden:
                            continue

                        found = await self._search_directory(
                            ctx, entry_path, entry_display, regex, opts, results, stats, depth + 1
                        )
                        if found:
                            found_any = True
                    else:
                        found = await self._search_file(
                            ctx, entry_path, entry_display, regex, opts, results, stats
                        )
                        if found:
                            found_any = True
                except Exception:
                    pass
        except Exception:
            pass

        return found_any

    async def _search_file(
        self, ctx: CommandContext, path: str, display_path: str,
        regex: re.Pattern, opts: RgOptions, results: list[str], stats: dict
    ) -> bool:
        """Search a single file."""
        # Check if file matches type filters
        if not self._matches_type_filters(display_path, opts):
            return False

        # Check if file matches glob filters
        if not self._matches_glob_filters(display_path, opts):
            return False

        # Check .gitignore
        if not opts.no_ignore:
            if await self._is_ignored(ctx, path, display_path):
                return False

        try:
            content = await ctx.fs.read_file(path)
        except Exception:
            return False

        # Check for binary content
        if not opts.search_binary and self._is_binary(content):
            return False

        return await self._search_content(ctx, display_path, content, regex, opts, results, stats)

    async def _search_content(
        self, ctx: CommandContext, display_path: str, content: str,
        regex: re.Pattern, opts: RgOptions, results: list[str], stats: dict
    ) -> bool:
        """Search content and add results."""
        lines = content.splitlines()
        matches: list[tuple[int, str, list[re.Match]]] = []
        match_count = 0
        line_match_count = 0

        # Multiline mode: search entire content
        if opts.multiline:
            content_matches = list(regex.finditer(content))
            if content_matches:
                match_count = len(content_matches)
                # For each match, determine which line(s) it spans
                line_offsets = [0]
                for line in lines:
                    line_offsets.append(line_offsets[-1] + len(line) + 1)

                for m in content_matches:
                    # Find the starting line
                    start_line = 1
                    for i, offset in enumerate(line_offsets):
                        if offset > m.start():
                            start_line = i
                            break
                    matched_text = m.group(0).replace('\n', '\\n')
                    matches.append((start_line, matched_text, [m]))
                    line_match_count += 1

                    if opts.max_count is not None and line_match_count >= opts.max_count:
                        break
        else:
            # Normal line-by-line search
            for line_num, line in enumerate(lines, 1):
                line_matches = list(regex.finditer(line))

                if opts.invert_match:
                    if not line_matches:
                        matches.append((line_num, line, []))
                        line_match_count += 1
                elif line_matches:
                    matches.append((line_num, line, line_matches))
                    match_count += len(line_matches)
                    line_match_count += 1

                    # Check max count
                    if opts.max_count is not None and line_match_count >= opts.max_count:
                        break

        if not matches and not opts.passthru:
            # For files-without-match, we want to list files with NO matches
            if opts.files_without_match:
                results.append(display_path)
                return True
            return False

        # Handle passthru mode - include all lines
        if opts.passthru:
            for line_num, line in enumerate(lines, 1):
                line_matches = list(regex.finditer(line))
                if any(m[0] == line_num for m in matches):
                    continue
                matches.append((line_num, line, line_matches))
            matches.sort(key=lambda x: x[0])

        # Update stats
        stats["files"] += 1
        stats["matches"] += match_count
        stats["lines"] += line_match_count

        # Handle files-with-matches mode
        if opts.files_with_matches:
            sep = "\0" if opts.null_separator else ""
            results.append(f"{display_path}{sep}")
            return True

        # Handle files-without-match mode (handled at caller level)
        if opts.files_without_match:
            return True  # File has matches, don't list it

        # Handle count mode
        if opts.count:
            results.append(f"{display_path}:{line_match_count}")
            return True

        # Handle count-matches mode
        if opts.count_matches:
            results.append(f"{display_path}:{match_count}")
            return True

        # Handle heading mode
        if opts.heading:
            results.append(display_path)

        # Collect lines to output (including context if needed)
        if opts.before_context > 0 or opts.after_context > 0:
            # Build set of lines to include
            lines_to_show: dict[int, tuple[str, bool]] = {}  # line_num -> (content, is_match)
            for line_num, line, line_matches in matches:
                # Add context before
                for ctx_num in range(max(1, line_num - opts.before_context), line_num):
                    if ctx_num not in lines_to_show:
                        lines_to_show[ctx_num] = (lines[ctx_num - 1], False)
                # Add the match line
                lines_to_show[line_num] = (line, True)
                # Add context after
                for ctx_num in range(line_num + 1, min(len(lines) + 1, line_num + opts.after_context + 1)):
                    if ctx_num not in lines_to_show:
                        lines_to_show[ctx_num] = (lines[ctx_num - 1], False)

            # Output in order
            for line_num in sorted(lines_to_show.keys()):
                content, is_match = lines_to_show[line_num]
                # Use '-' separator for context lines in some formats
                sep = ":" if is_match else "-"
                if not opts.no_filename:
                    if opts.line_numbers:
                        results.append(f"{display_path}{sep}{line_num}{sep}{content}")
                    else:
                        results.append(f"{display_path}{sep}{content}")
                else:
                    if opts.line_numbers:
                        results.append(f"{line_num}{sep}{content}")
                    else:
                        results.append(content)
        else:
            # Normal output without context
            for line_num, line, line_matches in matches:
                # Handle only-matching mode
                if opts.only_matching and line_matches:
                    for m in line_matches:
                        self._format_result(
                            results, opts, display_path, line_num, m.group(0),
                            column=m.start() + 1, byte_offset=self._calc_byte_offset(lines, line_num, m.start())
                        )
                else:
                    # Handle replacement
                    output_line = line
                    if opts.replace is not None and line_matches:
                        # Convert ripgrep-style $1 to Python-style \1
                        py_replace = re.sub(r'\$(\d+)', r'\\\1', opts.replace)
                        output_line = regex.sub(py_replace, line)

                    col = line_matches[0].start() + 1 if line_matches else 1
                    byte_off = self._calc_byte_offset(lines, line_num, col - 1)
                    self._format_result(results, opts, display_path, line_num, output_line, column=col, byte_offset=byte_off)

        return True

    def _format_result(
        self, results: list[str], opts: RgOptions, filename: str,
        line_num: int, content: str, column: int = 1, byte_offset: int = 0
    ) -> None:
        """Format a result line."""
        if opts.heading:
            # Heading mode: line number and content only
            parts = []
            if opts.line_numbers:
                parts.append(str(line_num))
            if opts.column:
                parts.append(str(column))
            if opts.byte_offset:
                parts.append(str(byte_offset))
            if parts:
                results.append(":".join(parts) + ":" + content)
            else:
                results.append(content)
        elif opts.vimgrep:
            # vimgrep format: file:line:column:content
            results.append(f"{filename}:{line_num}:{column}:{content}")
        elif opts.json:
            # Simple JSON-like output
            import json
            results.append(json.dumps({
                "type": "match",
                "data": {
                    "path": {"text": filename},
                    "lines": {"text": content},
                    "line_number": line_num,
                    "submatches": []
                }
            }))
        else:
            # Normal format
            parts = []
            if not opts.no_filename:
                parts.append(filename)
            if opts.line_numbers:
                parts.append(str(line_num))
            if opts.column:
                parts.append(str(column))
            if opts.byte_offset:
                parts.append(str(byte_offset))

            if parts:
                results.append(":".join(parts) + ":" + content)
            else:
                results.append(content)

    def _calc_byte_offset(self, lines: list[str], line_num: int, col: int) -> int:
        """Calculate byte offset from start of file."""
        offset = sum(len(l) + 1 for l in lines[:line_num - 1])
        return offset + col

    def _matches_type_filters(self, path: str, opts: RgOptions) -> bool:
        """Check if file matches type filters."""
        if not opts.types and not opts.types_not:
            return True

        filename = path.split("/")[-1]

        # Check type exclusions first
        for type_name in opts.types_not:
            patterns = FILE_TYPES.get(type_name, [])
            for pattern in patterns:
                if fnmatch.fnmatch(filename, pattern):
                    return False

        # If no include types, allow all (that weren't excluded)
        if not opts.types:
            return True

        # Check type inclusions
        for type_name in opts.types:
            patterns = FILE_TYPES.get(type_name, [])
            for pattern in patterns:
                if fnmatch.fnmatch(filename, pattern):
                    return True

        return False

    def _matches_glob_filters(self, path: str, opts: RgOptions) -> bool:
        """Check if file matches glob filters."""
        if not opts.globs:
            return True

        filename = path.split("/")[-1]

        for glob in opts.globs:
            # Negated glob
            if glob.startswith("!"):
                pattern = glob[1:]
                if fnmatch.fnmatch(filename, pattern) or fnmatch.fnmatch(path, pattern):
                    return False
            else:
                # Positive glob - at least one must match
                if fnmatch.fnmatch(filename, glob) or fnmatch.fnmatch(path, glob):
                    return True

        # If only negated globs, allow; if positive globs, require match
        has_positive = any(not g.startswith("!") for g in opts.globs)
        return not has_positive

    async def _is_ignored(self, ctx: CommandContext, path: str, display_path: str) -> bool:
        """Check if file is ignored by .gitignore."""
        # Walk up directories looking for .gitignore
        parts = path.split("/")
        filename = parts[-1]

        for i in range(len(parts) - 1, 0, -1):
            dir_path = "/".join(parts[:i])
            gitignore_path = f"{dir_path}/.gitignore"

            try:
                content = await ctx.fs.read_file(gitignore_path)
                for line in content.splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    # Simple pattern matching
                    if fnmatch.fnmatch(filename, line) or fnmatch.fnmatch(display_path, line):
                        return True
            except Exception:
                pass

        return False

    def _is_binary(self, content: str) -> bool:
        """Check if content appears to be binary."""
        # Check for null bytes or high ratio of non-printable chars
        if "\x00" in content:
            return True
        if len(content) > 0:
            non_printable = sum(1 for c in content[:1000] if ord(c) < 32 and c not in "\n\r\t")
            if non_printable / min(len(content), 1000) > 0.1:
                return True
        return False

    async def _list_files(self, ctx: CommandContext, paths: list[str], opts: RgOptions) -> ExecResult:
        """List files that would be searched (--files mode)."""
        files: list[str] = []

        for path in paths:
            try:
                resolved = ctx.fs.resolve_path(ctx.cwd, path)
                stat = await ctx.fs.stat(resolved)

                if stat.is_directory:
                    await self._collect_files(ctx, resolved, path, opts, files, depth=0)
                else:
                    if self._matches_type_filters(path, opts) and self._matches_glob_filters(path, opts):
                        files.append(path)
            except Exception:
                pass

        if opts.sort_by == "path":
            files.sort()

        output = "\n".join(files)
        if output:
            output += "\n"

        return ExecResult(stdout=output, stderr="", exit_code=0)

    async def _collect_files(
        self, ctx: CommandContext, path: str, display_path: str,
        opts: RgOptions, files: list[str], depth: int
    ) -> None:
        """Collect files for --files mode."""
        if opts.max_depth is not None and depth >= opts.max_depth:
            return

        try:
            entries = await ctx.fs.readdir(path)

            for entry in sorted(entries):
                if entry.startswith(".") and not opts.hidden:
                    continue

                entry_path = f"{path}/{entry}"
                entry_display = f"{display_path}/{entry}" if display_path != "." else entry

                try:
                    stat = await ctx.fs.stat(entry_path)

                    if stat.is_directory:
                        await self._collect_files(ctx, entry_path, entry_display, opts, files, depth + 1)
                    else:
                        if self._matches_type_filters(entry_display, opts) and self._matches_glob_filters(entry_display, opts):
                            files.append(entry_display)
                except Exception:
                    pass
        except Exception:
            pass

    def _show_help(self) -> ExecResult:
        """Show help message."""
        help_text = """rg - recursively search for a pattern

USAGE:
    rg [OPTIONS] PATTERN [PATH ...]

OPTIONS:
    -e, --regexp PATTERN     Pattern to search for (can be repeated)
    -f, --file FILE          Read patterns from file
    -i, --ignore-case        Case insensitive search
    -s, --case-sensitive     Case sensitive search
    -S, --smart-case         Smart case (default)
    -F, --fixed-strings      Treat pattern as literal string
    -w, --word-regexp        Match whole words only
    -x, --line-regexp        Match whole lines only
    -v, --invert-match       Select non-matching lines
    -c, --count              Print count of matches per file
    --count-matches          Print count of individual matches
    -l, --files-with-matches Print only filenames with matches
    --files-without-match    Print filenames without matches
    --files                  Print files that would be searched
    -o, --only-matching      Print only matched parts
    -r, --replace TEXT       Replace matches with TEXT
    -q, --quiet              Suppress output
    -n, --line-number        Show line numbers (default)
    -N, --no-line-number     Hide line numbers
    -I, --no-filename        Hide filenames
    --column                 Show column numbers
    -b, --byte-offset        Show byte offsets
    --vimgrep                Output in vimgrep format
    --json                   Output in JSON format
    --heading                Show filename above matches
    -A NUM                   Show NUM lines after match
    -B NUM                   Show NUM lines before match
    -C NUM                   Show NUM lines of context
    -m, --max-count NUM      Stop after NUM matches per file
    -d, --max-depth NUM      Maximum directory depth
    -g, --glob PATTERN       Include files matching glob
    -t, --type TYPE          Search only TYPE files
    -T, --type-not TYPE      Exclude TYPE files
    --type-list              List available file types
    --hidden                 Search hidden files
    --no-ignore              Don't respect .gitignore
    -u                       Unrestricted mode (stacks)
    -U, --multiline          Enable multiline matching
    --stats                  Show search statistics
    --sort TYPE              Sort results (path, none)
    --passthru               Print all lines
    -a, --text               Search binary files as text
    --help                   Show this help
"""
        return ExecResult(stdout=help_text, stderr="", exit_code=0)
