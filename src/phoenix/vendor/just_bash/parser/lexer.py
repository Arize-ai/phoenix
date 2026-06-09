"""
Lexer for Bash Scripts

The lexer tokenizes input into a stream of tokens that the parser consumes.
It handles:
- Operators and delimiters
- Words (with quoting rules)
- Comments
- Here-documents
- Escape sequences
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional


class TokenType(Enum):
    """Token types for bash lexer."""

    # End of input
    EOF = auto()

    # Newlines and separators
    NEWLINE = auto()
    SEMICOLON = auto()
    AMP = auto()  # &

    # Operators
    PIPE = auto()  # |
    PIPE_AMP = auto()  # |&
    AND_AND = auto()  # &&
    OR_OR = auto()  # ||
    BANG = auto()  # !

    # Redirections
    LESS = auto()  # <
    GREAT = auto()  # >
    DLESS = auto()  # <<
    DGREAT = auto()  # >>
    LESSAND = auto()  # <&
    GREATAND = auto()  # >&
    LESSGREAT = auto()  # <>
    DLESSDASH = auto()  # <<-
    CLOBBER = auto()  # >|
    TLESS = auto()  # <<<
    AND_GREAT = auto()  # &>
    AND_DGREAT = auto()  # &>>

    # Grouping
    LPAREN = auto()  # (
    RPAREN = auto()  # )
    LBRACE = auto()  # {
    RBRACE = auto()  # }

    # Special
    DSEMI = auto()  # ;;
    SEMI_AND = auto()  # ;&
    SEMI_SEMI_AND = auto()  # ;;&

    # Compound commands
    DBRACK_START = auto()  # [[
    DBRACK_END = auto()  # ]]
    DPAREN_START = auto()  # ((
    DPAREN_END = auto()  # ))

    # Reserved words
    IF = auto()
    THEN = auto()
    ELSE = auto()
    ELIF = auto()
    FI = auto()
    FOR = auto()
    WHILE = auto()
    UNTIL = auto()
    DO = auto()
    DONE = auto()
    CASE = auto()
    ESAC = auto()
    IN = auto()
    FUNCTION = auto()
    SELECT = auto()
    TIME = auto()
    COPROC = auto()

    # Words and identifiers
    WORD = auto()
    NAME = auto()  # Valid variable name
    NUMBER = auto()  # For redirections like 2>&1
    ASSIGNMENT_WORD = auto()  # VAR=value

    # Comments
    COMMENT = auto()

    # Here-document content
    HEREDOC_CONTENT = auto()


# Reserved words mapping
RESERVED_WORDS: dict[str, TokenType] = {
    "if": TokenType.IF,
    "then": TokenType.THEN,
    "else": TokenType.ELSE,
    "elif": TokenType.ELIF,
    "fi": TokenType.FI,
    "for": TokenType.FOR,
    "while": TokenType.WHILE,
    "until": TokenType.UNTIL,
    "do": TokenType.DO,
    "done": TokenType.DONE,
    "case": TokenType.CASE,
    "esac": TokenType.ESAC,
    "in": TokenType.IN,
    "function": TokenType.FUNCTION,
    "select": TokenType.SELECT,
    # "time" is handled as a regular command, not a reserved keyword
    "coproc": TokenType.COPROC,
}


@dataclass
class Token:
    """A lexical token."""

    type: TokenType
    value: str
    start: int
    end: int
    line: int
    column: int
    quoted: bool = False
    single_quoted: bool = False
    segments: list | None = None  # list of (text, mode) tuples for mixed quoting


@dataclass
class HeredocInfo:
    """Information about a pending here-document."""

    delimiter: str
    strip_tabs: bool = False
    quoted: bool = False


# Regular expressions for validation
NAME_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
NUMBER_PATTERN = re.compile(r"^[0-9]+$")
ASSIGNMENT_LHS_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*")


def is_valid_name(s: str) -> bool:
    """Check if string is a valid variable name."""
    return bool(NAME_PATTERN.match(s))


def is_valid_assignment_lhs(s: str) -> bool:
    """
    Check if a string is a valid assignment LHS with optional nested array subscript.
    Handles: VAR, a[0], a[x], a[a[0]], a[x+1], etc.
    """
    match = ASSIGNMENT_LHS_PATTERN.match(s)
    if not match:
        return False

    after_name = s[match.end() :]

    # If nothing after name, it's valid (simple variable)
    if after_name == "" or after_name == "+":
        return True

    # If it's an array subscript, check for balanced brackets
    if after_name and after_name[0] == "[":
        depth = 0
        i = 0
        for i, c in enumerate(after_name):
            if c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    break
        # Must have found closing bracket
        if depth != 0 or i >= len(after_name):
            return False
        # After closing bracket, only + is allowed (for +=)
        after_bracket = after_name[i + 1 :]
        return after_bracket == "" or after_bracket == "+"

    return False


# Three-character operators
THREE_CHAR_OPS: list[tuple[str, TokenType]] = [
    (";;&", TokenType.SEMI_SEMI_AND),
    ("<<<", TokenType.TLESS),
    ("&>>", TokenType.AND_DGREAT),
]

# Two-character operators
TWO_CHAR_OPS: list[tuple[str, TokenType]] = [
    ("[[", TokenType.DBRACK_START),
    ("]]", TokenType.DBRACK_END),
    # (( and )) are handled as special cases in _next_token for arithmetic depth tracking
    ("&&", TokenType.AND_AND),
    ("||", TokenType.OR_OR),
    (";;", TokenType.DSEMI),
    (";&", TokenType.SEMI_AND),
    ("|&", TokenType.PIPE_AMP),
    (">>", TokenType.DGREAT),
    ("<&", TokenType.LESSAND),
    (">&", TokenType.GREATAND),
    ("<>", TokenType.LESSGREAT),
    (">|", TokenType.CLOBBER),
    ("&>", TokenType.AND_GREAT),
]

# Single-character operators
SINGLE_CHAR_OPS: dict[str, TokenType] = {
    "|": TokenType.PIPE,
    "&": TokenType.AMP,
    ";": TokenType.SEMICOLON,
    "(": TokenType.LPAREN,
    ")": TokenType.RPAREN,
    "<": TokenType.LESS,
    ">": TokenType.GREAT,
}

# Word boundary characters
WORD_BREAK_CHARS = frozenset(" \t\n;|&()<>")
SPECIAL_CHARS = frozenset("'\"\\$`{}~*?[")


class Lexer:
    """Lexer for bash scripts."""

    def __init__(self, input_text: str) -> None:
        self.input = input_text
        self.pos = 0
        self.line = 1
        self.column = 1
        self.tokens: list[Token] = []
        self.pending_heredocs: list[HeredocInfo] = []
        self._arith_depth = 0  # Track (( )) nesting to avoid << being treated as heredoc

    def tokenize(self) -> list[Token]:
        """Tokenize the entire input."""
        input_text = self.input
        input_len = len(input_text)

        while self.pos < input_len:
            # Check for pending here-documents after newline BEFORE skipping whitespace
            # (heredoc content must preserve leading whitespace)
            if self.pending_heredocs and self.tokens and self.tokens[-1].type == TokenType.NEWLINE:
                self._read_heredoc_content()
                continue

            self._skip_whitespace()

            if self.pos >= input_len:
                break

            token = self._next_token()
            if token:
                self.tokens.append(token)

        # Add EOF token
        self.tokens.append(
            Token(
                type=TokenType.EOF,
                value="",
                start=self.pos,
                end=self.pos,
                line=self.line,
                column=self.column,
            )
        )

        return self.tokens

    def _skip_whitespace(self) -> None:
        """Skip whitespace and line continuations."""
        input_text = self.input
        input_len = len(input_text)

        while self.pos < input_len:
            char = input_text[self.pos]
            if char == " " or char == "\t":
                self.pos += 1
                self.column += 1
            elif char == "\\" and self.pos + 1 < input_len and input_text[self.pos + 1] == "\n":
                # Line continuation
                self.pos += 2
                self.line += 1
                self.column = 1
            else:
                break

    def _next_token(self) -> Optional[Token]:
        """Get the next token."""
        input_text = self.input
        pos = self.pos
        start_line = self.line
        start_column = self.column

        if pos >= len(input_text):
            return None

        c0 = input_text[pos]
        c1 = input_text[pos + 1] if pos + 1 < len(input_text) else ""
        c2 = input_text[pos + 2] if pos + 2 < len(input_text) else ""

        # Comments
        if c0 == "#":
            return self._read_comment(pos, start_line, start_column)

        # Newline
        if c0 == "\n":
            self.pos = pos + 1
            self.line += 1
            self.column = 1
            return Token(
                type=TokenType.NEWLINE,
                value="\n",
                start=pos,
                end=pos + 1,
                line=start_line,
                column=start_column,
            )

        # Three-character operators
        # Special case: <<- (heredoc with tab stripping) - but not inside (( ))
        if c0 == "<" and c1 == "<" and c2 == "-":
            self.pos = pos + 3
            self.column = start_column + 3
            if self._arith_depth == 0:
                self._register_heredoc_from_lookahead(strip_tabs=True)
            return self._make_token(TokenType.DLESSDASH, "<<-", pos, start_line, start_column)

        # Check other three-char operators
        three_chars = c0 + c1 + c2
        for op, token_type in THREE_CHAR_OPS:
            if three_chars == op:
                self.pos = pos + 3
                self.column = start_column + 3
                return self._make_token(token_type, op, pos, start_line, start_column)

        # Two-character operators
        # Special case: (( and )) - track arithmetic depth so << inside (( )) isn't treated as heredoc
        if c0 == "(" and c1 == "(":
            self.pos = pos + 2
            self.column = start_column + 2
            self._arith_depth += 1
            return self._make_token(TokenType.DPAREN_START, "((", pos, start_line, start_column)

        if c0 == ")" and c1 == ")":
            self.pos = pos + 2
            self.column = start_column + 2
            if self._arith_depth > 0:
                self._arith_depth -= 1
            return self._make_token(TokenType.DPAREN_END, "))", pos, start_line, start_column)

        # Special case: << (heredoc) - but not inside (( )) where it's left-shift
        if c0 == "<" and c1 == "<":
            self.pos = pos + 2
            self.column = start_column + 2
            if self._arith_depth == 0:
                self._register_heredoc_from_lookahead(strip_tabs=False)
            return self._make_token(TokenType.DLESS, "<<", pos, start_line, start_column)

        # Check other two-char operators
        two_chars = c0 + c1
        for op, token_type in TWO_CHAR_OPS:
            if two_chars == op:
                self.pos = pos + 2
                self.column = start_column + 2
                return self._make_token(token_type, op, pos, start_line, start_column)

        # Single-character operators
        if c0 in SINGLE_CHAR_OPS:
            self.pos = pos + 1
            self.column = start_column + 1
            return self._make_token(SINGLE_CHAR_OPS[c0], c0, pos, start_line, start_column)

        # Special handling for { and }
        if c0 == "{":
            # Check for {} as a word (used in find -exec)
            if c1 == "}":
                self.pos = pos + 2
                self.column = start_column + 2
                return Token(
                    type=TokenType.WORD,
                    value="{}",
                    start=pos,
                    end=pos + 2,
                    line=start_line,
                    column=start_column,
                    quoted=False,
                    single_quoted=False,
                )
            # In bash, { must be followed by whitespace to be a group start
            if c1 and c1 not in " \t\n":
                return self._read_word(pos, start_line, start_column)
            self.pos = pos + 1
            self.column = start_column + 1
            return self._make_token(TokenType.LBRACE, "{", pos, start_line, start_column)

        if c0 == "}":
            # } is only a reserved word (RBRACE) when it stands alone as a delimiter.
            # When followed by word characters (like }_{a,b}), it's part of a word.
            if c1 and c1 not in " \t\n;|&()<>":
                return self._read_word(pos, start_line, start_column)
            self.pos = pos + 1
            self.column = start_column + 1
            return self._make_token(TokenType.RBRACE, "}", pos, start_line, start_column)

        if c0 == "!":
            # Check for != operator (used in [[ ]] tests)
            if c1 == "=":
                self.pos = pos + 2
                self.column = start_column + 2
                return self._make_token(TokenType.WORD, "!=", pos, start_line, start_column)
            self.pos = pos + 1
            self.column = start_column + 1
            return self._make_token(TokenType.BANG, "!", pos, start_line, start_column)

        # Words
        return self._read_word(pos, start_line, start_column)

    def _make_token(
        self, type_: TokenType, value: str, start: int, line: int, column: int
    ) -> Token:
        """Create a token."""
        return Token(
            type=type_,
            value=value,
            start=start,
            end=self.pos,
            line=line,
            column=column,
        )

    def _read_comment(self, start: int, line: int, column: int) -> Token:
        """Read a comment token."""
        input_text = self.input
        input_len = len(input_text)
        pos = self.pos

        # Find end of comment (newline or EOF)
        while pos < input_len and input_text[pos] != "\n":
            pos += 1

        value = input_text[start:pos]
        self.pos = pos
        self.column = column + (pos - start)

        return Token(
            type=TokenType.COMMENT,
            value=value,
            start=start,
            end=pos,
            line=line,
            column=column,
        )

    def _read_word(self, start: int, line: int, column: int) -> Token:
        """Read a word token (with possible quotes, escapes, expansions)."""
        input_text = self.input
        input_len = len(input_text)
        pos = self.pos

        # Fast path: scan for simple word (no quotes, escapes, or expansions)
        # Track bracket depth to handle array subscripts with spaces: a[0 + 1]=value
        # Only track brackets AFTER we've read an identifier (not at start, to preserve [ test)
        # AND only if the result would be a valid assignment (lookahead check)
        fast_start = pos

        # Check if this could be an array assignment: identifier[...]=
        # Look ahead to see if pattern matches identifier[balanced_brackets]=
        use_bracket_tracking = False
        if pos < input_len:
            # Check for identifier start
            c0 = input_text[pos]
            if c0.isalpha() or c0 == "_":
                # Look ahead for [...]= pattern
                lookahead_pos = pos
                # Skip identifier
                while lookahead_pos < input_len:
                    ch = input_text[lookahead_pos]
                    if ch.isalnum() or ch == "_":
                        lookahead_pos += 1
                    else:
                        break
                # Check for [
                if lookahead_pos < input_len and input_text[lookahead_pos] == "[":
                    # Find balanced ]
                    depth = 1
                    lookahead_pos += 1
                    while lookahead_pos < input_len and depth > 0:
                        ch = input_text[lookahead_pos]
                        if ch == "[":
                            depth += 1
                        elif ch == "]":
                            depth -= 1
                        lookahead_pos += 1
                    # Check for = or += after ]
                    if depth == 0 and lookahead_pos < input_len:
                        ch = input_text[lookahead_pos]
                        if ch == "=" or (ch == "+" and lookahead_pos + 1 < input_len and input_text[lookahead_pos + 1] == "="):
                            use_bracket_tracking = True

        bracket_depth = 0
        in_assignment_value = False  # True after we've seen = following ]
        while pos < input_len:
            c = input_text[pos]
            if use_bracket_tracking and c == "[" and pos > fast_start:
                # Only enter bracket tracking if we've read something before
                bracket_depth += 1
            elif c == "]" and bracket_depth > 0:
                bracket_depth -= 1
            elif use_bracket_tracking and bracket_depth == 0 and c == "=" and not in_assignment_value:
                # We've hit the = in an array assignment, continue to read value
                in_assignment_value = True
            elif bracket_depth == 0 and not in_assignment_value and (c in WORD_BREAK_CHARS or c in SPECIAL_CHARS):
                break
            elif in_assignment_value and c in WORD_BREAK_CHARS:
                # Value ends at word break characters (but not special chars like ~)
                break
            pos += 1

        # If we consumed characters and hit a simple delimiter
        _use_fast_path = False
        if pos > fast_start:
            c = input_text[pos] if pos < input_len else ""
            if c == "" or c in WORD_BREAK_CHARS:
                # Don't use fast path if we're at an extglob pattern: @( ?( *( +( !(
                if c == "(" and pos > fast_start and input_text[pos - 1] in "@?*+!":
                    _use_fast_path = False  # Fall through to slow path
                # Don't use fast path if value contains quotes (need slow path for proper quote handling)
                elif "'" in input_text[fast_start:pos] or '"' in input_text[fast_start:pos]:
                    _use_fast_path = False  # Fall through to slow path for quotes
                else:
                    _use_fast_path = True

        if _use_fast_path:
                value = input_text[fast_start:pos]
                self.pos = pos
                self.column = column + (pos - fast_start)

                # Check for reserved words
                if value in RESERVED_WORDS:
                    return Token(
                        type=RESERVED_WORDS[value],
                        value=value,
                        start=start,
                        end=pos,
                        line=line,
                        column=column,
                    )

                # Check for assignment
                eq_idx = value.find("=")
                if eq_idx > 0 and is_valid_assignment_lhs(value[:eq_idx]):
                    return Token(
                        type=TokenType.ASSIGNMENT_WORD,
                        value=value,
                        start=start,
                        end=pos,
                        line=line,
                        column=column,
                    )

                # Check for number
                if NUMBER_PATTERN.match(value):
                    return Token(
                        type=TokenType.NUMBER,
                        value=value,
                        start=start,
                        end=pos,
                        line=line,
                        column=column,
                    )

                # Check for valid name
                if NAME_PATTERN.match(value):
                    return Token(
                        type=TokenType.NAME,
                        value=value,
                        start=start,
                        end=pos,
                        line=line,
                        column=column,
                        quoted=False,
                        single_quoted=False,
                    )

                return Token(
                    type=TokenType.WORD,
                    value=value,
                    start=start,
                    end=pos,
                    line=line,
                    column=column,
                    quoted=False,
                    single_quoted=False,
                )

        # Slow path: handle complex words with quotes, escapes, expansions
        pos = self.pos  # Reset position
        col = self.column
        ln = self.line

        value = ""
        quoted = False
        single_quoted = False
        in_single_quote = False
        in_double_quote = False
        starts_with_quote = input_text[pos] in "\"'" if pos < input_len else False

        # Bracket tracking for slow path is disabled - let parser handle complex cases
        # The fast path handles simple array assignments like a[0 + 1]=xyz
        slow_bracket_depth = 0

        # Segment boundary tracking for mixed quoting (e.g., "pre"{a,b}"suf")
        # Records (value_offset, mode) at each quoting transition
        seg_boundaries: list[tuple[int, str]] = []
        seg_mode = "unquoted"

        while pos < input_len:
            char = input_text[pos]

            # Track bracket depth (only outside quotes) - disabled in slow path
            # if not in_single_quote and not in_double_quote:
            #     if char == "[" and value:
            #         slow_bracket_depth += 1
            #     elif char == "]" and slow_bracket_depth > 0:
            #         slow_bracket_depth -= 1

            # Check for word boundaries
            if not in_single_quote and not in_double_quote:
                if char in WORD_BREAK_CHARS and slow_bracket_depth == 0:
                    # Handle extglob patterns: @( ?( *( +( !(
                    if char == "(" and value and value[-1] in "@?*+!":
                        # Read balanced paren group as part of word
                        value += char
                        pos += 1
                        col += 1
                        depth = 1
                        while pos < input_len and depth > 0:
                            ec = input_text[pos]
                            if ec == "(":
                                depth += 1
                            elif ec == ")":
                                depth -= 1
                            value += ec
                            pos += 1
                            col += 1
                        continue
                    break

            # Handle $'' ANSI-C quoting
            if (
                char == "$"
                and pos + 1 < input_len
                and input_text[pos + 1] == "'"
                and not in_single_quote
                and not in_double_quote
            ):
                value += "$'"
                pos += 2
                col += 2
                # Read until closing quote, handling escape sequences
                while pos < input_len and input_text[pos] != "'":
                    if input_text[pos] == "\\" and pos + 1 < input_len:
                        value += input_text[pos : pos + 2]
                        pos += 2
                        col += 2
                    else:
                        value += input_text[pos]
                        pos += 1
                        col += 1
                if pos < input_len:
                    value += "'"
                    pos += 1
                    col += 1
                continue

            # Handle $"..." locale quoting
            if (
                char == "$"
                and pos + 1 < input_len
                and input_text[pos + 1] == '"'
                and not in_single_quote
                and not in_double_quote
            ):
                pos += 1
                col += 1
                in_double_quote = True
                quoted = True
                if value == "":
                    starts_with_quote = True
                pos += 1
                col += 1
                continue

            # Handle quotes
            if char == "'" and not in_double_quote:
                if in_single_quote:
                    in_single_quote = False
                    if starts_with_quote:
                        # Record transition: single → unquoted
                        seg_boundaries.append((len(value), seg_mode))
                        seg_mode = "unquoted"
                    else:
                        value += char
                else:
                    in_single_quote = True
                    if starts_with_quote:
                        single_quoted = True
                        quoted = True
                        # Record transition: current → single
                        seg_boundaries.append((len(value), seg_mode))
                        seg_mode = "single"
                    else:
                        value += char
                pos += 1
                col += 1
                continue

            if char == '"' and not in_single_quote:
                if in_double_quote:
                    in_double_quote = False
                    if starts_with_quote:
                        # Record transition: double → unquoted
                        seg_boundaries.append((len(value), seg_mode))
                        seg_mode = "unquoted"
                    else:
                        value += char
                else:
                    in_double_quote = True
                    if starts_with_quote:
                        quoted = True
                        # Record transition: current → double
                        seg_boundaries.append((len(value), seg_mode))
                        seg_mode = "double"
                    else:
                        value += char
                pos += 1
                col += 1
                continue

            # Handle escapes
            if char == "\\" and not in_single_quote and pos + 1 < input_len:
                next_char = input_text[pos + 1]
                if next_char == "\n":
                    # Line continuation
                    pos += 2
                    ln += 1
                    col = 1
                    continue
                if in_double_quote:
                    # In double quotes, only certain escapes are special
                    if next_char in '"\\$`\n':
                        if next_char in "$`":
                            value += char + next_char
                        else:
                            value += next_char
                        pos += 2
                        col += 2
                        continue
                else:
                    # Outside quotes, backslash escapes next character
                    if next_char in "\"'{}*?[]=":
                        # Preserve backslash for quotes, braces, glob chars, and = so parser
                        # can create EscapedPart (prevents brace/glob expansion and assignment)
                        value += char + next_char
                    else:
                        value += next_char
                    pos += 2
                    col += 2
                    continue

            # Handle $(...) command substitution
            if char == "$" and pos + 1 < input_len and input_text[pos + 1] == "(":
                value += char
                pos += 1
                col += 1
                value += input_text[pos]  # Add the (
                pos += 1
                col += 1

                # Track parenthesis depth
                depth = 1
                cmd_in_single_quote = False
                cmd_in_double_quote = False

                while depth > 0 and pos < input_len:
                    c = input_text[pos]
                    value += c

                    if cmd_in_single_quote:
                        if c == "'":
                            cmd_in_single_quote = False
                    elif cmd_in_double_quote:
                        if c == "\\" and pos + 1 < input_len:
                            value += input_text[pos + 1]
                            pos += 1
                            col += 1
                        elif c == '"':
                            cmd_in_double_quote = False
                    else:
                        if c == "'":
                            cmd_in_single_quote = True
                        elif c == '"':
                            cmd_in_double_quote = True
                        elif c == "\\" and pos + 1 < input_len:
                            value += input_text[pos + 1]
                            pos += 1
                            col += 1
                        elif c == "(":
                            depth += 1
                        elif c == ")":
                            depth -= 1

                    pos += 1
                    col += 1
                continue

            # Handle $[...] legacy arithmetic expansion
            if char == "$" and pos + 1 < input_len and input_text[pos + 1] == "[":
                value += char
                pos += 1
                col += 1
                value += input_text[pos]  # Add the [
                pos += 1
                col += 1

                # Track bracket depth
                depth = 1
                while depth > 0 and pos < input_len:
                    c = input_text[pos]
                    value += c

                    if c == "[":
                        depth += 1
                    elif c == "]":
                        depth -= 1

                    pos += 1
                    col += 1
                continue

            # Handle ${...} parameter expansion
            if char == "$" and pos + 1 < input_len and input_text[pos + 1] == "{":
                value += char
                pos += 1
                col += 1
                value += input_text[pos]  # Add the {
                pos += 1
                col += 1

                # Track brace depth
                depth = 1
                while depth > 0 and pos < input_len:
                    c = input_text[pos]
                    value += c

                    if c == "{":
                        depth += 1
                    elif c == "}":
                        depth -= 1

                    pos += 1
                    col += 1
                continue

            # Handle simple $VAR expansion
            if char == "$":
                value += char
                pos += 1
                col += 1
                # Read variable name
                while pos < input_len and (input_text[pos].isalnum() or input_text[pos] == "_"):
                    value += input_text[pos]
                    pos += 1
                    col += 1
                continue

            # Handle backtick command substitution
            if char == "`":
                value += char
                pos += 1
                col += 1
                # Read until closing backtick
                while pos < input_len and input_text[pos] != "`":
                    if input_text[pos] == "\\" and pos + 1 < input_len:
                        value += input_text[pos : pos + 2]
                        pos += 2
                        col += 2
                    else:
                        value += input_text[pos]
                        pos += 1
                        col += 1
                if pos < input_len:
                    value += "`"
                    pos += 1
                    col += 1
                continue

            # Handle brace expansion and glob patterns
            if char in "{}*?[~":
                value += char
                pos += 1
                col += 1
                continue

            # Regular character
            value += char
            pos += 1
            col += 1

        self.pos = pos
        self.column = col
        self.line = ln

        # Determine token type
        # Note: An empty value is valid if it was quoted (e.g., "" or '')
        if not value and not quoted:
            return None

        # Check for reserved words (only if unquoted)
        if not quoted and value in RESERVED_WORDS:
            return Token(
                type=RESERVED_WORDS[value],
                value=value,
                start=start,
                end=pos,
                line=line,
                column=column,
            )

        # Check for assignment (only if unquoted)
        if not quoted:
            # Find first unescaped = (not preceded by \)
            eq_idx = -1
            for i, c in enumerate(value):
                if c == "=" and (i == 0 or value[i - 1] != "\\"):
                    eq_idx = i
                    break
            if eq_idx > 0 and is_valid_assignment_lhs(value[:eq_idx]):
                return Token(
                    type=TokenType.ASSIGNMENT_WORD,
                    value=value,
                    start=start,
                    end=pos,
                    line=line,
                    column=column,
                )

        # Build segments from boundaries if we had quoting transitions
        final_segments = None
        if seg_boundaries:
            final_segments = []
            prev_offset = 0
            for offset, mode in seg_boundaries:
                text = value[prev_offset:offset]
                if text:
                    final_segments.append((text, mode))
                prev_offset = offset
            # Add final segment
            final_text = value[prev_offset:]
            if final_text:
                final_segments.append((final_text, seg_mode))
            # Only use segments if there are multiple (mixed quoting)
            if len(final_segments) <= 1:
                final_segments = None

        return Token(
            type=TokenType.WORD,
            value=value,
            start=start,
            end=pos,
            line=line,
            column=column,
            quoted=quoted,
            single_quoted=single_quoted,
            segments=final_segments,
        )

    def _register_heredoc_from_lookahead(self, strip_tabs: bool) -> None:
        """Register a here-document by looking ahead for the delimiter."""
        input_text = self.input
        input_len = len(input_text)
        pos = self.pos

        # Skip whitespace
        while pos < input_len and input_text[pos] in " \t":
            pos += 1

        if pos >= input_len:
            return

        # Read delimiter
        delimiter = ""
        quoted = False
        in_single_quote = False
        in_double_quote = False

        # Check for quoted delimiter
        if input_text[pos] == "'":
            quoted = True
            in_single_quote = True
            pos += 1
        elif input_text[pos] == '"':
            quoted = True
            in_double_quote = True
            pos += 1

        while pos < input_len:
            c = input_text[pos]

            if in_single_quote:
                if c == "'":
                    in_single_quote = False
                    pos += 1
                    continue
                delimiter += c
            elif in_double_quote:
                if c == '"':
                    in_double_quote = False
                    pos += 1
                    continue
                delimiter += c
            else:
                if c in " \t\n;|&<>()":
                    break
                # Handle backslash escapes in unquoted delimiter
                if c == "\\" and pos + 1 < input_len:
                    delimiter += input_text[pos + 1]
                    pos += 2
                    quoted = True  # Backslash makes it quoted
                    continue
                # Handle embedded quotes (e.g., E'O'F)
                if c == "'":
                    in_single_quote = True
                    quoted = True
                    pos += 1
                    continue
                if c == '"':
                    in_double_quote = True
                    quoted = True
                    pos += 1
                    continue
                delimiter += c

            pos += 1

        if delimiter:
            self.pending_heredocs.append(
                HeredocInfo(delimiter=delimiter, strip_tabs=strip_tabs, quoted=quoted)
            )

    def _read_heredoc_content(self) -> None:
        """Read here-document content."""
        if not self.pending_heredocs:
            return

        input_text = self.input
        input_len = len(input_text)

        for heredoc in self.pending_heredocs:
            delimiter = heredoc.delimiter
            strip_tabs = heredoc.strip_tabs
            start = self.pos
            start_line = self.line
            start_column = self.column

            content = ""
            while self.pos < input_len:
                # Read a line
                line_start = self.pos
                line_content = ""

                while self.pos < input_len and input_text[self.pos] != "\n":
                    line_content += input_text[self.pos]
                    self.pos += 1

                # Include newline if present
                if self.pos < input_len:
                    self.pos += 1
                    self.line += 1
                    self.column = 1

                # Check if this line is the delimiter
                check_line = line_content
                if strip_tabs:
                    check_line = line_content.lstrip("\t")

                if check_line == delimiter:
                    break

                # Add line to content (with tab stripping if applicable)
                if strip_tabs:
                    content += line_content.lstrip("\t") + "\n"
                else:
                    content += line_content + "\n"

            # Create token for heredoc content
            self.tokens.append(
                Token(
                    type=TokenType.HEREDOC_CONTENT,
                    value=content,
                    start=start,
                    end=self.pos,
                    line=start_line,
                    column=start_column,
                )
            )

        self.pending_heredocs.clear()


def tokenize(input_text: str) -> list[Token]:
    """Convenience function to tokenize input."""
    lexer = Lexer(input_text)
    return lexer.tokenize()


# HTML entity mappings
HTML_ENTITIES: dict[str, str] = {
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&apos;": "'",
}


def unescape_html_entities(input_text: str) -> str:
    """Unescape HTML entities in operator positions (outside quotes and heredocs).

    This handles LLM-generated bash commands that contain HTML-escaped
    operators like &lt; instead of <.

    Only unescapes entities outside of:
    - Single quotes
    - Double quotes
    - Heredoc content

    Args:
        input_text: The bash script that may contain HTML entities.

    Returns:
        The script with HTML entities unescaped in operator positions.
    """
    result: list[str] = []
    i = 0
    n = len(input_text)
    in_single_quote = False
    in_double_quote = False
    heredoc_delimiter: str | None = None  # None means not in heredoc

    while i < n:
        char = input_text[i]

        # If we're in a heredoc, look for the end delimiter
        if heredoc_delimiter is not None:
            # Check if this line matches the heredoc delimiter
            line_start = i
            line_end = input_text.find("\n", i)
            if line_end == -1:
                line_end = n

            line = input_text[line_start:line_end]
            # For <<- heredocs, delimiter may be preceded by tabs
            stripped_line = line.lstrip("\t")

            if stripped_line == heredoc_delimiter or line == heredoc_delimiter:
                # End of heredoc - output the line and exit heredoc mode
                if line_end < n:
                    result.append(input_text[i : line_end + 1])
                    i = line_end + 1
                else:
                    result.append(input_text[i:line_end])
                    i = line_end
                heredoc_delimiter = None
                continue

            # Still in heredoc - output the entire line as-is
            if line_end < n:
                result.append(input_text[i : line_end + 1])
                i = line_end + 1
            else:
                result.append(input_text[i:line_end])
                i = line_end
            continue

        # Handle quote state tracking
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
            result.append(char)
            i += 1
            continue

        if char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
            result.append(char)
            i += 1
            continue

        # Handle backslash escapes (only outside single quotes)
        if char == "\\" and not in_single_quote and i + 1 < n:
            # Keep the backslash and next character as-is
            result.append(char)
            result.append(input_text[i + 1])
            i += 2
            continue

        # Detect heredoc start (only outside quotes)
        if not in_single_quote and not in_double_quote and char == "<":
            # Check for << or <<-
            if i + 1 < n and input_text[i + 1] == "<":
                strip_tabs = i + 2 < n and input_text[i + 2] == "-"
                heredoc_op_len = 3 if strip_tabs else 2

                # Output the << or <<-
                result.append(input_text[i : i + heredoc_op_len])
                i += heredoc_op_len

                # Skip whitespace after operator
                while i < n and input_text[i] in " \t":
                    result.append(input_text[i])
                    i += 1

                if i >= n:
                    continue

                # Parse the delimiter
                delimiter = ""

                if input_text[i] == "'":
                    # Single-quoted delimiter
                    result.append("'")
                    i += 1
                    while i < n and input_text[i] != "'":
                        delimiter += input_text[i]
                        result.append(input_text[i])
                        i += 1
                    if i < n:
                        result.append("'")
                        i += 1
                elif input_text[i] == '"':
                    # Double-quoted delimiter
                    result.append('"')
                    i += 1
                    while i < n and input_text[i] != '"':
                        delimiter += input_text[i]
                        result.append(input_text[i])
                        i += 1
                    if i < n:
                        result.append('"')
                        i += 1
                else:
                    # Unquoted delimiter
                    while i < n and input_text[i] not in " \t\n;|&<>()":
                        if input_text[i] == "\\" and i + 1 < n:
                            # Backslash-escaped character in delimiter
                            delimiter += input_text[i + 1]
                            result.append(input_text[i : i + 2])
                            i += 2
                        else:
                            delimiter += input_text[i]
                            result.append(input_text[i])
                            i += 1

                # Find the end of this line (heredoc content starts on next line)
                while i < n and input_text[i] != "\n":
                    result.append(input_text[i])
                    i += 1

                if i < n:
                    result.append("\n")
                    i += 1
                    # Now in heredoc mode
                    heredoc_delimiter = delimiter

                continue

        # Only attempt HTML entity replacement outside quotes
        if not in_single_quote and not in_double_quote and char == "&":
            # Check for HTML entities
            matched = False
            for entity, replacement in HTML_ENTITIES.items():
                if input_text[i:].startswith(entity):
                    result.append(replacement)
                    i += len(entity)
                    matched = True
                    break
            if matched:
                continue

        # Regular character
        result.append(char)
        i += 1

    return "".join(result)
