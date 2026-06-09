"""Content searching and matching utilities."""

import re
from dataclasses import dataclass


@dataclass
class SearchOptions:
    """Options for content searching."""

    invert_match: bool = False
    show_line_numbers: bool = False
    count_only: bool = False
    only_matching: bool = False
    filename: str | None = None
    before_context: int = 0
    after_context: int = 0
    max_count: int | None = None
    replace: str | None = None
    multiline: bool = False


@dataclass
class SearchResult:
    """Result of a content search."""

    output: str
    matched: bool
    match_count: int


def search_content(
    content: str,
    regex: re.Pattern,
    options: SearchOptions = None,
) -> SearchResult:
    """Search content and return formatted output.

    Args:
        content: The text content to search
        regex: Compiled regex pattern to search for
        options: Search options (defaults to SearchOptions())

    Returns:
        SearchResult with output, matched flag, and match count
    """
    if options is None:
        options = SearchOptions()

    lines = content.split("\n")
    # Handle trailing empty line from split
    if lines and lines[-1] == "":
        lines = lines[:-1]

    # Track matches
    matches: list[tuple[int, str, list[re.Match]]] = []
    match_count = 0

    # Find all matching lines
    for line_num, line in enumerate(lines, 1):
        line_matches = list(regex.finditer(line))
        is_match = bool(line_matches)

        if options.invert_match:
            is_match = not is_match

        if is_match:
            if options.invert_match:
                matches.append((line_num, line, []))
            else:
                matches.append((line_num, line, line_matches))
                match_count += len(line_matches)

            # Check max count
            if options.max_count is not None and len(matches) >= options.max_count:
                break

    if not matches:
        return SearchResult(output="", matched=False, match_count=0)

    # For count_only, just return the count info
    if options.count_only:
        return SearchResult(
            output=str(len(matches)),
            matched=True,
            match_count=match_count,
        )

    # Build output with context
    output_lines: list[str] = []

    if options.before_context > 0 or options.after_context > 0:
        # Collect all lines to output (including context)
        lines_to_show: dict[int, tuple[str, bool]] = {}  # line_num -> (content, is_match)

        for line_num, line, line_matches in matches:
            # Add context before
            for ctx_num in range(max(1, line_num - options.before_context), line_num):
                if ctx_num not in lines_to_show:
                    lines_to_show[ctx_num] = (lines[ctx_num - 1], False)
            # Add the match line
            lines_to_show[line_num] = (line, True)
            # Add context after
            end_ctx = min(len(lines) + 1, line_num + options.after_context + 1)
            for ctx_num in range(line_num + 1, end_ctx):
                if ctx_num not in lines_to_show:
                    lines_to_show[ctx_num] = (lines[ctx_num - 1], False)

        # Output in order
        for line_num in sorted(lines_to_show.keys()):
            line_content, is_match = lines_to_show[line_num]
            sep = ":" if is_match else "-"

            if options.only_matching and is_match:
                # For context lines with only_matching, we don't output them
                # But for simplicity, include all for now
                pass

            output_line = _format_line(
                line_num, line_content, options, sep=sep
            )
            output_lines.append(output_line)
    else:
        # Normal output without context
        for line_num, line, line_matches in matches:
            if options.only_matching and line_matches:
                # Output each match separately
                for m in line_matches:
                    output_line = _format_line(
                        line_num, m.group(0), options
                    )
                    output_lines.append(output_line)
            else:
                # Handle replacement
                output_text = line
                if options.replace is not None and line_matches:
                    output_text = regex.sub(options.replace, line)

                output_line = _format_line(line_num, output_text, options)
                output_lines.append(output_line)

    output = "\n".join(output_lines)
    if output:
        output += "\n"

    return SearchResult(
        output=output,
        matched=True,
        match_count=match_count,
    )


def _format_line(
    line_num: int,
    content: str,
    options: SearchOptions,
    sep: str = ":",
) -> str:
    """Format a single output line with optional prefix."""
    parts = []

    if options.filename:
        parts.append(f"{options.filename}{sep}")

    if options.show_line_numbers:
        parts.append(f"{line_num}{sep}")

    parts.append(content)

    return "".join(parts)
