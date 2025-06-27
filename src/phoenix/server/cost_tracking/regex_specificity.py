"""
Regex specificity scorer based on heuristics intended for tie-breaking.

This module provides functionality to score regex patterns based on their specificity.
More specific patterns (like exact matches with anchors) receive higher scores,
while more general patterns (like wildcards and quantifiers) receive lower scores.

Scoring Weights:
    - Full anchors (^pattern$): +10000 points
    - Partial anchors (^pattern or pattern$): +5000 points
    - Literal characters: +1000 points each
    - Escaped characters (\\. \\+ etc): +950 points each
    - Character classes [abc]: +500 points
    - Shorthand classes (\\d \\w \\s): +400 points
    - Negated classes [^abc]: +300 points
    - Negated shorthand (\\D \\W \\S): +250 points
    - Exact quantifiers {n}: -50 points
    - Range quantifiers {n,m}: -100 points
    - Wildcards (.): -200 points
    - Optional (?): -100 points
    - Multiple (+ *): -150 points
    - Alternation (|): -300 points

Examples:
    >>> score("^abc$")      # Exact match: 12002
    >>> score("abc")        # Literal: 3002
    >>> score(".*")         # Wildcard: -198
    >>> score("[a-z]+")     # Class + multiple: 350
    >>> score("\\d{3}")     # Shorthand + exact quantifier: 350
"""

import re
from typing import Union

from typing_extensions import assert_never

# Scoring weights for different regex pattern elements
FULL_ANCHOR = 10000  # ^pattern$ - highest specificity
PARTIAL_ANCHOR = 5000  # ^pattern or pattern$ - high specificity
LITERAL = 1000  # exact characters - good specificity
ESCAPED = 950  # \. \+ etc - slightly less than literal
CHAR_CLASS = 500  # [abc] [0-9] - moderate specificity
SHORTHAND = 400  # \d \w \s - moderate specificity
NEGATED_CLASS = 300  # [^abc] - lower specificity
NEGATED_SHORTHAND = 250  # \D \W \S - lower specificity
QUANTIFIER_EXACT = -50  # {n} - reduces specificity
QUANTIFIER_RANGE = -100  # {n,m} {n,} - reduces specificity more
WILDCARD = -200  # . - significantly reduces specificity
OPTIONAL = -100  # ? - reduces specificity
MULTIPLE = -150  # + * - reduces specificity
ALTERNATION = -300  # | - significantly reduces specificity

# Character sets for classification
POSITIVE_SHORTHANDS = "dws"  # \d \w \s - digit, word, space
NEGATIVE_SHORTHANDS = "DWS"  # \D \W \S - non-digit, non-word, non-space
META_CHARS = "()^$"  # Regex metacharacters that don't affect scoring


def score(regex: Union[str, re.Pattern[str]]) -> int:
    """
    Score a regex pattern for specificity.

    Calculates a specificity score for a regex pattern where higher scores
    indicate more specific patterns. The scoring considers:

    - Anchors (^ and $) - significantly increase specificity
    - Character types (literal, escaped, classes) - moderate impact
    - Quantifiers and wildcards - reduce specificity
    - Pattern length - slight bonus for longer patterns

    Args:
        regex: The regex pattern string to score. Must be a valid regex.

    Returns:
        An integer score where:
        - Positive scores indicate specific patterns
        - Higher scores indicate more specific patterns
        - Negative scores indicate very general patterns
        - Minimum score is 1 (for empty patterns)

    Raises:
        ValueError: If the pattern is not a valid regex or is None.

    Examples:
        >>> score("^abc$")
        12002
        >>> score("abc")
        3002
        >>> score(".*")
        -198
        >>> score("")
        1
        >>> score("[a-z]+")
        350
        >>> score("\\d{3}")
        350

    Note:
        The scoring algorithm is designed for cost tracking scenarios
        where more specific patterns should be prioritized over general ones.
    """
    if isinstance(regex, str):
        pattern = regex
        try:
            re.compile(pattern)  # Validate regex
        except re.error as e:
            raise ValueError(f"Invalid regex pattern: {pattern}") from e
    elif isinstance(regex.pattern, str):
        pattern = regex.pattern
    elif isinstance(regex.pattern, bytes):
        pattern = regex.pattern.decode("utf-8")
    else:
        assert_never(regex.pattern)

    score_value = 0

    # Score anchors - most significant factor
    has_start_anchor = _has_start_anchor(pattern)
    has_end_anchor = pattern.endswith("$")

    if has_start_anchor and has_end_anchor:
        score_value += FULL_ANCHOR
    elif has_start_anchor or has_end_anchor:
        score_value += PARTIAL_ANCHOR

    # Score pattern content
    content = _strip_anchors(pattern)
    score_value += _score_content(content)

    # Length bonus for tie-breaking (longer patterns slightly preferred)
    score_value += len(pattern) * 2

    return max(score_value, 1)


def _has_start_anchor(pattern: str) -> bool:
    """
    Check if pattern has a start anchor (after all leading inline flags).
    Handles multiple inline flags robustly.
    """
    i = 0
    # Skip all leading inline flags
    while pattern.startswith("(?", i):
        close = pattern.find(")", i)
        if close == -1:
            break
        i = close + 1
    # After all flags, check for ^
    return i < len(pattern) and pattern[i] == "^"


def _strip_anchors(pattern: str) -> str:
    """
    Remove all leading inline flags and anchors from pattern for content analysis.
    Handles multiple inline flags robustly.
    """
    i = 0
    # Remove all leading inline flags
    while pattern.startswith("(?", i):
        close = pattern.find(")", i)
        if close == -1:
            break
        i = close + 1
    # Remove start anchor
    if i < len(pattern) and pattern[i] == "^":
        i += 1
    content = pattern[i:]
    # Remove end anchor
    if content.endswith("$"):
        content = content[:-1]
    return content


def _score_content(content: str) -> int:
    r"""
    Score the content of a pattern by analyzing each character.

    Iterates through the pattern content and scores each element:
    - Escape sequences (\d, \., etc.)
    - Character classes ([abc], [^abc])
    - Quantifiers ({n}, {n,m})
    - Special characters (., ?, +, *, |)
    - Literal characters

    Args:
        content: Pattern content without anchors

    Returns:
        Cumulative score for all pattern elements
    """
    score_value = 0
    i = 0

    while i < len(content):
        char = content[i]

        if char == "\\" and i + 1 < len(content):
            # Handle escape sequences
            score_value += _score_escape(content[i + 1])
            i += 2
        elif char == "[":
            # Handle character classes
            bracket_score, new_pos = _score_bracket(content, i)
            score_value += bracket_score
            i = new_pos
        elif char == "{":
            # Handle quantifiers
            quantifier_score, new_pos = _score_quantifier(content, i)
            score_value += quantifier_score
            i = new_pos
        else:
            # Handle single characters
            score_value += _score_char(char)
            i += 1

    return score_value


def _score_escape(char: str) -> int:
    r"""
    Score an escape sequence.

    Args:
        char: The character following the backslash

    Returns:
        Score for the escape sequence:
        - \d, \w, \s: +400 (shorthand classes)
        - \D, \W, \S: +250 (negated shorthand)
        - \., \+, etc: +950 (escaped literals)
    """
    if char in POSITIVE_SHORTHANDS:
        return SHORTHAND
    elif char in NEGATIVE_SHORTHANDS:
        return NEGATED_SHORTHAND
    else:
        return ESCAPED


def _score_bracket(content: str, start: int) -> tuple[int, int]:
    """
    Score a character class and find its end position.

    Args:
        content: Pattern content
        start: Starting position of the opening bracket

    Returns:
        Tuple of (score, next_position):
        - score: +500 for [abc], +300 for [^abc]
        - next_position: Position after the closing bracket
    """
    end = _find_bracket_end(content, start)
    if end == -1:
        # Malformed bracket, treat as literal
        return LITERAL, start + 1

    class_content = content[start + 1 : end]
    score_value = NEGATED_CLASS if class_content.startswith("^") else CHAR_CLASS

    return score_value, end + 1


def _score_quantifier(content: str, start: int) -> tuple[int, int]:
    """
    Score a quantifier and find its end position.

    Args:
        content: Pattern content
        start: Starting position of the opening brace

    Returns:
        Tuple of (score, next_position):
        - score: -50 for {n}, -100 for {n,m} or {n,}
        - next_position: Position after the closing brace
    """
    end = content.find("}", start)
    if end == -1:
        # Malformed quantifier, treat as literal
        return LITERAL, start + 1

    quantifier = content[start : end + 1]

    # Validate quantifier syntax
    if not _is_valid_quantifier(quantifier):
        return LITERAL, start + 1

    has_comma = "," in quantifier

    score_value = QUANTIFIER_RANGE if has_comma else QUANTIFIER_EXACT

    return score_value, end + 1


def _is_valid_quantifier(quantifier: str) -> bool:
    """
    Check if a quantifier has valid syntax.

    Args:
        quantifier: Quantifier string like "{n}", "{n,m}", "{n,}"

    Returns:
        True if quantifier syntax is valid
    """
    if not quantifier.startswith("{") or not quantifier.endswith("}"):
        return False

    # Extract content between braces
    content = quantifier[1:-1]

    if "," in content:
        # Range quantifier: {n,m} or {n,}
        parts = content.split(",")
        if len(parts) != 2:
            return False

        min_part, max_part = parts

        # Check minimum part
        if not min_part.isdigit():
            return False

        # Check maximum part (can be empty for {n,})
        if max_part and not max_part.isdigit():
            return False

        # Validate range
        if max_part:
            min_val = int(min_part)
            max_val = int(max_part)
            if min_val > max_val:
                return False
    else:
        # Exact quantifier: {n}
        if not content.isdigit():
            return False

    return True


def _score_char(char: str) -> int:
    """
    Score a single character.

    Args:
        char: Single character to score

    Returns:
        Score for the character:
        - .: -200 (wildcard)
        - ?: -100 (optional)
        - |: -300 (alternation)
        - +, *: -150 (multiple)
        - (, ), ^, $: 0 (metacharacters)
        - Other: +1000 (literal)
    """
    char_scores = {
        ".": WILDCARD,
        "?": OPTIONAL,
        "|": ALTERNATION,
    }

    if char in char_scores:
        return char_scores[char]
    elif char in "+*":
        return MULTIPLE
    elif char in META_CHARS:
        return 0  # Metacharacters don't affect scoring
    else:
        return LITERAL


def _find_bracket_end(pattern: str, start: int) -> int:
    r"""
    Find the end of a character class, handling escaped brackets.

    Args:
        pattern: Pattern string
        start: Position of opening bracket

    Returns:
        Position of closing bracket, or -1 if not found

    Note:
        Handles escaped closing brackets like [a\]b] correctly.
    """
    for i in range(start + 1, len(pattern)):
        if pattern[i] == "]":
            # Count backslashes to check if this ] is escaped
            backslashes = 0
            j = i - 1
            while j >= 0 and pattern[j] == "\\":
                backslashes += 1
                j -= 1
            if backslashes % 2 == 0:  # Not escaped
                return i
    return -1
