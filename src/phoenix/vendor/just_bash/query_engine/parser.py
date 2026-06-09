"""Parser for jq expressions.

Converts a token sequence into an AST using recursive descent parsing.
"""

from .tokenizer import tokenize
from .types import (
    ArrayDestructure,
    ArrayNode,
    AstNode,
    BinaryOpNode,
    BreakNode,
    CallNode,
    CommaNode,
    CondNode,
    DefNode,
    DestructurePattern,
    ElifBranch,
    FieldNode,
    ForeachNode,
    IdentityNode,
    IndexNode,
    IterateNode,
    LabelNode,
    LiteralNode,
    ObjectDestructure,
    ObjectEntry,
    ObjectNode,
    OptionalNode,
    ParenNode,
    PipeNode,
    RecurseNode,
    ReduceNode,
    SliceNode,
    StringInterpNode,
    Token,
    TokenType,
    TryNode,
    UnaryOpNode,
    UpdateOpNode,
    VarBindNode,
    VarRefNode,
)


class Parser:
    """Recursive descent parser for jq expressions."""

    def __init__(self, tokens: list[Token]):
        self.tokens = tokens
        self.pos = 0

    def peek(self, offset: int = 0) -> Token:
        """Look at token at current position + offset."""
        idx = self.pos + offset
        if idx < len(self.tokens):
            return self.tokens[idx]
        return Token(TokenType.EOF, None, -1)

    def advance(self) -> Token:
        """Advance and return current token."""
        tok = (
            self.tokens[self.pos] if self.pos < len(self.tokens) else Token(TokenType.EOF, None, -1)
        )
        self.pos += 1
        return tok

    def check(self, type_: TokenType) -> bool:
        """Check if current token is of given type."""
        return self.peek().type == type_

    def match(self, *types: TokenType) -> Token | None:
        """If current token matches any type, advance and return it."""
        for t in types:
            if self.check(t):
                return self.advance()
        return None

    def expect(self, type_: TokenType, msg: str) -> Token:
        """Expect current token to be of given type, or raise error."""
        if not self.check(type_):
            raise ValueError(f"{msg} at position {self.peek().pos}, got {self.peek().type.name}")
        return self.advance()

    def parse(self) -> AstNode:
        """Parse the entire expression."""
        expr = self.parse_expr()
        if not self.check(TokenType.EOF):
            raise ValueError(
                f"Unexpected token {self.peek().type.name} at position {self.peek().pos}"
            )
        return expr

    def parse_expr(self) -> AstNode:
        """Parse an expression (top level)."""
        # def name(args): body; rest
        if self.check(TokenType.DEF):
            return self.parse_def()
        # label $name | body
        if self.check(TokenType.LABEL):
            return self.parse_label()
        return self.parse_pipe()

    def parse_pipe(self) -> AstNode:
        """Parse pipe expressions (left-associative |)."""
        left = self.parse_comma()
        while self.match(TokenType.PIPE):
            right = self.parse_comma()
            left = PipeNode(left, right)
        return left

    def parse_comma(self) -> AstNode:
        """Parse comma expressions (left-associative ,)."""
        left = self.parse_var_bind()
        while self.match(TokenType.COMMA):
            # Allow def in right side of comma
            if self.check(TokenType.DEF):
                right = self.parse_def()
            else:
                right = self.parse_var_bind()
            left = CommaNode(left, right)
        return left

    def parse_var_bind(self) -> AstNode:
        """Parse variable binding (expr as $var | body) or destructuring with ?// alternatives."""
        expr = self.parse_update()
        if self.match(TokenType.AS):
            pattern = self.parse_pattern()
            alt_patterns: list = []
            # Check for ?// alternative patterns
            while self.check(TokenType.QUESTION) and self.peek(1).type == TokenType.ALT:
                self.advance()  # consume ?
                self.advance()  # consume //
                alt_patterns.append(self.parse_pattern())
            self.expect(TokenType.PIPE, "Expected '|' after variable binding")
            body = self.parse_expr()
            return VarBindNode(pattern, expr, body, alt_patterns)
        return expr

    def parse_pattern(self) -> DestructurePattern:
        """Parse a binding pattern: $var, [$a, $b], or {key: $var}."""
        if self.check(TokenType.IDENT):
            var_token = self.advance()
            var_name = var_token.value
            if not isinstance(var_name, str) or not var_name.startswith("$"):
                raise ValueError(f"Variable name must start with $ at position {var_token.pos}")
            return var_name
        if self.match(TokenType.LBRACKET):
            elements: list[DestructurePattern] = []
            if not self.check(TokenType.RBRACKET):
                elements.append(self.parse_pattern())
                while self.match(TokenType.COMMA):
                    elements.append(self.parse_pattern())
            self.expect(TokenType.RBRACKET, "Expected ']' in array pattern")
            return ArrayDestructure(elements)
        if self.match(TokenType.LBRACE):
            entries: list[tuple[str, DestructurePattern]] = []
            if not self.check(TokenType.RBRACE):
                while True:
                    # Key can be identifier, keyword, or string
                    key: str
                    if self.check(TokenType.IDENT) and isinstance(self.peek().value, str) and self.peek().value.startswith("$"):
                        # {$a} shorthand: key is "a", pattern is $a
                        tok = self.advance()
                        var_name = tok.value
                        key = var_name[1:]  # strip $
                        pat = var_name
                        entries.append((key, pat))
                        if not self.match(TokenType.COMMA):
                            break
                        continue
                    if self.check(TokenType.STRING):
                        key = self.advance().value
                    elif self.check(TokenType.IDENT) or self.peek().type in (
                        TokenType.AS, TokenType.IF, TokenType.THEN, TokenType.ELSE,
                        TokenType.END, TokenType.AND, TokenType.OR, TokenType.NOT,
                        TokenType.TRY, TokenType.CATCH, TokenType.REDUCE, TokenType.FOREACH,
                        TokenType.DEF, TokenType.LABEL,
                    ):
                        tok = self.advance()
                        key = tok.value if tok.value else tok.type.name.lower()
                    elif self.match(TokenType.LPAREN):
                        # Dynamic key expression - parse but use as string
                        _key_expr = self.parse_expr()
                        self.expect(TokenType.RPAREN, "Expected ')'")
                        key = "__dynamic__"  # placeholder
                    else:
                        raise ValueError(f"Expected key in object pattern at position {self.peek().pos}")
                    self.expect(TokenType.COLON, "Expected ':' in object pattern")
                    pat = self.parse_pattern()
                    entries.append((key, pat))
                    if not self.match(TokenType.COMMA):
                        break
            self.expect(TokenType.RBRACE, "Expected '}' in object pattern")
            return ObjectDestructure(entries)
        raise ValueError(f"Expected variable name or destructuring pattern at position {self.peek().pos}")

    def parse_update(self) -> AstNode:
        """Parse update operators (=, |=, +=, -=, *=, /=, %=, //=)."""
        left = self.parse_alt()
        op_map = {
            TokenType.ASSIGN: "=",
            TokenType.UPDATE_ADD: "+=",
            TokenType.UPDATE_SUB: "-=",
            TokenType.UPDATE_MUL: "*=",
            TokenType.UPDATE_DIV: "/=",
            TokenType.UPDATE_MOD: "%=",
            TokenType.UPDATE_ALT: "//=",
            TokenType.UPDATE_PIPE: "|=",
        }
        tok = self.match(
            TokenType.ASSIGN,
            TokenType.UPDATE_ADD,
            TokenType.UPDATE_SUB,
            TokenType.UPDATE_MUL,
            TokenType.UPDATE_DIV,
            TokenType.UPDATE_MOD,
            TokenType.UPDATE_ALT,
            TokenType.UPDATE_PIPE,
        )
        if tok:
            value = self.parse_var_bind()
            return UpdateOpNode(op_map[tok.type], left, value)
        return left

    def parse_alt(self) -> AstNode:
        """Parse alternative operator (//)."""
        left = self.parse_or()
        while self.match(TokenType.ALT):
            right = self.parse_or()
            left = BinaryOpNode("//", left, right)
        return left

    def parse_or(self) -> AstNode:
        """Parse or operator."""
        left = self.parse_and()
        while self.match(TokenType.OR):
            right = self.parse_and()
            left = BinaryOpNode("or", left, right)
        return left

    def parse_and(self) -> AstNode:
        """Parse and operator."""
        left = self.parse_comparison()
        while self.match(TokenType.AND):
            right = self.parse_comparison()
            left = BinaryOpNode("and", left, right)
        return left

    def parse_comparison(self) -> AstNode:
        """Parse comparison operators (==, !=, <, <=, >, >=)."""
        left = self.parse_add_sub()
        op_map = {
            TokenType.EQ: "==",
            TokenType.NE: "!=",
            TokenType.LT: "<",
            TokenType.LE: "<=",
            TokenType.GT: ">",
            TokenType.GE: ">=",
        }
        tok = self.match(
            TokenType.EQ, TokenType.NE, TokenType.LT, TokenType.LE, TokenType.GT, TokenType.GE
        )
        if tok:
            right = self.parse_add_sub()
            left = BinaryOpNode(op_map[tok.type], left, right)
        return left

    def parse_add_sub(self) -> AstNode:
        """Parse addition and subtraction (left-associative)."""
        left = self.parse_mul_div()
        while True:
            if self.match(TokenType.PLUS):
                right = self.parse_mul_div()
                left = BinaryOpNode("+", left, right)
            elif self.match(TokenType.MINUS):
                right = self.parse_mul_div()
                left = BinaryOpNode("-", left, right)
            else:
                break
        return left

    def parse_mul_div(self) -> AstNode:
        """Parse multiplication, division, and modulo (left-associative)."""
        left = self.parse_unary()
        while True:
            if self.match(TokenType.STAR):
                right = self.parse_unary()
                left = BinaryOpNode("*", left, right)
            elif self.match(TokenType.SLASH):
                right = self.parse_unary()
                left = BinaryOpNode("/", left, right)
            elif self.match(TokenType.PERCENT):
                right = self.parse_unary()
                left = BinaryOpNode("%", left, right)
            else:
                break
        return left

    def parse_unary(self) -> AstNode:
        """Parse unary operators (-)."""
        if self.match(TokenType.MINUS):
            operand = self.parse_unary()
            return UnaryOpNode("-", operand)
        return self.parse_postfix()

    def parse_postfix(self) -> AstNode:
        """Parse postfix operators (?, .[...], .field, .["str"])."""
        expr = self.parse_primary()

        while True:
            if self.match(TokenType.QUESTION):
                expr = OptionalNode(expr)
            elif self.check(TokenType.DOT) and self.peek(1).type in (TokenType.IDENT, TokenType.STRING):
                self.advance()  # consume DOT
                name_tok = self.advance()
                expr = FieldNode(name_tok.value, expr)
            elif self.check(TokenType.DOT) and self.peek(1).type == TokenType.LBRACKET:
                # .[] or .[n] or .[n:m] after expression
                self.advance()  # consume DOT
                self.advance()  # consume LBRACKET
                if self.match(TokenType.RBRACKET):
                    expr = IterateNode(expr)
                elif self.check(TokenType.COLON):
                    self.advance()
                    end = None if self.check(TokenType.RBRACKET) else self.parse_expr()
                    self.expect(TokenType.RBRACKET, "Expected ']'")
                    expr = SliceNode(None, end, expr)
                else:
                    index_expr = self.parse_expr()
                    if self.match(TokenType.COLON):
                        end = None if self.check(TokenType.RBRACKET) else self.parse_expr()
                        self.expect(TokenType.RBRACKET, "Expected ']'")
                        expr = SliceNode(index_expr, end, expr)
                    else:
                        self.expect(TokenType.RBRACKET, "Expected ']'")
                        expr = IndexNode(index_expr, expr)
            elif self.check(TokenType.LBRACKET):
                self.advance()
                if self.match(TokenType.RBRACKET):
                    expr = IterateNode(expr)
                elif self.check(TokenType.COLON):
                    self.advance()
                    end = None if self.check(TokenType.RBRACKET) else self.parse_expr()
                    self.expect(TokenType.RBRACKET, "Expected ']'")
                    expr = SliceNode(None, end, expr)
                else:
                    index_expr = self.parse_expr()
                    if self.match(TokenType.COLON):
                        end = None if self.check(TokenType.RBRACKET) else self.parse_expr()
                        self.expect(TokenType.RBRACKET, "Expected ']'")
                        expr = SliceNode(index_expr, end, expr)
                    else:
                        self.expect(TokenType.RBRACKET, "Expected ']'")
                        expr = IndexNode(index_expr, expr)
            else:
                break

        return expr

    def parse_primary(self) -> AstNode:
        """Parse primary expressions."""
        # Recursive descent (..)
        if self.match(TokenType.DOTDOT):
            return RecurseNode()

        # Identity or field access starting with dot
        if self.match(TokenType.DOT):
            # Check for .[] or .[n] or .[n:m]
            if self.check(TokenType.LBRACKET):
                self.advance()
                if self.match(TokenType.RBRACKET):
                    return IterateNode()
                if self.check(TokenType.COLON):
                    self.advance()
                    end = None if self.check(TokenType.RBRACKET) else self.parse_expr()
                    self.expect(TokenType.RBRACKET, "Expected ']'")
                    return SliceNode(None, end)
                index_expr = self.parse_expr()
                if self.match(TokenType.COLON):
                    end = None if self.check(TokenType.RBRACKET) else self.parse_expr()
                    self.expect(TokenType.RBRACKET, "Expected ']'")
                    return SliceNode(index_expr, end)
                self.expect(TokenType.RBRACKET, "Expected ']'")
                return IndexNode(index_expr)
            # .field
            if self.check(TokenType.IDENT):
                name = self.advance().value
                return FieldNode(name)
            # ."field" (string field access)
            if self.check(TokenType.STRING):
                name = self.advance().value
                return FieldNode(name)
            # Just identity
            return IdentityNode()

        # Literals
        if self.match(TokenType.TRUE):
            return LiteralNode(True)
        if self.match(TokenType.FALSE):
            return LiteralNode(False)
        if self.match(TokenType.NULL):
            return LiteralNode(None)
        if self.check(TokenType.NUMBER):
            tok = self.advance()
            return LiteralNode(tok.value)
        if self.check(TokenType.STRING):
            tok = self.advance()
            s = tok.value
            # Check for string interpolation
            if isinstance(s, str) and "\\(" in s:
                return self.parse_string_interpolation(s)
            return LiteralNode(s)

        # Array construction
        if self.match(TokenType.LBRACKET):
            if self.match(TokenType.RBRACKET):
                return ArrayNode()
            elements = self.parse_expr()
            self.expect(TokenType.RBRACKET, "Expected ']'")
            return ArrayNode(elements)

        # Object construction
        if self.match(TokenType.LBRACE):
            return self.parse_object_construction()

        # Parentheses
        if self.match(TokenType.LPAREN):
            expr = self.parse_expr()
            self.expect(TokenType.RPAREN, "Expected ')'")
            return ParenNode(expr)

        # def in primary position
        if self.check(TokenType.DEF):
            return self.parse_def()

        # if-then-else
        if self.match(TokenType.IF):
            return self.parse_if()

        # try-catch
        if self.match(TokenType.TRY):
            body = self.parse_unary()
            catch_expr = None
            if self.match(TokenType.CATCH):
                catch_expr = self.parse_unary()
            return TryNode(body, catch_expr)

        # reduce EXPR as $VAR/PATTERN (INIT; UPDATE)
        if self.match(TokenType.REDUCE):
            expr = self.parse_comparison()
            self.expect(TokenType.AS, "Expected 'as' after reduce expression")
            pattern = self.parse_pattern()
            self.expect(TokenType.LPAREN, "Expected '(' after variable/pattern")
            init = self.parse_expr()
            self.expect(TokenType.SEMICOLON, "Expected ';' after init expression")
            update = self.parse_expr()
            self.expect(TokenType.RPAREN, "Expected ')' after update expression")
            return ReduceNode(expr, pattern, init, update)

        # foreach EXPR as $VAR/PATTERN (INIT; UPDATE) or (INIT; UPDATE; EXTRACT)
        if self.match(TokenType.FOREACH):
            expr = self.parse_comparison()
            self.expect(TokenType.AS, "Expected 'as' after foreach expression")
            pattern = self.parse_pattern()
            self.expect(TokenType.LPAREN, "Expected '(' after variable/pattern")
            init = self.parse_expr()
            self.expect(TokenType.SEMICOLON, "Expected ';' after init expression")
            update = self.parse_expr()
            extract = None
            if self.match(TokenType.SEMICOLON):
                extract = self.parse_expr()
            self.expect(TokenType.RPAREN, "Expected ')' after expressions")
            return ForeachNode(expr, pattern, init, update, extract)

        # not as a standalone filter (when used as a function, not unary operator)
        if self.match(TokenType.NOT):
            return CallNode("not")

        # label (when used in primary position, e.g. inside [])
        if self.check(TokenType.LABEL):
            return self.parse_label()

        # Variable reference or function call
        if self.check(TokenType.IDENT):
            tok = self.advance()
            name = tok.value

            # break $label
            if name == "break" and self.check(TokenType.IDENT):
                label_tok = self.advance()
                label_name = label_tok.value
                return BreakNode(label_name)

            # Variable reference
            if isinstance(name, str) and name.startswith("$"):
                return VarRefNode(name)

            # Function call with args
            if self.match(TokenType.LPAREN):
                args: list[AstNode] = []
                if not self.check(TokenType.RPAREN):
                    args.append(self.parse_expr())
                    while self.match(TokenType.SEMICOLON):
                        args.append(self.parse_expr())
                self.expect(TokenType.RPAREN, "Expected ')'")
                return CallNode(name, args)

            # @format "string" syntax (e.g. @html "<b>\(.)</b>")
            if isinstance(name, str) and name.startswith("@") and self.check(TokenType.STRING):
                str_tok = self.advance()
                s = str_tok.value
                if isinstance(s, str) and "\\(" in s:
                    interp = self.parse_string_interpolation(s)
                    # Apply format to each interpolated expression, not the whole string
                    for i, part in enumerate(interp.parts):
                        if not isinstance(part, str):
                            interp.parts[i] = PipeNode(part, CallNode(name))
                    return interp
                return PipeNode(LiteralNode(s), CallNode(name))

            # Builtin without parens
            return CallNode(name)

        raise ValueError(f"Unexpected token {self.peek().type.name} at position {self.peek().pos}")

    def parse_def(self) -> DefNode:
        """Parse function definition: def name: body; or def name(a;b): body;"""
        self.advance()  # consume 'def'
        name_tok = self.expect(TokenType.IDENT, "Expected function name after 'def'")
        name = name_tok.value

        # Parse optional parameters
        args: list[str] = []
        if self.match(TokenType.LPAREN):
            if not self.check(TokenType.RPAREN):
                arg_tok = self.expect(TokenType.IDENT, "Expected parameter name")
                args.append(arg_tok.value)
                while self.match(TokenType.SEMICOLON):
                    arg_tok = self.expect(TokenType.IDENT, "Expected parameter name")
                    args.append(arg_tok.value)
            self.expect(TokenType.RPAREN, "Expected ')' after parameters")

        self.expect(TokenType.COLON, "Expected ':' after function name/params")
        body = self.parse_expr()
        self.expect(TokenType.SEMICOLON, "Expected ';' after function body")
        rest = self.parse_expr()
        return DefNode(name, args, body, rest)

    def parse_label(self) -> LabelNode:
        """Parse label expression: label $name | body"""
        self.advance()  # consume 'label'
        var_tok = self.expect(TokenType.IDENT, "Expected variable name after 'label'")
        name = var_tok.value
        if not isinstance(name, str) or not name.startswith("$"):
            raise ValueError(f"Label name must start with $ at position {var_tok.pos}")
        self.expect(TokenType.PIPE, "Expected '|' after label variable")
        body = self.parse_expr()
        return LabelNode(name, body)

    def parse_object_construction(self) -> ObjectNode:
        """Parse object construction {...}."""
        entries: list[ObjectEntry] = []

        if not self.check(TokenType.RBRACE):
            while True:
                key: AstNode | str
                value: AstNode

                # Check for ({(.key): .value}) dynamic key
                if self.match(TokenType.LPAREN):
                    key = self.parse_expr()
                    self.expect(TokenType.RPAREN, "Expected ')'")
                    self.expect(TokenType.COLON, "Expected ':'")
                    value = self.parse_object_value()
                elif self.check(TokenType.IDENT) or self.peek().type in (
                    TokenType.IF, TokenType.THEN, TokenType.ELIF, TokenType.ELSE,
                    TokenType.END, TokenType.AS, TokenType.TRY, TokenType.CATCH,
                    TokenType.AND, TokenType.OR, TokenType.NOT, TokenType.REDUCE,
                    TokenType.FOREACH, TokenType.DEF, TokenType.LABEL,
                ):
                    ident_tok = self.advance()
                    ident = ident_tok.value if ident_tok.value else ident_tok.type.name.lower()
                    if self.match(TokenType.COLON):
                        # {key: value}
                        key = ident
                        value = self.parse_object_value()
                    else:
                        # {key} shorthand for {key: .key}
                        key = ident
                        value = FieldNode(ident)
                elif self.check(TokenType.STRING):
                    key_tok = self.advance()
                    key_val = key_tok.value
                    if self.match(TokenType.COLON):
                        key = key_val
                        value = self.parse_object_value()
                    else:
                        # {"string"} shorthand - key is literal, value is identity
                        if isinstance(key_val, str) and "\\(" in key_val:
                            key = self.parse_string_interpolation(key_val)
                        else:
                            key = key_val
                        value = FieldNode(key_val) if isinstance(key_val, str) else IdentityNode()
                else:
                    raise ValueError(f"Expected object key at position {self.peek().pos}")

                entries.append(ObjectEntry(key, value))

                if not self.match(TokenType.COMMA):
                    break

        self.expect(TokenType.RBRACE, "Expected '}'")
        return ObjectNode(entries)

    def parse_object_value(self) -> AstNode:
        """Parse object value - allows pipes but stops at comma or rbrace."""
        left = self.parse_var_bind()
        while self.match(TokenType.PIPE):
            right = self.parse_var_bind()
            left = PipeNode(left, right)
        return left

    def parse_if(self) -> CondNode:
        """Parse if-then-elif-else-end."""
        cond = self.parse_expr()
        self.expect(TokenType.THEN, "Expected 'then'")
        then = self.parse_expr()

        elifs: list[ElifBranch] = []
        while self.match(TokenType.ELIF):
            elif_cond = self.parse_expr()
            self.expect(TokenType.THEN, "Expected 'then' after elif")
            elif_then = self.parse_expr()
            elifs.append(ElifBranch(elif_cond, elif_then))

        else_expr = None
        if self.match(TokenType.ELSE):
            else_expr = self.parse_expr()

        self.expect(TokenType.END, "Expected 'end'")
        return CondNode(cond, then, elifs, else_expr)

    def parse_string_interpolation(self, s: str) -> StringInterpNode:
        """Parse a string with interpolation."""
        parts: list[str | AstNode] = []
        current = ""
        i = 0

        while i < len(s):
            if s[i] == "\\" and i + 1 < len(s) and s[i + 1] == "(":
                if current:
                    parts.append(current)
                    current = ""
                i += 2
                # Find matching paren - skip inner strings
                depth = 1
                expr_str = ""
                while i < len(s) and depth > 0:
                    if s[i] == '"':
                        # Inner string literal - skip through it
                        expr_str += s[i]
                        i += 1
                        while i < len(s) and s[i] != '"':
                            if s[i] == '\\' and i + 1 < len(s):
                                expr_str += s[i:i+2]
                                i += 2
                            else:
                                expr_str += s[i]
                                i += 1
                        if i < len(s):
                            expr_str += s[i]  # closing "
                            i += 1
                    elif s[i] == "(":
                        depth += 1
                        expr_str += s[i]
                        i += 1
                    elif s[i] == ")":
                        depth -= 1
                        if depth > 0:
                            expr_str += s[i]
                        i += 1
                    else:
                        expr_str += s[i]
                        i += 1
                tokens = tokenize(expr_str)
                parser = Parser(tokens)
                parts.append(parser.parse())
            else:
                current += s[i]
                i += 1

        if current:
            parts.append(current)

        return StringInterpNode(parts)


def parse(input_str: str) -> AstNode:
    """Parse a jq expression string into an AST.

    Args:
        input_str: The jq expression to parse

    Returns:
        The root AST node

    Raises:
        ValueError: If the expression is invalid
    """
    tokens = tokenize(input_str)
    parser = Parser(tokens)
    return parser.parse()
