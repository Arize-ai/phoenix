"""Tokenizer for jq expressions.

Converts a jq expression string into a sequence of tokens.
"""

from .types import Token, TokenType

# Keywords mapping
KEYWORDS: dict[str, TokenType] = {
    "and": TokenType.AND,
    "or": TokenType.OR,
    "not": TokenType.NOT,
    "if": TokenType.IF,
    "then": TokenType.THEN,
    "elif": TokenType.ELIF,
    "else": TokenType.ELSE,
    "end": TokenType.END,
    "as": TokenType.AS,
    "try": TokenType.TRY,
    "catch": TokenType.CATCH,
    "true": TokenType.TRUE,
    "false": TokenType.FALSE,
    "null": TokenType.NULL,
    "reduce": TokenType.REDUCE,
    "foreach": TokenType.FOREACH,
    "def": TokenType.DEF,
    "label": TokenType.LABEL,
}


def tokenize(input_str: str) -> list[Token]:
    """Tokenize a jq expression string into a list of tokens.

    Args:
        input_str: The jq expression to tokenize

    Returns:
        A list of Token objects

    Raises:
        ValueError: If an unexpected character is encountered
    """
    tokens: list[Token] = []
    pos = 0
    length = len(input_str)

    def peek(offset: int = 0) -> str:
        """Look at character at current position + offset."""
        idx = pos + offset
        return input_str[idx] if idx < length else ""

    def advance() -> str:
        """Advance position and return the character."""
        nonlocal pos
        c = input_str[pos] if pos < length else ""
        pos += 1
        return c

    def is_eof() -> bool:
        """Check if at end of input."""
        return pos >= length

    def is_digit(c: str) -> bool:
        """Check if character is a digit."""
        return c >= "0" and c <= "9"

    def is_alpha(c: str) -> bool:
        """Check if character is alphabetic or underscore."""
        return (c >= "a" and c <= "z") or (c >= "A" and c <= "Z") or c == "_"

    def is_alnum(c: str) -> bool:
        """Check if character is alphanumeric or underscore."""
        return is_alpha(c) or is_digit(c)

    while not is_eof():
        start = pos
        c = advance()

        # Whitespace - skip
        if c in " \t\n\r":
            continue

        # Comments - skip to end of line
        if c == "#":
            while not is_eof() and peek() != "\n":
                advance()
            continue

        # Two-character operators (must check before single-char)

        # .. (recurse)
        if c == "." and peek() == ".":
            advance()
            tokens.append(Token(TokenType.DOTDOT, None, start))
            continue

        # == (equality)
        if c == "=" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.EQ, None, start))
            continue

        # != (not equal)
        if c == "!" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.NE, None, start))
            continue

        # <= (less than or equal)
        if c == "<" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.LE, None, start))
            continue

        # >= (greater than or equal)
        if c == ">" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.GE, None, start))
            continue

        # // and //= (alternative and update alternative)
        if c == "/" and peek() == "/":
            advance()
            if peek() == "=":
                advance()
                tokens.append(Token(TokenType.UPDATE_ALT, None, start))
            else:
                tokens.append(Token(TokenType.ALT, None, start))
            continue

        # += (update add)
        if c == "+" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.UPDATE_ADD, None, start))
            continue

        # -= (update subtract)
        if c == "-" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.UPDATE_SUB, None, start))
            continue

        # *= (update multiply)
        if c == "*" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.UPDATE_MUL, None, start))
            continue

        # /= (update divide) - only if not //
        if c == "/" and peek() == "=" and not (pos > 1 and input_str[pos - 2] == "/"):
            advance()
            tokens.append(Token(TokenType.UPDATE_DIV, None, start))
            continue

        # %= (update modulo)
        if c == "%" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.UPDATE_MOD, None, start))
            continue

        # |= (update pipe)
        if c == "|" and peek() == "=":
            advance()
            tokens.append(Token(TokenType.UPDATE_PIPE, None, start))
            continue

        # = (assignment) - single = that's not part of ==
        if c == "=" and peek() != "=":
            tokens.append(Token(TokenType.ASSIGN, None, start))
            continue

        # Single-character tokens
        if c == ".":
            tokens.append(Token(TokenType.DOT, None, start))
            continue

        if c == "|":
            tokens.append(Token(TokenType.PIPE, None, start))
            continue

        if c == ",":
            tokens.append(Token(TokenType.COMMA, None, start))
            continue

        if c == ":":
            tokens.append(Token(TokenType.COLON, None, start))
            continue

        if c == ";":
            tokens.append(Token(TokenType.SEMICOLON, None, start))
            continue

        if c == "(":
            tokens.append(Token(TokenType.LPAREN, None, start))
            continue

        if c == ")":
            tokens.append(Token(TokenType.RPAREN, None, start))
            continue

        if c == "[":
            tokens.append(Token(TokenType.LBRACKET, None, start))
            continue

        if c == "]":
            tokens.append(Token(TokenType.RBRACKET, None, start))
            continue

        if c == "{":
            tokens.append(Token(TokenType.LBRACE, None, start))
            continue

        if c == "}":
            tokens.append(Token(TokenType.RBRACE, None, start))
            continue

        if c == "?":
            tokens.append(Token(TokenType.QUESTION, None, start))
            continue

        if c == "+":
            tokens.append(Token(TokenType.PLUS, None, start))
            continue

        if c == "-":
            # Only treat as negative number if preceded by an operator or start of input
            # After a value (number, string, ident, ), ], etc.) it's the minus operator
            prev_is_value = False
            if tokens:
                prev_type = tokens[-1].type
                prev_is_value = prev_type in (
                    TokenType.NUMBER, TokenType.STRING, TokenType.IDENT,
                    TokenType.RPAREN, TokenType.RBRACKET, TokenType.RBRACE,
                    TokenType.TRUE, TokenType.FALSE, TokenType.NULL,
                    TokenType.DOT, TokenType.QUESTION,
                )
            if is_digit(peek()) and not prev_is_value:
                num = c
                while not is_eof() and (is_digit(peek()) or peek() == "."):
                    num += advance()
                # Handle scientific notation
                if not is_eof() and peek() in "eE":
                    num += advance()
                    if not is_eof() and peek() in "+-":
                        num += advance()
                    while not is_eof() and is_digit(peek()):
                        num += advance()
                try:
                    value = float(num) if "." in num or "e" in num or "E" in num else int(num)
                    tokens.append(Token(TokenType.NUMBER, value, start))
                except ValueError:
                    tokens.append(Token(TokenType.NUMBER, float(num), start))
                continue
            tokens.append(Token(TokenType.MINUS, None, start))
            continue

        if c == "*":
            tokens.append(Token(TokenType.STAR, None, start))
            continue

        if c == "/":
            tokens.append(Token(TokenType.SLASH, None, start))
            continue

        if c == "%":
            tokens.append(Token(TokenType.PERCENT, None, start))
            continue

        if c == "<":
            tokens.append(Token(TokenType.LT, None, start))
            continue

        if c == ">":
            tokens.append(Token(TokenType.GT, None, start))
            continue

        # Numbers
        if is_digit(c):
            num = c
            while not is_eof() and (is_digit(peek()) or peek() == "." or peek() in "eE"):
                if peek() in "eE":
                    num += advance()
                    if not is_eof() and peek() in "+-":
                        num += advance()
                else:
                    num += advance()
            try:
                value = float(num) if "." in num or "e" in num or "E" in num else int(num)
                tokens.append(Token(TokenType.NUMBER, value, start))
            except ValueError:
                tokens.append(Token(TokenType.NUMBER, float(num), start))
            continue

        # Strings
        if c == '"':
            s = ""
            while not is_eof() and peek() != '"':
                if peek() == "\\":
                    advance()  # consume backslash
                    if is_eof():
                        break
                    escaped = advance()
                    if escaped == "n":
                        s += "\n"
                    elif escaped == "r":
                        s += "\r"
                    elif escaped == "t":
                        s += "\t"
                    elif escaped == "b":
                        s += "\b"
                    elif escaped == "f":
                        s += "\f"
                    elif escaped == "\\":
                        s += "\\"
                    elif escaped == "/":
                        s += "/"
                    elif escaped == '"':
                        s += '"'
                    elif escaped == "(":
                        # String interpolation \(expr) - track paren depth, skip inner strings
                        s += "\\("
                        interp_depth = 1
                        while not is_eof() and interp_depth > 0:
                            ic = peek()
                            if ic == "(":
                                interp_depth += 1
                                s += advance()
                            elif ic == ")":
                                interp_depth -= 1
                                if interp_depth > 0:
                                    s += advance()
                                else:
                                    advance()  # consume closing )
                            elif ic == '"':
                                # Inner string literal - read through it
                                s += advance()  # opening "
                                while not is_eof() and peek() != '"':
                                    if peek() == "\\":
                                        s += advance()  # backslash
                                        if not is_eof():
                                            s += advance()  # escaped char
                                    else:
                                        s += advance()
                                if not is_eof():
                                    s += advance()  # closing "
                            else:
                                s += advance()
                        s += ")"
                    elif escaped == "u":
                        # Unicode escape \uXXXX
                        hex_str = ""
                        for _ in range(4):
                            if not is_eof():
                                hex_str += advance()
                        try:
                            s += chr(int(hex_str, 16))
                        except ValueError:
                            s += "\\u" + hex_str
                    else:
                        s += escaped
                else:
                    s += advance()
            if not is_eof():
                advance()  # consume closing quote
            tokens.append(Token(TokenType.STRING, s, start))
            continue

        # Identifiers and keywords (including $variables and @formats)
        if is_alpha(c) or c == "$" or c == "@":
            ident = c
            while not is_eof() and is_alnum(peek()):
                ident += advance()

            # Check for keyword
            keyword_type = KEYWORDS.get(ident)
            if keyword_type:
                tokens.append(Token(keyword_type, None, start))
            else:
                tokens.append(Token(TokenType.IDENT, ident, start))
            continue

        raise ValueError(f"Unexpected character '{c}' at position {start}")

    tokens.append(Token(TokenType.EOF, None, pos))
    return tokens
