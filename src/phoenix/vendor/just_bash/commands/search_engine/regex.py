"""Regex pattern building utilities for search commands."""

import re
from enum import Enum


class RegexMode(Enum):
    """Regex interpretation modes."""

    BASIC = "basic"       # BRE - escape +?|(){}
    EXTENDED = "extended"  # ERE - standard regex
    FIXED = "fixed"       # Literal string matching
    PERL = "perl"         # PCRE (Python default)


def build_regex(
    pattern: str,
    mode: RegexMode = RegexMode.EXTENDED,
    ignore_case: bool = False,
    whole_word: bool = False,
    line_regexp: bool = False,
    multiline: bool = False,
) -> re.Pattern:
    """Build a compiled regex from pattern with options.

    Args:
        pattern: The search pattern
        mode: How to interpret the pattern (basic, extended, fixed, perl)
        ignore_case: Case-insensitive matching
        whole_word: Match whole words only (add word boundaries)
        line_regexp: Match entire lines (anchor to line start/end)
        multiline: Enable multiline mode for ^ and $

    Returns:
        Compiled regex pattern
    """
    # Process pattern based on mode
    if mode == RegexMode.FIXED:
        # Escape all regex metacharacters for literal matching
        pattern = re.escape(pattern)
    elif mode == RegexMode.BASIC:
        # BRE mode: +?|(){} are literal unless escaped
        # Convert BRE to ERE by escaping these chars
        # In BRE, \+ means one-or-more, + means literal +
        # We need to swap the meaning
        pattern = _convert_bre_to_ere(pattern)
    # EXTENDED and PERL modes use pattern as-is (Python re is PCRE-like)

    # Apply word boundaries
    if whole_word:
        pattern = r"\b(?:" + pattern + r")\b"

    # Apply line anchors
    if line_regexp:
        pattern = "^(?:" + pattern + ")$"

    # Build flags
    flags = 0
    if ignore_case:
        flags |= re.IGNORECASE
    if multiline:
        flags |= re.MULTILINE

    return re.compile(pattern, flags)


def _convert_bre_to_ere(pattern: str) -> str:
    """Convert Basic Regular Expression to Extended Regular Expression.

    In BRE, characters like +, ?, |, (, ), {, } are literal unless escaped.
    In ERE (Python's default), they are special unless escaped.

    This function escapes these characters so they're treated as literals.
    """
    # Characters that are special in ERE but literal in BRE
    literal_chars = "+?|(){}[]"

    result = []
    i = 0
    while i < len(pattern):
        char = pattern[i]

        if char == "\\" and i + 1 < len(pattern):
            next_char = pattern[i + 1]
            # In BRE, \+ means one-or-more (special)
            # So we should NOT escape it (keep as +)
            if next_char in literal_chars:
                result.append(next_char)
                i += 2
                continue
            else:
                # Keep other escape sequences as-is
                result.append(char)
                result.append(next_char)
                i += 2
                continue
        elif char in literal_chars:
            # Literal in BRE, so escape for ERE
            result.append("\\" + char)
        else:
            result.append(char)
        i += 1

    return "".join(result)


def convert_replacement(replacement: str) -> str:
    """Convert sed/ripgrep-style replacement to Python re.sub format.

    Converts:
        $0 -> \\g<0>  (full match)
        $1, $2, ... -> \\1, \\2, ...  (numbered groups)
        $name -> \\g<name>  (named groups)

    Args:
        replacement: The replacement string with $ references

    Returns:
        Replacement string with Python-style backreferences
    """
    result = []
    i = 0
    while i < len(replacement):
        char = replacement[i]

        if char == "$" and i + 1 < len(replacement):
            next_char = replacement[i + 1]

            # $0 - full match (needs \g<0> syntax)
            if next_char == "0":
                result.append(r"\g<0>")
                i += 2
                continue

            # $1-9 - numbered groups
            if next_char.isdigit():
                # Collect all digits
                j = i + 1
                while j < len(replacement) and replacement[j].isdigit():
                    j += 1
                num = replacement[i + 1:j]
                result.append("\\" + num)
                i = j
                continue

            # $name - named groups
            if next_char.isalpha() or next_char == "_":
                j = i + 1
                while j < len(replacement) and (replacement[j].isalnum() or replacement[j] == "_"):
                    j += 1
                name = replacement[i + 1:j]
                result.append(r"\g<" + name + ">")
                i = j
                continue

        result.append(char)
        i += 1

    return "".join(result)
