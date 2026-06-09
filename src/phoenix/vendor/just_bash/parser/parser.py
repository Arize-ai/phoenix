"""
Recursive Descent Parser for Bash Scripts

This parser consumes tokens from the lexer and produces an AST.
It follows the bash grammar structure for correctness.

Grammar (simplified):
  script       ::= statement*
  statement    ::= pipeline ((&&|'||') pipeline)*  [&]
  pipeline     ::= [!] command (| command)*
  command      ::= simple_command | compound_command | function_def
  simple_cmd   ::= (assignment)* [word] (word)* (redirection)*
"""

from __future__ import annotations

import re
from typing import Optional, Sequence

from ..ast import (
    AST,
    ScriptNode,
    StatementNode,
    PipelineNode,
    SimpleCommandNode,
    CommandNode,
    WordNode,
    WordPart,
    LiteralPart,
    SingleQuotedPart,
    DoubleQuotedPart,
    EscapedPart,
    ParameterExpansionPart,
    CommandSubstitutionPart,
    GlobPart,
    TildeExpansionPart,
    AssignmentNode,
    RedirectionNode,
    RedirectionOperator,
    HereDocNode,
    # Compound command nodes
    IfNode,
    IfClause,
    ForNode,
    CStyleForNode,
    WhileNode,
    UntilNode,
    CaseNode,
    CaseItemNode,
    SubshellNode,
    GroupNode,
    FunctionDefNode,
    CompoundCommandNode,
    # Conditional command nodes
    ConditionalCommandNode,
    ArithmeticCommandNode,
    CondBinaryNode,
    CondUnaryNode,
    CondNotNode,
    CondAndNode,
    CondOrNode,
    CondGroupNode,
    CondWordNode,
    # Arithmetic nodes
    ArithmeticExpansionPart,
    ArithmeticExpressionNode,
    ArithNumberNode,
    ArithVariableNode,
    ArithBinaryNode,
    ArithUnaryNode,
    ArithGroupNode,
    ArithTernaryNode,
    ArithAssignmentNode,
    ArithExpr,
    # Process substitution
    ProcessSubstitutionPart,
    # Parameter expansion operations
    DefaultValueOp,
    AssignDefaultOp,
    ErrorIfUnsetOp,
    UseAlternativeOp,
    LengthOp,
    SubstringOp,
    PatternRemovalOp,
    PatternReplacementOp,
    CaseModificationOp,
    TransformOp,
    ParameterOperation,
)
from .lexer import Lexer, Token, TokenType


# Limits to prevent runaway parsing
MAX_INPUT_SIZE = 1_000_000  # 1MB
MAX_TOKENS = 100_000
MAX_PARSE_ITERATIONS = 1_000_000


class ParseException(Exception):
    """Exception raised during parsing."""

    def __init__(
        self,
        message: str,
        line: int = 1,
        column: int = 1,
        token: Optional[Token] = None,
    ) -> None:
        self.message = message
        self.line = line
        self.column = column
        self.token = token
        super().__init__(f"{message} at line {line}, column {column}")


def _decode_ansi_c_escapes(s: str) -> str:
    """Decode ANSI-C escape sequences from $'...' strings.

    Supports: \\a \\b \\e \\E \\f \\n \\r \\t \\v \\\\ \\' \\" \\0NNN \\NNN \\xHH \\uNNNN \\UNNNNNNNN
    """
    result: list[str] = []
    i = 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            c = s[i + 1]
            if c == "a":
                result.append("\a")
                i += 2
            elif c == "b":
                result.append("\b")
                i += 2
            elif c in ("e", "E"):
                result.append("\x1b")
                i += 2
            elif c == "f":
                result.append("\f")
                i += 2
            elif c == "n":
                result.append("\n")
                i += 2
            elif c == "r":
                result.append("\r")
                i += 2
            elif c == "t":
                result.append("\t")
                i += 2
            elif c == "v":
                result.append("\v")
                i += 2
            elif c == "\\":
                result.append("\\")
                i += 2
            elif c == "'":
                result.append("'")
                i += 2
            elif c == '"':
                result.append('"')
                i += 2
            elif c == "x":
                # Hex escape: \xHH (1-2 hex digits)
                j = i + 2
                while j < len(s) and j < i + 4 and s[j] in "0123456789abcdefABCDEF":
                    j += 1
                if j > i + 2:
                    val = int(s[i + 2 : j], 16)
                    if val == 0:
                        pass  # NUL bytes are stripped
                    else:
                        result.append(chr(val))
                else:
                    result.append("\\x")
                i = j
            elif c == "u":
                # Unicode escape: \uNNNN (1-4 hex digits)
                j = i + 2
                while j < len(s) and j < i + 6 and s[j] in "0123456789abcdefABCDEF":
                    j += 1
                if j > i + 2:
                    val = int(s[i + 2 : j], 16)
                    if val == 0:
                        pass  # NUL bytes are stripped
                    else:
                        result.append(chr(val))
                else:
                    result.append("\\u")
                i = j
            elif c == "U":
                # Unicode escape: \UNNNNNNNN (1-8 hex digits)
                j = i + 2
                while j < len(s) and j < i + 10 and s[j] in "0123456789abcdefABCDEF":
                    j += 1
                if j > i + 2:
                    val = int(s[i + 2 : j], 16)
                    if val == 0:
                        pass  # NUL bytes are stripped
                    else:
                        result.append(chr(val))
                else:
                    result.append("\\U")
                i = j
            elif c == "0":
                # Octal escape: \0NNN (0-3 octal digits after the 0)
                j = i + 2
                while j < len(s) and j < i + 5 and s[j] in "01234567":
                    j += 1
                val = int(s[i + 1 : j], 8) if j > i + 1 else 0
                if val == 0:
                    pass  # NUL bytes are stripped
                else:
                    result.append(chr(val))
                i = j
            elif c in "1234567":
                # Octal escape: \NNN (1-3 octal digits)
                j = i + 1
                while j < len(s) and j < i + 4 and s[j] in "01234567":
                    j += 1
                val = int(s[i + 1 : j], 8)
                if val == 0:
                    pass  # NUL bytes are stripped
                else:
                    result.append(chr(val))
                i = j
            elif c == "c":
                # Control character escape: \cX produces chr(ord(X) & 0x1F)
                # Special case: \c? produces DEL (0x7F)
                if i + 2 < len(s):
                    ctrl_char = s[i + 2]
                    if ctrl_char == "?":
                        result.append("\x7f")
                    else:
                        val = ord(ctrl_char) & 0x1F
                        if val == 0:
                            pass  # NUL bytes are stripped
                        else:
                            result.append(chr(val))
                    i += 3
                else:
                    # \c at end of string - treat as literal
                    result.append("\\c")
                    i += 2
            else:
                # Unknown escape: keep backslash + char
                result.append("\\")
                result.append(c)
                i += 2
        else:
            result.append(s[i])
            i += 1
    return "".join(result)


def _find_patsub_separator(text: str, pat_start: int, allow_empty: bool = False) -> int:
    """Find the unquoted, unescaped '/' separator between pattern and replacement.

    `pat_start` is the index where the pattern begins (after the operator).
    Scans the pattern handling backslash escapes and single/double quotes,
    looking for the first unquoted '/' that is past the first pattern character.
    If `allow_empty` is True, a '/' at pat_start is treated as a separator (empty pattern).
    Returns the index of the separator or -1 if not found.
    """
    i = pat_start
    # The first character of the pattern (which may be /) is never the separator
    # unless allow_empty is True (for /#, /% anchored patterns)
    found_pattern_char = allow_empty
    while i < len(text):
        c = text[i]
        if c == '\\' and i + 1 < len(text):
            i += 2  # Skip escaped char
            found_pattern_char = True
            continue
        if c == "'":
            # Find closing single quote
            j = text.find("'", i + 1)
            if j == -1:
                return -1  # Unterminated
            i = j + 1
            found_pattern_char = True
            continue
        if c == '"':
            # Find closing double quote (handling escapes)
            j = i + 1
            while j < len(text):
                if text[j] == '\\' and j + 1 < len(text):
                    j += 2
                elif text[j] == '"':
                    break
                else:
                    j += 1
            i = j + 1
            found_pattern_char = True
            continue
        if c == '/' and found_pattern_char:
            return i
        found_pattern_char = True
        i += 1
    return -1


class Parser:
    """Parser class - transforms tokens into AST."""

    def __init__(self) -> None:
        self.tokens: list[Token] = []
        self.pos = 0
        self.pending_heredocs: list[dict] = []
        self.parse_iterations = 0
        self._consumed_heredoc_positions: set[int] = set()

    def _check_iteration_limit(self) -> None:
        """Check parse iteration limit to prevent infinite loops."""
        self.parse_iterations += 1
        if self.parse_iterations > MAX_PARSE_ITERATIONS:
            raise ParseException(
                "Maximum parse iterations exceeded (possible infinite loop)",
                self._current().line,
                self._current().column,
            )

    def parse(self, input_text: str) -> ScriptNode:
        """Parse a bash script string."""
        # Check input size limit
        if len(input_text) > MAX_INPUT_SIZE:
            raise ParseException(
                f"Input too large: {len(input_text)} bytes exceeds limit of {MAX_INPUT_SIZE}",
                1,
                1,
            )

        lexer = Lexer(input_text)
        self.tokens = lexer.tokenize()

        # Check token count limit
        if len(self.tokens) > MAX_TOKENS:
            raise ParseException(
                f"Too many tokens: {len(self.tokens)} exceeds limit of {MAX_TOKENS}",
                1,
                1,
            )

        self.pos = 0
        self.pending_heredocs = []
        self.parse_iterations = 0
        self._consumed_heredoc_positions = set()
        return self._parse_script()

    def parse_tokens(self, tokens: list[Token]) -> ScriptNode:
        """Parse from pre-tokenized input."""
        self.tokens = tokens
        self.pos = 0
        self.pending_heredocs = []
        self.parse_iterations = 0
        self._consumed_heredoc_positions = set()
        return self._parse_script()

    # =========================================================================
    # Helper methods
    # =========================================================================

    def _current(self) -> Token:
        """Get current token."""
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return self.tokens[-1]

    def _peek(self, offset: int = 0) -> Token:
        """Peek at token at offset from current position."""
        idx = self.pos + offset
        if idx < len(self.tokens):
            return self.tokens[idx]
        return self.tokens[-1]

    def _advance(self) -> Token:
        """Advance to next token and return current."""
        token = self._current()
        if self.pos < len(self.tokens) - 1:
            self.pos += 1
        return token

    def _check(self, *types: TokenType) -> bool:
        """Check if current token matches any of the given types."""
        current_type = self._current().type
        return current_type in types

    def _expect(self, type_: TokenType, message: Optional[str] = None) -> Token:
        """Expect current token to be of given type, advance if so."""
        if self._check(type_):
            return self._advance()
        token = self._current()
        msg = message or f"Expected {type_.name}, got {token.type.name}"
        raise ParseException(msg, token.line, token.column, token)

    def _error(self, message: str) -> ParseException:
        """Create a parse error at current position."""
        token = self._current()
        return ParseException(message, token.line, token.column, token)

    def _skip_newlines(self) -> None:
        """Skip newlines, comments, and consumed heredoc content."""
        while True:
            if self._check(TokenType.NEWLINE):
                self._advance()
                self._process_heredocs()
                continue
            if self._check(TokenType.COMMENT):
                self._advance()
                continue
            # Skip heredoc content tokens already consumed by scan-ahead resolution
            if (self._check(TokenType.HEREDOC_CONTENT)
                    and self.pos in self._consumed_heredoc_positions):
                self._advance()
                continue
            break

    def _skip_separators(self) -> None:
        """Skip statement separators (newlines, semicolons, comments)."""
        while True:
            if self._check(TokenType.NEWLINE):
                self._advance()
                self._process_heredocs()
                continue
            if self._check(TokenType.SEMICOLON, TokenType.COMMENT):
                self._advance()
                continue
            # Skip heredoc content tokens already consumed by scan-ahead resolution
            if (self._check(TokenType.HEREDOC_CONTENT)
                    and self.pos in self._consumed_heredoc_positions):
                self._advance()
                continue
            break

    def _is_statement_end(self) -> bool:
        """Check if we're at a statement boundary."""
        return self._check(
            TokenType.EOF,
            TokenType.NEWLINE,
            TokenType.SEMICOLON,
            TokenType.AMP,
            TokenType.AND_AND,
            TokenType.OR_OR,
            TokenType.RPAREN,
            TokenType.RBRACE,
            TokenType.DSEMI,
            TokenType.SEMI_AND,
            TokenType.SEMI_SEMI_AND,
        )

    def _is_command_start(self) -> bool:
        """Check if current token can start a command."""
        t = self._current().type
        return t in (
            TokenType.WORD,
            TokenType.NAME,
            TokenType.NUMBER,
            TokenType.ASSIGNMENT_WORD,
            TokenType.IF,
            TokenType.FOR,
            TokenType.WHILE,
            TokenType.UNTIL,
            TokenType.CASE,
            TokenType.LPAREN,
            TokenType.LBRACE,
            TokenType.DPAREN_START,
            TokenType.DBRACK_START,
            TokenType.FUNCTION,
            TokenType.BANG,
            TokenType.IN,
            # Redirections can appear before command name
            TokenType.LESS,
            TokenType.GREAT,
            TokenType.DLESS,
            TokenType.DGREAT,
            TokenType.LESSAND,
            TokenType.GREATAND,
            TokenType.LESSGREAT,
            TokenType.DLESSDASH,
            TokenType.CLOBBER,
            TokenType.TLESS,
            TokenType.AND_GREAT,
            TokenType.AND_DGREAT,
        )

    def _process_heredocs(self) -> None:
        """Process pending here-documents (old method, no longer used directly)."""
        for heredoc in self.pending_heredocs:
            if self._check(TokenType.HEREDOC_CONTENT):
                content_token = self._advance()
                # If delimiter was quoted, treat content as literal (no expansion)
                content_word = self._parse_word_from_string(
                    content_token.value,
                    quoted=False,
                    single_quoted=heredoc["quoted"]
                )
                heredoc["redirect_target"] = AST.here_doc(
                    heredoc["delimiter"],
                    content_word,
                    heredoc["strip_tabs"],
                    heredoc["quoted"],
                )
        self.pending_heredocs = []

    def _resolve_pending_heredocs(
        self, redirections: list[RedirectionNode]
    ) -> list[RedirectionNode]:
        """Resolve pending heredocs by reading their content and updating redirections.

        Scans ahead in the token stream without moving the parser position,
        so this works even when called before the full pipeline is parsed
        (e.g., for 'cat << EOF | grep hello').
        """
        if not self.pending_heredocs:
            return redirections

        # Scan ahead to find HEREDOC_CONTENT tokens without moving self.pos
        # They may be past pipes, semicolons, etc. on the same line
        # Skip positions already consumed by earlier resolutions
        content_tokens = []
        content_positions = []
        scan_pos = self.pos
        while scan_pos < len(self.tokens) and len(content_tokens) < len(self.pending_heredocs):
            if (self.tokens[scan_pos].type == TokenType.HEREDOC_CONTENT
                    and scan_pos not in self._consumed_heredoc_positions):
                content_tokens.append(self.tokens[scan_pos])
                content_positions.append(scan_pos)
            scan_pos += 1

        # Mark these positions as consumed
        self._consumed_heredoc_positions.update(content_positions)

        # Process each pending heredoc
        new_redirections = list(redirections)
        for idx, heredoc_info in enumerate(self.pending_heredocs):
            if idx < len(content_tokens):
                content_token = content_tokens[idx]
                # If delimiter was quoted, treat content as literal (no expansion)
                content_word = self._parse_word_from_string(
                    content_token.value,
                    quoted=False,
                    single_quoted=heredoc_info["quoted"],
                    in_heredoc=not heredoc_info["quoted"],
                )
                heredoc_node = AST.here_doc(
                    heredoc_info["delimiter"],
                    content_word,
                    heredoc_info["strip_tabs"],
                    heredoc_info["quoted"],
                )
                # Find the corresponding placeholder redirection and replace it
                for i, redir in enumerate(new_redirections):
                    if redir.operator in ("<<", "<<-"):
                        # Check if this looks like our placeholder
                        if (redir.target and redir.target.parts and
                            len(redir.target.parts) == 1 and
                            hasattr(redir.target.parts[0], 'value') and
                            redir.target.parts[0].value == ""):
                            new_redirections[i] = AST.redirection(
                                redir.operator, heredoc_node, redir.fd
                            )
                            break

        self.pending_heredocs = []
        return new_redirections

    # =========================================================================
    # Main parsing methods
    # =========================================================================

    def _parse_script(self) -> ScriptNode:
        """Parse a complete script."""
        statements: list[StatementNode] = []
        self._skip_newlines()

        while not self._check(TokenType.EOF):
            self._check_iteration_limit()

            # Skip heredoc content tokens already consumed by scan-ahead resolution
            if (self._check(TokenType.HEREDOC_CONTENT)
                    and self.pos in self._consumed_heredoc_positions):
                self._advance()
                continue

            stmt = self._parse_statement()
            if stmt:
                statements.append(stmt)
            self._skip_separators()

        return AST.script(statements)

    def _parse_statement(self) -> Optional[StatementNode]:
        """Parse a statement (pipeline list with && / || operators)."""
        if not self._is_command_start():
            return None

        pipelines: list[PipelineNode] = []
        operators: list[str] = []

        # Parse first pipeline
        pipeline = self._parse_pipeline()
        if not pipeline:
            return None
        pipelines.append(pipeline)

        # Parse additional pipelines with operators
        while self._check(TokenType.AND_AND, TokenType.OR_OR):
            self._check_iteration_limit()
            op_token = self._advance()
            operators.append(op_token.value)
            self._skip_newlines()

            next_pipeline = self._parse_pipeline()
            if not next_pipeline:
                raise self._error("Expected command after operator")
            pipelines.append(next_pipeline)

        # Check for background execution
        background = False
        if self._check(TokenType.AMP):
            self._advance()
            background = True

        return AST.statement(pipelines, operators, background)

    def _parse_pipeline(self) -> Optional[PipelineNode]:
        """Parse a pipeline (commands connected by |)."""
        # Check for negation
        negated = False
        if self._check(TokenType.BANG):
            self._advance()
            negated = True
            self._skip_newlines()

        # Parse first command
        command = self._parse_command()
        if not command:
            if negated:
                raise self._error("Expected command after !")
            return None

        commands: list[CommandNode] = [command]
        pipe_amp_list: list[bool] = []

        # Parse additional commands with pipe
        while self._check(TokenType.PIPE, TokenType.PIPE_AMP):
            self._check_iteration_limit()
            is_pipe_amp = self._check(TokenType.PIPE_AMP)
            pipe_amp_list.append(is_pipe_amp)
            self._advance()
            self._skip_newlines()

            next_command = self._parse_command()
            if not next_command:
                raise self._error("Expected command after pipe")
            commands.append(next_command)

        return AST.pipeline(commands, negated, pipe_amp=tuple(pipe_amp_list))

    def _parse_command(self) -> Optional[CommandNode]:
        """Parse a command (simple, compound, or function definition)."""
        # Check for compound commands
        if self._check(TokenType.IF):
            return self._parse_if()
        if self._check(TokenType.FOR):
            return self._parse_for()
        if self._check(TokenType.WHILE):
            return self._parse_while()
        if self._check(TokenType.UNTIL):
            return self._parse_until()
        if self._check(TokenType.CASE):
            return self._parse_case()
        if self._check(TokenType.LPAREN):
            return self._parse_subshell()
        if self._check(TokenType.LBRACE):
            return self._parse_group()
        if self._check(TokenType.DBRACK_START):
            return self._parse_conditional_command()
        if self._check(TokenType.DPAREN_START):
            return self._parse_arithmetic_command()
        if self._check(TokenType.FUNCTION):
            return self._parse_function_def()

        # Check for function definition: name() { ... }
        if self._check(TokenType.NAME, TokenType.WORD):
            if self._peek(1).type == TokenType.LPAREN:
                return self._parse_function_def()

        # Default to simple command
        return self._parse_simple_command()

    def _parse_simple_command(self) -> Optional[SimpleCommandNode]:
        """Parse a simple command with assignments, name, args, redirections."""
        assignments: list[AssignmentNode] = []
        name: Optional[WordNode] = None
        args: list[WordNode] = []
        redirections: list[RedirectionNode] = []
        start_line = self._current().line

        # Parse leading redirections and assignments
        while True:
            self._check_iteration_limit()

            # Check for assignment (including array assignment VAR=(...))
            if self._check(TokenType.ASSIGNMENT_WORD):
                assign_tok = self._current()
                # Check if next token is LPAREN for array assignment
                # Must be immediately adjacent (no space between = and ()
                next_tok = self._peek(1)
                if next_tok.type == TokenType.LPAREN and assign_tok.end == next_tok.start:
                    assignments.append(self._parse_array_assignment())
                else:
                    assignments.append(self._parse_assignment())
                continue

            # Check for redirection before command name
            redir = self._try_parse_redirection()
            if redir:
                redirections.append(redir)
                continue

            break

        # Parse command name
        if self._check(
            TokenType.WORD, TokenType.NAME, TokenType.NUMBER, TokenType.IN
        ):
            name = self._parse_word()

        # Parse arguments and trailing redirections
        while not self._is_statement_end():
            self._check_iteration_limit()

            # Check for redirection
            redir = self._try_parse_redirection()
            if redir:
                redirections.append(redir)
                continue

            # Check for array assignment: VAR=(...) - combine into single argument
            # This handles cases like: declare -a arr=(a b c)
            if self._check(TokenType.ASSIGNMENT_WORD):
                assign_tok = self._current()
                if self._peek(1).type == TokenType.LPAREN:
                    # Collect the entire array assignment
                    array_str = assign_tok.value
                    self._advance()  # consume ASSIGNMENT_WORD
                    self._advance()  # consume LPAREN
                    array_str += "("

                    # Collect elements until RPAREN
                    first = True
                    while not self._check(TokenType.RPAREN, TokenType.EOF):
                        if not first:
                            array_str += " "
                        first = False
                        elem_tok = self._current()
                        # Preserve quotes to maintain element boundaries
                        if elem_tok.quoted:
                            if elem_tok.single_quoted:
                                array_str += "'" + elem_tok.value + "'"
                            else:
                                array_str += '"' + elem_tok.value + '"'
                        else:
                            array_str += elem_tok.value
                        self._advance()

                    if self._check(TokenType.RPAREN):
                        self._advance()
                        array_str += ")"

                    # Create word node with the full array assignment
                    args.append(AST.word([LiteralPart(value=array_str)]))
                    continue

            # Check for word argument - include reserved words that can be arguments
            # Reserved words are only special at command position, not as arguments
            # ASSIGNMENT_WORD is also valid as argument to builtins like declare, export, local
            if self._check(
                TokenType.WORD,
                TokenType.NAME,
                TokenType.NUMBER,
                TokenType.ASSIGNMENT_WORD,  # For declare, export, local, etc.
                # Reserved words that can appear as arguments:
                TokenType.IN,
                TokenType.DO,
                TokenType.DONE,
                TokenType.IF,
                TokenType.THEN,
                TokenType.ELSE,
                TokenType.ELIF,
                TokenType.FI,
                TokenType.FOR,
                TokenType.WHILE,
                TokenType.UNTIL,
                TokenType.CASE,
                TokenType.ESAC,
                TokenType.FUNCTION,
                # Keywords that are only special at command start position:
                TokenType.BANG,
                TokenType.LBRACE,
                TokenType.TIME,
            ):
                args.append(self._parse_word())
                continue

            # Check for process substitution <(...) or >(...)
            if (self._check(TokenType.LESS) or self._check(TokenType.GREAT)) and self._peek(1).type == TokenType.LPAREN:
                direction = "input" if self._current().type == TokenType.LESS else "output"
                self._advance()  # consume < or >
                self._advance()  # consume (
                self._skip_newlines()
                body_stmts = self._parse_compound_list()
                self._skip_newlines()
                self._expect(TokenType.RPAREN, "Expected ')' to close process substitution")
                body = AST.script(body_stmts)
                word = AST.word([ProcessSubstitutionPart(body=body, direction=direction)])
                args.append(word)
                continue

            break

        # Must have at least an assignment or a command name
        if not assignments and name is None and not redirections:
            return None

        # If we have pending heredocs, we need to resolve them before creating the command
        if self.pending_heredocs:
            redirections = self._resolve_pending_heredocs(redirections)

        return AST.simple_command(name, args, assignments, redirections, line=start_line)

    def _parse_assignment(self) -> AssignmentNode:
        """Parse a variable assignment."""
        token = self._expect(TokenType.ASSIGNMENT_WORD)
        value = token.value

        # Find the = sign
        eq_idx = value.find("=")
        if eq_idx == -1:
            raise self._error(f"Invalid assignment: {value}")

        # Check for +=
        append = False
        if eq_idx > 0 and value[eq_idx - 1] == "+":
            name = value[: eq_idx - 1]
            append = True
        else:
            name = value[:eq_idx]

        # Get value part
        value_str = value[eq_idx + 1 :]

        # Check for array assignment: VAR=(a b c)
        if value_str.startswith("("):
            # TODO: Parse array assignment
            # For now, treat as simple value
            value_word = self._parse_word_from_string(value_str, quoted=False, in_assignment=True)
            return AST.assignment(name, value_word, append)

        # Simple value
        if value_str:
            value_word = self._parse_word_from_string(value_str, quoted=False, in_assignment=True)
        else:
            value_word = None

        return AST.assignment(name, value_word, append)

    def _parse_array_assignment(self) -> AssignmentNode:
        """Parse an array assignment: VAR=(elem1 elem2 ...)."""
        token = self._expect(TokenType.ASSIGNMENT_WORD)
        value = token.value

        # Find the = sign
        eq_idx = value.find("=")
        if eq_idx == -1:
            raise self._error(f"Invalid assignment: {value}")

        # Check for +=
        append = False
        if eq_idx > 0 and value[eq_idx - 1] == "+":
            name = value[: eq_idx - 1]
            append = True
        else:
            name = value[:eq_idx]

        # Expect LPAREN
        self._expect(TokenType.LPAREN)

        # Collect array elements until RPAREN
        elements: list[WordNode] = []
        while not self._check(TokenType.RPAREN, TokenType.EOF):
            if self._check(TokenType.WORD, TokenType.NAME, TokenType.NUMBER,
                          TokenType.ASSIGNMENT_WORD):
                elements.append(self._parse_word())
            else:
                # Skip unexpected tokens
                self._advance()

        # Expect RPAREN
        if self._check(TokenType.RPAREN):
            self._advance()

        return AST.assignment(name, None, append, array=elements)

    def _try_parse_redirection(self) -> Optional[RedirectionNode]:
        """Try to parse a redirection, return None if not a redirection."""
        # Check for file descriptor number prefix
        # Only treat NUMBER as fd if it's immediately adjacent to the redirect operator
        # (no whitespace between them). E.g., "3>file" but not "3 >file"
        fd: Optional[int] = None
        if self._check(TokenType.NUMBER):
            num_token = self._current()
            next_token = self._peek(1)
            if next_token.type in (
                TokenType.LESS,
                TokenType.GREAT,
                TokenType.DGREAT,
                TokenType.LESSAND,
                TokenType.GREATAND,
                TokenType.LESSGREAT,
                TokenType.CLOBBER,
                TokenType.DLESS,
                TokenType.DLESSDASH,
                TokenType.TLESS,
            ):
                # Check if immediately adjacent (no whitespace)
                # Number ends at column + len(value), redirect should start there
                num_end_col = num_token.column + len(num_token.value)
                if next_token.column == num_end_col:
                    fd = int(self._advance().value)

        # Process substitution <(...) or >(...) is NOT a redirection — bail out
        if self._check(TokenType.LESS) and self._peek(1).type == TokenType.LPAREN:
            return None
        if self._check(TokenType.GREAT) and self._peek(1).type == TokenType.LPAREN:
            return None

        # Check for redirection operator
        op_map: dict[TokenType, RedirectionOperator] = {
            TokenType.LESS: "<",
            TokenType.GREAT: ">",
            TokenType.DGREAT: ">>",
            TokenType.LESSAND: "<&",
            TokenType.GREATAND: ">&",
            TokenType.LESSGREAT: "<>",
            TokenType.CLOBBER: ">|",
            TokenType.TLESS: "<<<",
            TokenType.DLESS: "<<",
            TokenType.DLESSDASH: "<<-",
            TokenType.AND_GREAT: "&>",
            TokenType.AND_DGREAT: "&>>",
        }

        for token_type, op in op_map.items():
            if self._check(token_type):
                self._advance()

                # Handle here-document
                if op in ("<<", "<<-"):
                    return self._parse_heredoc_start(op, fd)

                # Parse target
                if not self._check(TokenType.WORD, TokenType.NAME, TokenType.NUMBER):
                    raise self._error(f"Expected target for redirection {op}")

                target = self._parse_word()
                return AST.redirection(op, target, fd)

        return None

    def _parse_heredoc_start(
        self, op: RedirectionOperator, fd: Optional[int]
    ) -> RedirectionNode:
        """Parse the start of a here-document."""
        strip_tabs = op == "<<-"

        # Get delimiter
        if not self._check(TokenType.WORD, TokenType.NAME):
            raise self._error("Expected here-document delimiter")

        delim_token = self._advance()
        delimiter = delim_token.value
        quoted = delim_token.quoted or delim_token.single_quoted

        # Strip quotes from delimiter if present
        if delimiter.startswith("'") and delimiter.endswith("'"):
            delimiter = delimiter[1:-1]
            quoted = True
        elif delimiter.startswith('"') and delimiter.endswith('"'):
            delimiter = delimiter[1:-1]
            quoted = True

        # Check for embedded quotes (e.g., E'O'F or E"O"F)
        if not quoted and ("'" in delimiter or '"' in delimiter):
            delimiter = delimiter.replace("'", "").replace('"', "")
            quoted = True

        # Check for backslash-escaped delimiter (e.g., \EOF)
        # The lexer removes backslashes, so the token span is longer than the value
        if not quoted and (delim_token.end - delim_token.start) > len(delimiter):
            quoted = True

        # Create placeholder target (will be filled when heredoc content is read)
        placeholder = AST.word([AST.literal("")])

        # Register pending heredoc
        heredoc_info = {
            "delimiter": delimiter,
            "strip_tabs": strip_tabs,
            "quoted": quoted,
            "redirect_target": None,
        }
        self.pending_heredocs.append(heredoc_info)

        return AST.redirection(op, placeholder, fd)

    # =========================================================================
    # Compound command parsing
    # =========================================================================

    def _parse_compound_list(self) -> list[StatementNode]:
        """Parse a compound list (body of if/for/while/etc.)."""
        statements: list[StatementNode] = []
        self._skip_newlines()

        while not self._check(
            TokenType.EOF,
            TokenType.THEN,
            TokenType.ELSE,
            TokenType.ELIF,
            TokenType.FI,
            TokenType.DO,
            TokenType.DONE,
            TokenType.ESAC,
            TokenType.RBRACE,
            TokenType.RPAREN,
        ):
            self._check_iteration_limit()
            if not self._is_command_start():
                break
            stmt = self._parse_statement()
            if stmt:
                statements.append(stmt)
            self._skip_separators()

        return statements

    def _parse_if(self) -> IfNode:
        """Parse an if statement."""
        self._expect(TokenType.IF)
        self._skip_newlines()

        clauses: list[IfClause] = []

        # Parse condition
        condition = self._parse_compound_list()
        if not condition:
            raise self._error("Expected condition after 'if'")

        self._skip_newlines()
        self._expect(TokenType.THEN, "Expected 'then' after condition")
        self._skip_newlines()

        # Parse body
        body = self._parse_compound_list()

        clauses.append(AST.if_clause(condition, body))

        # Parse elif clauses
        while self._check(TokenType.ELIF):
            self._advance()
            self._skip_newlines()

            elif_condition = self._parse_compound_list()
            if not elif_condition:
                raise self._error("Expected condition after 'elif'")

            self._skip_newlines()
            self._expect(TokenType.THEN, "Expected 'then' after condition")
            self._skip_newlines()

            elif_body = self._parse_compound_list()
            clauses.append(AST.if_clause(elif_condition, elif_body))

        # Parse else clause
        else_body: Optional[list[StatementNode]] = None
        if self._check(TokenType.ELSE):
            self._advance()
            self._skip_newlines()
            else_body = self._parse_compound_list()

        self._skip_newlines()
        self._expect(TokenType.FI, "Expected 'fi' to close if statement")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        return AST.if_node(clauses, else_body, redirections)

    def _parse_for(self) -> "ForNode | CStyleForNode":
        """Parse a for loop (standard or C-style)."""
        self._expect(TokenType.FOR)
        self._skip_newlines()

        # Check for C-style for: for (( ... ))
        if self._check(TokenType.DPAREN_START):
            return self._parse_c_style_for()

        # Get variable name (bash allows 'in' and other keywords as variable names here)
        if not self._check(TokenType.NAME, TokenType.WORD, TokenType.IN):
            raise self._error("Expected variable name after 'for'")
        variable = self._advance().value

        self._skip_newlines()

        # Parse optional 'in word...'
        words: Optional[list[WordNode]] = None
        if self._check(TokenType.IN):
            self._advance()
            words = []
            while not self._check(
                TokenType.SEMICOLON,
                TokenType.NEWLINE,
                TokenType.DO,
                TokenType.EOF,
            ):
                self._check_iteration_limit()
                if self._check(TokenType.WORD, TokenType.NAME, TokenType.NUMBER):
                    words.append(self._parse_word())
                else:
                    break

        # Skip to 'do'
        self._skip_separators()
        self._expect(TokenType.DO, "Expected 'do' in for loop")
        self._skip_newlines()

        # Parse body
        body = self._parse_compound_list()

        self._skip_newlines()
        self._expect(TokenType.DONE, "Expected 'done' to close for loop")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        # Resolve pending heredocs for for loop redirections
        if self.pending_heredocs:
            redirections = self._resolve_pending_heredocs(redirections)

        return AST.for_node(variable, words, body, redirections)

    def _parse_c_style_for(self) -> CStyleForNode:
        """Parse a C-style for loop: for (( init; cond; update )); do body; done."""
        line = self._current().line
        self._expect(TokenType.DPAREN_START)

        # Collect everything between (( and )) as raw text
        expr_text = ""
        depth = 1
        paren_depth = 0  # Track regular parenthesis nesting

        while depth > 0 and not self._check(TokenType.EOF):
            if self._check(TokenType.DPAREN_START):
                if paren_depth > 0:
                    # Inside regular parens, (( is just two open parens
                    paren_depth += 2
                    expr_text += "(("
                else:
                    depth += 1
                    expr_text += "(("
                self._advance()
            elif self._check(TokenType.DPAREN_END):
                if paren_depth >= 2:
                    # Both ) close regular parens
                    paren_depth -= 2
                    expr_text += "))"
                    self._advance()
                elif paren_depth == 1:
                    # First ) closes regular paren, second is for-loop terminator
                    paren_depth = 0
                    expr_text += ")"
                    depth -= 1
                    if depth > 0:
                        expr_text += ")"
                    self._advance()
                else:
                    depth -= 1
                    if depth > 0:
                        expr_text += "))"
                    self._advance()
            elif self._check(TokenType.LPAREN):
                paren_depth += 1
                expr_text += "("
                self._advance()
            elif self._check(TokenType.RPAREN):
                if paren_depth > 0:
                    paren_depth -= 1
                expr_text += ")"
                self._advance()
            else:
                expr_text += self._current().value
                self._advance()

        # Split on semicolons to get init, condition, update
        parts = expr_text.split(";")
        init_text = parts[0].strip() if len(parts) > 0 else ""
        cond_text = parts[1].strip() if len(parts) > 1 else ""
        update_text = parts[2].strip() if len(parts) > 2 else ""

        # Parse each part as an arithmetic expression
        init_node = None
        cond_node = None
        update_node = None

        if init_text:
            try:
                init_node = ArithmeticExpressionNode(
                    expression=self._parse_arithmetic_expression(init_text)
                )
            except Exception:
                pass

        if cond_text:
            try:
                cond_node = ArithmeticExpressionNode(
                    expression=self._parse_arithmetic_expression(cond_text)
                )
            except Exception:
                pass

        if update_text:
            try:
                update_node = ArithmeticExpressionNode(
                    expression=self._parse_arithmetic_expression(update_text)
                )
            except Exception:
                pass

        # Skip to 'do'
        self._skip_separators()
        self._expect(TokenType.DO, "Expected 'do' in for loop")
        self._skip_newlines()

        # Parse body
        body = self._parse_compound_list()

        self._skip_newlines()
        self._expect(TokenType.DONE, "Expected 'done' to close for loop")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        return CStyleForNode(
            init=init_node,
            condition=cond_node,
            update=update_node,
            body=tuple(body),
            redirections=tuple(redirections),
            line=line,
        )

    def _parse_while(self) -> WhileNode:
        """Parse a while loop."""
        self._expect(TokenType.WHILE)
        self._skip_newlines()

        # Parse condition
        condition = self._parse_compound_list()
        if not condition:
            raise self._error("Expected condition after 'while'")

        self._skip_newlines()
        self._expect(TokenType.DO, "Expected 'do' after condition")
        self._skip_newlines()

        # Parse body
        body = self._parse_compound_list()

        self._skip_newlines()
        self._expect(TokenType.DONE, "Expected 'done' to close while loop")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        # Resolve pending heredocs for while loop redirections
        if self.pending_heredocs:
            redirections = self._resolve_pending_heredocs(redirections)

        return AST.while_node(condition, body, redirections)

    def _parse_until(self) -> UntilNode:
        """Parse an until loop."""
        self._expect(TokenType.UNTIL)
        self._skip_newlines()

        # Parse condition
        condition = self._parse_compound_list()
        if not condition:
            raise self._error("Expected condition after 'until'")

        self._skip_newlines()
        self._expect(TokenType.DO, "Expected 'do' after condition")
        self._skip_newlines()

        # Parse body
        body = self._parse_compound_list()

        self._skip_newlines()
        self._expect(TokenType.DONE, "Expected 'done' to close until loop")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        # Resolve pending heredocs for until loop redirections
        if self.pending_heredocs:
            redirections = self._resolve_pending_heredocs(redirections)

        return AST.until_node(condition, body, redirections)

    def _parse_case(self) -> CaseNode:
        """Parse a case statement."""
        self._expect(TokenType.CASE)
        self._skip_newlines()

        # Parse word to match
        if not self._check(TokenType.WORD, TokenType.NAME, TokenType.NUMBER):
            raise self._error("Expected word after 'case'")
        word = self._parse_word()

        self._skip_newlines()
        self._expect(TokenType.IN, "Expected 'in' after case word")
        self._skip_newlines()

        # Parse case items
        items: list[CaseItemNode] = []
        while not self._check(TokenType.ESAC, TokenType.EOF):
            self._check_iteration_limit()
            self._skip_newlines()

            if self._check(TokenType.ESAC):
                break

            # Skip optional leading (
            if self._check(TokenType.LPAREN):
                self._advance()

            # Parse patterns
            patterns: list[WordNode] = []
            while True:
                self._check_iteration_limit()
                if self._check(TokenType.WORD, TokenType.NAME, TokenType.NUMBER):
                    patterns.append(self._parse_word())
                elif not patterns:
                    raise self._error("Expected pattern in case item")
                else:
                    break

                # Check for pattern separator |
                if self._check(TokenType.PIPE):
                    self._advance()
                else:
                    break

            # Expect )
            self._expect(TokenType.RPAREN, "Expected ')' after patterns")
            self._skip_newlines()

            # Parse body
            item_body = self._parse_compound_list()

            # Parse terminator (;;, ;&, ;;&)
            terminator = ";;"
            if self._check(TokenType.DSEMI):
                self._advance()
            elif self._check(TokenType.SEMI_AND):
                self._advance()
                terminator = ";&"
            elif self._check(TokenType.SEMI_SEMI_AND):
                self._advance()
                terminator = ";;&"

            items.append(AST.case_item(patterns, item_body, terminator))
            self._skip_newlines()

        self._expect(TokenType.ESAC, "Expected 'esac' to close case statement")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        return AST.case_node(word, items, redirections)

    def _parse_subshell(self) -> SubshellNode:
        """Parse a subshell: ( ... )."""
        self._expect(TokenType.LPAREN)
        self._skip_newlines()

        # Parse body
        body = self._parse_compound_list()

        self._skip_newlines()
        # Handle )) being tokenized as DPAREN_END instead of two RPARENs
        if self._check(TokenType.DPAREN_END):
            tok = self._advance()
            # Insert a synthetic RPAREN token for the outer parser
            synthetic = Token(
                type=TokenType.RPAREN,
                value=")",
                start=tok.start + 1,
                end=tok.end,
                line=tok.line,
                column=tok.column + 1,
            )
            self.tokens.insert(self.pos, synthetic)
        else:
            self._expect(TokenType.RPAREN, "Expected ')' to close subshell")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        # Resolve pending heredocs for subshell redirections
        if self.pending_heredocs:
            redirections = self._resolve_pending_heredocs(redirections)

        return AST.subshell(body, redirections)

    def _parse_group(self) -> GroupNode:
        """Parse a command group: { ...; }."""
        self._expect(TokenType.LBRACE)
        self._skip_newlines()

        # Parse body
        body = self._parse_compound_list()

        self._skip_separators()
        self._expect(TokenType.RBRACE, "Expected '}' to close command group")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        # Resolve pending heredocs for group redirections
        if self.pending_heredocs:
            redirections = self._resolve_pending_heredocs(redirections)

        return AST.group(body, redirections)

    # Unary operators for conditional expressions
    _COND_UNARY_OPS = {
        "-a", "-b", "-c", "-d", "-e", "-f", "-g", "-h", "-k", "-p",
        "-r", "-s", "-t", "-u", "-w", "-x", "-G", "-L", "-N", "-O",
        "-S", "-z", "-n", "-o", "-v", "-R",
    }

    # Binary operators for conditional expressions
    _COND_BINARY_OPS = {
        "==", "!=", "=~", "<", ">", "=",
        "-eq", "-ne", "-lt", "-le", "-gt", "-ge",
        "-nt", "-ot", "-ef",
    }

    def _parse_conditional_command(self) -> ConditionalCommandNode:
        """Parse a conditional command: [[ expr ]]."""
        line = self._current().line
        self._expect(TokenType.DBRACK_START)
        self._skip_newlines()

        # Parse the conditional expression
        expr = self._parse_cond_or()

        self._skip_newlines()
        self._expect(TokenType.DBRACK_END, "Expected ']]' to close conditional")

        # Parse optional redirections
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        return ConditionalCommandNode(
            expression=expr,
            redirections=tuple(redirections),
            line=line,
        )

    def _parse_cond_or(self):
        """Parse conditional OR: expr || expr."""
        left = self._parse_cond_and()

        self._skip_newlines()
        while self._check(TokenType.OR_OR):
            self._advance()
            self._skip_newlines()
            right = self._parse_cond_and()
            left = CondOrNode(left=left, right=right)
            self._skip_newlines()

        return left

    def _parse_cond_and(self):
        """Parse conditional AND: expr && expr."""
        left = self._parse_cond_not()

        self._skip_newlines()
        while self._check(TokenType.AND_AND):
            self._advance()
            self._skip_newlines()
            right = self._parse_cond_not()
            left = CondAndNode(left=left, right=right)
            self._skip_newlines()

        return left

    def _parse_cond_not(self):
        """Parse conditional NOT: ! expr."""
        self._skip_newlines()
        if self._check(TokenType.BANG):
            self._advance()
            self._skip_newlines()
            operand = self._parse_cond_not()
            return CondNotNode(operand=operand)

        return self._parse_cond_primary()

    def _parse_cond_primary(self):
        """Parse conditional primary: unary/binary/grouping/word."""
        # Handle grouping: ( expr )
        if self._check(TokenType.LPAREN):
            self._advance()
            expr = self._parse_cond_or()
            self._expect(TokenType.RPAREN)
            return CondGroupNode(expression=expr)

        # Check for end of conditional
        if self._check(TokenType.DBRACK_END):
            raise self._error("Expected conditional expression")

        # Handle unary operators: -f file, -z string, etc.
        if self._check(TokenType.WORD, TokenType.NAME, TokenType.NUMBER):
            first_token = self._current()
            first = first_token.value

            # Check for unary operators (not quoted)
            if first_token.type in (TokenType.WORD, TokenType.NAME) and first in self._COND_UNARY_OPS:
                self._advance()
                # Unary operators require an operand
                if self._check(TokenType.DBRACK_END):
                    raise self._error(f"Expected operand after {first}")
                # Parse the operand - could be any word including quoted empty strings
                operand = self._parse_word()
                return CondUnaryNode(operator=first, operand=operand)

            # Parse as word, then check for binary operator
            left = self._parse_word()

            # Check for binary operators as words
            if self._check(TokenType.WORD, TokenType.NAME):
                op_token = self._current()
                if op_token.value in self._COND_BINARY_OPS:
                    self._advance()
                    # For =~ operator, parse RHS as regex pattern (includes parens)
                    if op_token.value == "=~":
                        right = self._parse_cond_regex_pattern()
                    else:
                        right = self._parse_word()
                    # Normalize = to ==
                    op = "==" if op_token.value == "=" else op_token.value
                    return CondBinaryNode(operator=op, left=left, right=right)

            # Check for < and > which are tokenized as LESS and GREAT
            if self._check(TokenType.LESS):
                self._advance()
                right = self._parse_word()
                return CondBinaryNode(operator="<", left=left, right=right)
            if self._check(TokenType.GREAT):
                self._advance()
                right = self._parse_word()
                return CondBinaryNode(operator=">", left=left, right=right)

            # Just a word (non-empty string test)
            return CondWordNode(word=left)

        raise self._error("Expected conditional expression")

    def _parse_cond_regex_pattern(self) -> Optional[WordNode]:
        """Parse a regex pattern for =~ operator.

        In bash, the RHS of =~ can include unquoted parentheses, pipes, etc.
        which are literal regex characters, not shell operators.
        """
        parts: list = []
        line = self._current().line

        # Collect tokens until we hit ]], &&, ||, or newline
        while not self._check(TokenType.EOF):
            tok = self._current()

            # Stop at conditional terminators
            if tok.type == TokenType.DBRACK_END:
                break
            if tok.type in (TokenType.AND_AND, TokenType.OR_OR, TokenType.NEWLINE):
                break

            # Handle parentheses as literal parts of the regex
            if tok.type == TokenType.LPAREN:
                parts.append(LiteralPart(value="("))
                self._advance()
                continue
            if tok.type == TokenType.RPAREN:
                parts.append(LiteralPart(value=")"))
                self._advance()
                continue

            # Handle pipe as literal
            if tok.type == TokenType.PIPE:
                parts.append(LiteralPart(value="|"))
                self._advance()
                continue

            # Handle other word-like tokens
            if tok.type in (TokenType.WORD, TokenType.NAME, TokenType.NUMBER,
                           TokenType.ASSIGNMENT_WORD):
                word = self._parse_word()
                if word and word.parts:
                    parts.extend(word.parts)
                continue

            # Unknown token, stop
            break

        if not parts:
            return None

        return WordNode(parts=tuple(parts), line=line)

    def _is_cond_word_token(self) -> bool:
        """Check if current token can be a word in conditional context."""
        return self._check(
            TokenType.WORD, TokenType.NAME, TokenType.NUMBER,
            TokenType.ASSIGNMENT_WORD,  # Might appear in conditionals
        )

    def _parse_arithmetic_command(self) -> ArithmeticCommandNode:
        """Parse an arithmetic command: (( expr ))."""
        line = self._current().line
        self._expect(TokenType.DPAREN_START)

        # Collect everything until ))
        expr_text = ""
        depth = 1  # We've consumed one ((

        while depth > 0 and not self._check(TokenType.EOF):
            if self._check(TokenType.DPAREN_START):
                depth += 1
                expr_text += "(("
                self._advance()
            elif self._check(TokenType.DPAREN_END):
                depth -= 1
                if depth > 0:
                    expr_text += "))"
                self._advance()
            elif self._check(TokenType.LPAREN):
                expr_text += "("
                self._advance()
            elif self._check(TokenType.RPAREN):
                expr_text += ")"
                self._advance()
            else:
                expr_text += self._current().value
                self._advance()

        # Parse the arithmetic expression
        expr_text = expr_text.strip()
        if expr_text:
            try:
                arith_expr = self._parse_arithmetic_expression(expr_text)
                expr_node = ArithmeticExpressionNode(expression=arith_expr)
            except Exception:
                # If parsing fails, create a simple expression
                expr_node = ArithmeticExpressionNode(expression=None)
        else:
            expr_node = None

        return ArithmeticCommandNode(
            expression=expr_node,
            line=line,
        )

    def _parse_function_def(self) -> FunctionDefNode:
        """Parse a function definition."""
        # Check for 'function' keyword
        has_function_keyword = False
        if self._check(TokenType.FUNCTION):
            self._advance()
            has_function_keyword = True
            self._skip_newlines()

        # Get function name
        if not self._check(TokenType.NAME, TokenType.WORD):
            raise self._error("Expected function name")
        name = self._advance().value

        # Optional () after name
        if self._check(TokenType.LPAREN):
            self._advance()
            self._expect(TokenType.RPAREN, "Expected ')' after '(' in function definition")

        self._skip_newlines()

        # Parse function body (must be a compound command)
        if self._check(TokenType.LBRACE):
            body = self._parse_group()
        elif self._check(TokenType.LPAREN):
            body = self._parse_subshell()
        elif self._check(TokenType.IF):
            body = self._parse_if()
        elif self._check(TokenType.FOR):
            body = self._parse_for()
        elif self._check(TokenType.WHILE):
            body = self._parse_while()
        elif self._check(TokenType.UNTIL):
            body = self._parse_until()
        elif self._check(TokenType.CASE):
            body = self._parse_case()
        else:
            raise self._error("Expected compound command as function body")

        # Parse optional redirections (after function body)
        redirections: list[RedirectionNode] = []
        while True:
            redir = self._try_parse_redirection()
            if not redir:
                break
            redirections.append(redir)

        return AST.function_def(name, body, redirections)

    def _parse_word(self) -> WordNode:
        """Parse a word token into a WordNode with parts."""
        token = self._advance()
        # Use segments for mixed-quoting words (e.g., "pre"{a,b}"suf")
        if token.segments:
            return self._parse_word_from_segments(token.segments)
        return self._parse_word_from_string(
            token.value,
            quoted=token.quoted,
            single_quoted=token.single_quoted,
        )

    def _parse_word_from_segments(self, segments: list[tuple[str, str]]) -> WordNode:
        """Parse a word from lexer segments with mixed quoting.

        Each segment is (text, mode) where mode is 'unquoted', 'double', or 'single'.
        """
        all_parts: list = []
        for text, mode in segments:
            if mode == "single":
                all_parts.append(SingleQuotedPart(value=text))
            elif mode == "double":
                inner_parts = self._parse_word_parts(text, quoted=True)
                all_parts.append(DoubleQuotedPart(parts=tuple(inner_parts)))
            else:  # unquoted
                inner_parts = self._parse_word_parts(text, quoted=False)
                all_parts.extend(inner_parts)
        return AST.word(all_parts)

    def _parse_word_from_string(self, value: str, quoted: bool = False, single_quoted: bool = False, in_assignment: bool = False, in_heredoc: bool = False, in_param_expansion: bool = False) -> WordNode:
        """Parse a string into a WordNode with appropriate parts.

        Parameters:
        - quoted: True if the content came from a double-quoted context
        - single_quoted: True if the content came from single quotes
        - in_param_expansion: True if parsing inside ${...} operation word
          (don't wrap in DoubleQuotedPart; inner quotes define structure)
        """
        if in_param_expansion:
            # For parameter expansion default values, parse allowing inner quotes
            # to be recognized, but suppress glob expansion.
            # When inside double quotes (quoted=True), single quotes are literal.
            parts = self._parse_word_parts(value, quoted=False, single_quoted=single_quoted, in_assignment=in_assignment, in_heredoc=in_heredoc, suppress_glob=quoted, literal_single_quotes=quoted, dquote_escape=quoted)
        else:
            # For regular tokens, parse with the quoted context
            parts = self._parse_word_parts(value, quoted=quoted, single_quoted=single_quoted, in_assignment=in_assignment, in_heredoc=in_heredoc)

        # Wrap single-quoted content in SingleQuotedPart
        if single_quoted:
            if len(parts) == 1 and isinstance(parts[0], LiteralPart):
                return AST.word([SingleQuotedPart(value=parts[0].value)])
            elif len(parts) == 0:
                return AST.word([SingleQuotedPart(value="")])

        # Wrap double-quoted content in DoubleQuotedPart (unless in param expansion)
        if quoted and not single_quoted and not in_param_expansion:
            return AST.word([DoubleQuotedPart(parts=tuple(parts))])

        return AST.word(parts)

    def _parse_word_parts(self, value: str, quoted: bool = False, single_quoted: bool = False, in_assignment: bool = False, in_heredoc: bool = False, suppress_glob: bool = False, literal_single_quotes: bool = False, dquote_escape: bool = False) -> list[WordPart]:
        """Parse word parts from a string value.

        Parameters:
        - literal_single_quotes: If True, treat single quotes as literal characters
          (not quote markers). Used when parsing inside double-quoted parameter expansion.
        - dquote_escape: If True, use double-quote backslash rules even when quoted=False.
          Backslash before non-special chars ($, `, \\, ", newline) preserves the backslash.
        """
        # Single-quoted strings are completely literal - no expansions
        if single_quoted:
            return [AST.literal(value)] if value else []

        parts: list[WordPart] = []
        i = 0
        literal_buffer = ""

        def flush_literal() -> None:
            nonlocal literal_buffer
            if literal_buffer:
                parts.append(AST.literal(literal_buffer))
                literal_buffer = ""

        while i < len(value):
            c = value[i]

            # Handle $((...)) arithmetic expansion - MUST come before $(...) check
            if c == "$" and i + 2 < len(value) and value[i + 1] == "(" and value[i + 2] == "(":
                flush_literal()
                # Find matching closing ))
                depth = 2  # We need to find ))
                start = i + 3
                j = start
                while j < len(value):
                    if value[j] == "(" and j + 1 < len(value) and value[j + 1] == "(":
                        depth += 2
                        j += 2
                    elif value[j] == ")" and j + 1 < len(value) and value[j + 1] == ")":
                        depth -= 2
                        j += 2
                        if depth <= 0:
                            break
                    elif value[j] == "(":
                        depth += 1
                        j += 1
                    elif value[j] == ")":
                        depth -= 1
                        j += 1
                    else:
                        j += 1
                arith_expr = value[start : j - 2]
                # Parse the arithmetic expression
                arith_node = self._parse_arithmetic_expression(arith_expr)
                parts.append(
                    ArithmeticExpansionPart(
                        expression=ArithmeticExpressionNode(expression=arith_node),
                    )
                )
                i = j
                continue

            # Handle $[...] legacy arithmetic expansion (equivalent to $((...)))
            if c == "$" and i + 1 < len(value) and value[i + 1] == "[":
                flush_literal()
                # Find matching closing ]
                depth = 1
                start = i + 2
                j = start
                while j < len(value) and depth > 0:
                    if value[j] == "[":
                        depth += 1
                    elif value[j] == "]":
                        depth -= 1
                    j += 1
                arith_expr = value[start : j - 1]
                arith_node = self._parse_arithmetic_expression(arith_expr)
                parts.append(
                    ArithmeticExpansionPart(
                        expression=ArithmeticExpressionNode(expression=arith_node),
                    )
                )
                i = j
                continue

            # Handle $(...) command substitution
            if c == "$" and i + 1 < len(value) and value[i + 1] == "(":
                flush_literal()
                # Find matching closing paren
                depth = 1
                start = i + 2
                j = start
                while j < len(value) and depth > 0:
                    if value[j] == "(":

                        depth += 1
                    elif value[j] == ")":
                        depth -= 1
                    j += 1
                cmd_body = value[start : j - 1]
                # Recursively parse the command body
                try:
                    parsed_body = Parser().parse(cmd_body)
                    parts.append(
                        CommandSubstitutionPart(
                            body=parsed_body,
                            legacy=False,
                        )
                    )
                except Exception:
                    # If parsing fails, treat as literal
                    parts.append(AST.literal(f"$({cmd_body})"))
                i = j
                continue

            # Handle ${...} parameter expansion
            if c == "$" and i + 1 < len(value) and value[i + 1] == "{":
                flush_literal()
                # Find matching closing brace
                depth = 1
                start = i + 2
                j = start
                while j < len(value) and depth > 0:
                    if value[j] == "{":
                        depth += 1
                    elif value[j] == "}":
                        depth -= 1
                    j += 1
                param_content = value[start : j - 1]
                # Parse the parameter expansion content
                parts.append(self._parse_parameter_expansion(param_content, in_double_quotes=quoted))
                i = j
                continue

            # Handle $'...' ANSI-C quoting
            if c == "$" and i + 1 < len(value) and value[i + 1] == "'" and not quoted:
                flush_literal()
                # Find closing single quote, respecting backslash escapes
                j = i + 2
                while j < len(value):
                    if value[j] == "\\" and j + 1 < len(value):
                        j += 2  # Skip escaped character
                    elif value[j] == "'":
                        break
                    else:
                        j += 1
                raw_content = value[i + 2 : j]
                decoded = _decode_ansi_c_escapes(raw_content)
                parts.append(SingleQuotedPart(value=decoded))
                i = j + 1 if j < len(value) else j
                continue

            # Handle simple $VAR expansion
            if c == "$" and i + 1 < len(value):
                next_c = value[i + 1]
                # Variable name (including names starting with _)
                # Check this first to handle $_var as the variable _var, not $_ + var
                if next_c.isalpha() or next_c == "_":
                    flush_literal()
                    j = i + 1
                    while j < len(value) and (value[j].isalnum() or value[j] == "_"):
                        j += 1
                    var_name = value[i + 1 : j]
                    parts.append(ParameterExpansionPart(parameter=var_name))
                    i = j
                    continue
                # Special parameters (only if not followed by alnum/_)
                if next_c in "?$#@*!-0123456789":
                    flush_literal()
                    parts.append(ParameterExpansionPart(parameter=next_c))
                    i += 2
                    continue

            # Handle backtick command substitution
            if c == "`":
                flush_literal()
                j = i + 1
                while j < len(value) and value[j] != "`":
                    if value[j] == "\\" and j + 1 < len(value):
                        j += 2
                    else:
                        j += 1
                cmd_raw = value[i + 1 : j]
                # Process backslash escapes in backtick substitution
                # Only \`, \\, and \$ are special inside backticks
                cmd = []
                k = 0
                while k < len(cmd_raw):
                    if cmd_raw[k] == "\\" and k + 1 < len(cmd_raw):
                        next_c = cmd_raw[k + 1]
                        if next_c in "`\\$":
                            cmd.append(next_c)
                            k += 2
                        else:
                            cmd.append(cmd_raw[k])
                            k += 1
                    else:
                        cmd.append(cmd_raw[k])
                        k += 1
                cmd_body = "".join(cmd)
                try:
                    parsed_body = Parser().parse(cmd_body)
                    parts.append(
                        CommandSubstitutionPart(
                            body=parsed_body,
                            legacy=True,  # Mark as backtick style
                        )
                    )
                except Exception:
                    # If parsing fails, treat as literal
                    parts.append(AST.literal(f"`{cmd_body}`"))
                i = j + 1
                continue

            # Handle single-quoted strings - completely literal, no expansions
            # Skip if literal_single_quotes is set (inside double-quoted param expansion)
            if c == "'" and not quoted and not in_heredoc and not literal_single_quotes:
                flush_literal()
                j = i + 1
                while j < len(value) and value[j] != "'":
                    j += 1
                content = value[i + 1 : j]
                parts.append(SingleQuotedPart(value=content))
                i = j + 1 if j < len(value) else j
                continue

            # Handle double-quoted strings - expansions occur but no word splitting
            # In heredoc context, quotes are literal characters
            if c == '"' and not quoted and not in_heredoc:
                flush_literal()
                j = i + 1
                # Find matching close quote, respecting escapes
                while j < len(value) and value[j] != '"':
                    if value[j] == "\\" and j + 1 < len(value):
                        j += 2
                    else:
                        j += 1
                content = value[i + 1 : j]
                # Recursively parse the content with quoted=True
                inner_parts = self._parse_word_parts(content, quoted=True)
                parts.append(DoubleQuotedPart(parts=tuple(inner_parts)))
                i = j + 1 if j < len(value) else j
                continue

            # Handle glob patterns (only if unquoted and not suppressed)
            if not quoted and not suppress_glob and c in "*?[":
                flush_literal()
                parts.append(GlobPart(pattern=c))
                i += 1
                continue

            # Handle tilde expansion at start or after : in assignments
            if c == "~" and not quoted and (i == 0 or (in_assignment and i > 0 and value[i - 1] == ":")):
                # Check for ~user, ~+, ~-
                j = i + 1
                if j < len(value) and value[j] in "+-":
                    # ~+ or ~- must be followed by / : or end
                    end_j = j + 1
                    if end_j >= len(value) or value[end_j] in "/:" or (in_assignment and value[end_j] == ":"):
                        flush_literal()
                        parts.append(TildeExpansionPart(user=value[j]))
                        i = end_j
                        continue
                else:
                    while j < len(value) and (value[j].isalnum() or value[j] == "_"):
                        j += 1
                    # Tilde is only valid if followed by / : or end of value
                    if j >= len(value) or value[j] == "/" or (in_assignment and value[j] == ":"):
                        flush_literal()
                        if j > i + 1:
                            user = value[i + 1:j]
                            parts.append(TildeExpansionPart(user=user))
                        else:
                            parts.append(TildeExpansionPart(user=None))
                        i = j
                        continue
                # Not a valid tilde expansion, fall through to literal

            # Handle escape sequences
            if c == "\\" and i + 1 < len(value):
                next_c = value[i + 1]
                if not quoted:
                    if dquote_escape and next_c not in '"\\$`\n':
                        # Inside double-quoted param expansion: backslash before
                        # non-special chars is literal (e.g. \z -> \z)
                        literal_buffer += c + next_c
                        i += 2
                        continue
                    # Outside quotes, backslash escapes any character
                    flush_literal()
                    parts.append(EscapedPart(value=next_c))
                    i += 2
                    continue
                elif next_c in "$`":
                    # Inside double quotes, lexer preserved \$ and \` as two chars;
                    # resolve them to EscapedPart so expansion produces just the char
                    flush_literal()
                    parts.append(EscapedPart(value=next_c))
                    i += 2
                    continue

            # Regular character
            literal_buffer += c
            i += 1

        flush_literal()
        return parts if parts else [AST.literal("")]

    def _parse_parameter_expansion(self, content: str, in_double_quotes: bool = False) -> ParameterExpansionPart:
        """Parse the content inside ${...} into a ParameterExpansionPart.

        Handles:
        - ${VAR} - simple expansion
        - ${VAR:-default} - use default if unset
        - ${VAR:=default} - assign default if unset
        - ${VAR:?error} - error if unset
        - ${VAR:+alt} - use alternative if set
        - ${#VAR} - string length
        - ${VAR:offset:length} - substring
        - ${VAR#pattern} - remove shortest prefix
        - ${VAR##pattern} - remove longest prefix
        - ${VAR%pattern} - remove shortest suffix
        - ${VAR%%pattern} - remove longest suffix
        - ${VAR/pattern/replacement} - replace first match
        - ${VAR//pattern/replacement} - replace all matches
        - ${VAR^} - uppercase first char
        - ${VAR^^} - uppercase all
        - ${VAR,} - lowercase first char
        - ${VAR,,} - lowercase all
        """
        if not content:
            return ParameterExpansionPart(parameter="")

        # Handle length operator ${#VAR}
        if content.startswith("#"):
            rest = content[1:]
            # Parse the parameter name after #
            if not rest:
                # ${#} = number of positional parameters
                return ParameterExpansionPart(parameter="", operation=LengthOp())
            if rest[0] in '@*?!#-$':
                param = rest[0]
                remaining = rest[1:]
            elif rest[0].isdigit():
                param = rest[0]
                remaining = rest[1:]
            else:
                # Variable name
                j = 0
                while j < len(rest) and (rest[j].isalnum() or rest[j] == '_'):
                    j += 1
                if j == 0:
                    # No valid name - store full content for runtime error
                    return ParameterExpansionPart(parameter=content, operation=LengthOp())
                param = rest[:j]
                remaining = rest[j:]
                # Allow array subscript: ${#arr[@]}, ${#arr[0]}
                if remaining.startswith('['):
                    bracket_depth = 1
                    k = 1
                    while k < len(remaining) and bracket_depth > 0:
                        if remaining[k] == '[':
                            bracket_depth += 1
                        elif remaining[k] == ']':
                            bracket_depth -= 1
                        k += 1
                    param = rest[:j + k]
                    remaining = remaining[k:]
            # After ${#param}, no other operators are allowed - mark for runtime error
            if remaining:
                # Store original content; expansion will detect and raise BadSubstitutionError
                return ParameterExpansionPart(parameter=content, operation=LengthOp())
            return ParameterExpansionPart(parameter=param, operation=LengthOp())

        # Find the parameter name (alphanumeric, _, or special chars)
        i = 0
        # Handle special parameters like @, *, ?, $, #, !, -, 0-9
        if content and content[0] == "!" and len(content) > 1 and (content[1].isalpha() or content[1] == '_'):
            # ${!varname...} - indirection prefix
            j = 1
            while j < len(content) and (content[j].isalnum() or content[j] == '_'):
                j += 1
            if j < len(content) and content[j] == '[':
                # Array subscript: ${!arr[@]} or ${!arr[subscript]}
                bracket_depth = 1
                j += 1
                while j < len(content) and bracket_depth > 0:
                    if content[j] == '[':
                        bracket_depth += 1
                    elif content[j] == ']':
                        bracket_depth -= 1
                    j += 1
                param = content[:j]
                i = j
            elif j < len(content) and content[j] in '@*' and j + 1 == len(content):
                # Prefix expansion: ${!prefix@} or ${!prefix*}
                param = content[:j + 1]
                i = j + 1
            else:
                # Indirection with possible operation: ${!ref}, ${!ref-default}, etc.
                param = content[:j]
                i = j
        elif content and content[0] == "!" and len(content) > 1 and content[1].isdigit():
            # ${!1} etc - indirect via positional parameter
            j = 1
            while j < len(content) and content[j].isdigit():
                j += 1
            param = content[:j]
            i = j
        elif content and content[0] in "@*?$#!-0123456789":
            param = content[0]
            i = 1
        else:
            # Regular variable name
            while i < len(content) and (content[i].isalnum() or content[i] == "_"):
                i += 1
            # Handle array subscript: name[subscript]
            if i < len(content) and content[i] == "[":
                bracket_depth = 1
                i += 1
                while i < len(content) and bracket_depth > 0:
                    if content[i] == "[":
                        bracket_depth += 1
                    elif content[i] == "]":
                        bracket_depth -= 1
                    i += 1
            param = content[:i]

        # If no operation follows, return simple expansion
        if i >= len(content):
            return ParameterExpansionPart(parameter=param)

        rest = content[i:]

        # Handle :- := :? :+ (with colon = check empty too)
        # When inside double quotes, pass quoted=True and in_param_expansion=True
        # so inner quotes are recognized but don't get wrapped again
        dq = in_double_quotes
        if rest.startswith(":-"):
            word = self._parse_word_from_string(rest[2:], quoted=dq, in_param_expansion=True)
            return ParameterExpansionPart(
                parameter=param,
                operation=DefaultValueOp(word=word, check_empty=True),
            )
        if rest.startswith("-"):
            word = self._parse_word_from_string(rest[1:], quoted=dq, in_param_expansion=True)
            return ParameterExpansionPart(
                parameter=param,
                operation=DefaultValueOp(word=word, check_empty=False),
            )
        if rest.startswith(":="):
            word = self._parse_word_from_string(rest[2:], quoted=dq, in_param_expansion=True)
            return ParameterExpansionPart(
                parameter=param,
                operation=AssignDefaultOp(word=word, check_empty=True),
            )
        if rest.startswith("="):
            word = self._parse_word_from_string(rest[1:], quoted=dq, in_param_expansion=True)
            return ParameterExpansionPart(
                parameter=param,
                operation=AssignDefaultOp(word=word, check_empty=False),
            )
        if rest.startswith(":?"):
            word = self._parse_word_from_string(rest[2:], quoted=dq, in_param_expansion=True)
            return ParameterExpansionPart(
                parameter=param,
                operation=ErrorIfUnsetOp(word=word, check_empty=True),
            )
        if rest.startswith("?"):
            word = self._parse_word_from_string(rest[1:], quoted=dq, in_param_expansion=True)
            return ParameterExpansionPart(
                parameter=param,
                operation=ErrorIfUnsetOp(word=word, check_empty=False),
            )
        if rest.startswith(":+"):
            word = self._parse_word_from_string(rest[2:], quoted=dq, in_param_expansion=True)
            return ParameterExpansionPart(
                parameter=param,
                operation=UseAlternativeOp(word=word, check_empty=True),
            )
        if rest.startswith("+"):
            word = self._parse_word_from_string(rest[1:], quoted=dq, in_param_expansion=True)
            return ParameterExpansionPart(
                parameter=param,
                operation=UseAlternativeOp(word=word, check_empty=False),
            )

        # Handle substring ${VAR:offset} or ${VAR:offset:length}
        if rest.startswith(":"):
            # Find offset and length
            parts_str = rest[1:]
            colon_pos = parts_str.find(":")
            if colon_pos >= 0:
                offset_raw = parts_str[:colon_pos]
                length_raw = parts_str[colon_pos + 1:]
                # Try to parse as int; if not, store raw string for arithmetic evaluation
                try:
                    offset = int(offset_raw) if offset_raw else 0
                except ValueError:
                    offset = 0
                try:
                    length = int(length_raw) if length_raw else None
                except ValueError:
                    length = None
                return ParameterExpansionPart(
                    parameter=param,
                    operation=SubstringOp(
                        offset=offset, length=length,
                        offset_str=offset_raw if offset_raw else None,
                        length_str=length_raw if length_raw else None,
                    ),
                )
            else:
                try:
                    offset = int(parts_str) if parts_str else 0
                except ValueError:
                    offset = 0
                return ParameterExpansionPart(
                    parameter=param,
                    operation=SubstringOp(
                        offset=offset, length=None,
                        offset_str=parts_str if parts_str else None,
                        length_str=None,
                    ),
                )

        # Handle pattern removal ${VAR#pattern} ${VAR##pattern} ${VAR%pattern} ${VAR%%pattern}
        if rest.startswith("##"):
            pattern = self._parse_word_from_string(rest[2:])
            return ParameterExpansionPart(
                parameter=param,
                operation=PatternRemovalOp(pattern=pattern, greedy=True, side="prefix"),
            )
        if rest.startswith("#"):
            pattern = self._parse_word_from_string(rest[1:])
            return ParameterExpansionPart(
                parameter=param,
                operation=PatternRemovalOp(pattern=pattern, greedy=False, side="prefix"),
            )
        if rest.startswith("%%"):
            pattern = self._parse_word_from_string(rest[2:])
            return ParameterExpansionPart(
                parameter=param,
                operation=PatternRemovalOp(pattern=pattern, greedy=True, side="suffix"),
            )
        if rest.startswith("%"):
            pattern = self._parse_word_from_string(rest[1:])
            return ParameterExpansionPart(
                parameter=param,
                operation=PatternRemovalOp(pattern=pattern, greedy=False, side="suffix"),
            )

        # Handle pattern replacement ${VAR/pattern/replacement} ${VAR//pattern/replacement}
        # Also handle anchored patterns: ${VAR/#pattern/repl} (start) ${VAR/%pattern/repl} (end)
        if rest.startswith("//"):
            slash_pos = _find_patsub_separator(rest, 2)
            if slash_pos >= 0:
                pattern = self._parse_word_from_string(rest[2:slash_pos])
                replacement = self._parse_word_from_string(rest[slash_pos + 1:])
            else:
                pattern = self._parse_word_from_string(rest[2:])
                replacement = self._parse_word_from_string("")
            return ParameterExpansionPart(
                parameter=param,
                operation=PatternReplacementOp(
                    pattern=pattern, replacement=replacement, all=True
                ),
            )
        if rest.startswith("/#"):
            slash_pos = _find_patsub_separator(rest, 2, allow_empty=True)
            if slash_pos >= 0:
                pattern = self._parse_word_from_string(rest[2:slash_pos])
                replacement = self._parse_word_from_string(rest[slash_pos + 1:])
            else:
                pattern = self._parse_word_from_string(rest[2:])
                replacement = self._parse_word_from_string("")
            return ParameterExpansionPart(
                parameter=param,
                operation=PatternReplacementOp(
                    pattern=pattern, replacement=replacement, all=False, anchor="start"
                ),
            )
        if rest.startswith("/%"):
            # Anchored at end (suffix)
            slash_pos = _find_patsub_separator(rest, 2, allow_empty=True)
            if slash_pos >= 0:
                pattern = self._parse_word_from_string(rest[2:slash_pos])
                replacement = self._parse_word_from_string(rest[slash_pos + 1:])
            else:
                pattern = self._parse_word_from_string(rest[2:])
                replacement = self._parse_word_from_string("")
            return ParameterExpansionPart(
                parameter=param,
                operation=PatternReplacementOp(
                    pattern=pattern, replacement=replacement, all=False, anchor="end"
                ),
            )
        if rest.startswith("/"):
            slash_pos = _find_patsub_separator(rest, 1, allow_empty=True)
            if slash_pos >= 0:
                pattern = self._parse_word_from_string(rest[1:slash_pos])
                replacement = self._parse_word_from_string(rest[slash_pos + 1:])
            else:
                pattern = self._parse_word_from_string(rest[1:])
                replacement = self._parse_word_from_string("")
            return ParameterExpansionPart(
                parameter=param,
                operation=PatternReplacementOp(
                    pattern=pattern, replacement=replacement, all=False
                ),
            )

        # Handle case modification ${VAR^} ${VAR^^} ${VAR,} ${VAR,,}
        # Optionally followed by a pattern: ${VAR^^pattern} ${VAR,,pattern}
        if rest.startswith("^^"):
            pat_str = rest[2:]
            pat = AST.word([LiteralPart(value=pat_str)]) if pat_str else None
            return ParameterExpansionPart(
                parameter=param,
                operation=CaseModificationOp(direction="upper", all=True, pattern=pat),
            )
        if rest.startswith("^"):
            pat_str = rest[1:]
            pat = AST.word([LiteralPart(value=pat_str)]) if pat_str else None
            return ParameterExpansionPart(
                parameter=param,
                operation=CaseModificationOp(direction="upper", all=False, pattern=pat),
            )
        if rest.startswith(",,"):
            pat_str = rest[2:]
            pat = AST.word([LiteralPart(value=pat_str)]) if pat_str else None
            return ParameterExpansionPart(
                parameter=param,
                operation=CaseModificationOp(direction="lower", all=True, pattern=pat),
            )
        if rest.startswith(","):
            pat_str = rest[1:]
            pat = AST.word([LiteralPart(value=pat_str)]) if pat_str else None
            return ParameterExpansionPart(
                parameter=param,
                operation=CaseModificationOp(direction="lower", all=False, pattern=pat),
            )

        # Handle transforms ${VAR@Q} ${VAR@a} ${VAR@A} ${VAR@E} ${VAR@P} ${VAR@K} ${VAR@u} ${VAR@U} ${VAR@L}
        if rest.startswith("@") and len(rest) >= 2 and rest[1] in "QaAEPKkuUL":
            op_char = rest[1]
            return ParameterExpansionPart(
                parameter=param,
                operation=TransformOp(operator=op_char),
            )

        # Default: treat the whole thing as parameter name (for compatibility)
        return ParameterExpansionPart(parameter=content)

    def _parse_arithmetic_expression(self, expr: str) -> ArithExpr:
        """Parse an arithmetic expression string into an ArithExpr AST.

        This is a simple recursive descent parser supporting:
        - Numbers (integers)
        - Variables
        - Binary operators: + - * / % ** < > <= >= == != && || & | ^ ,
        - Unary operators: - + ! ~ ++ --
        - Parentheses
        - Ternary: cond ? a : b
        """
        expr = expr.strip()
        if not expr:
            return ArithNumberNode(value=0)

        return self._parse_arith_comma(expr)

    def _parse_arith_comma(self, expr: str) -> ArithExpr:
        """Parse comma operator (lowest precedence, left-to-right)."""
        return self._parse_arith_binary(expr, [','], self._parse_arith_assignment)

    def _parse_arith_assignment(self, expr: str) -> ArithExpr:
        """Parse assignment operators: = += -= *= /= %= <<= >>= &= |= ^="""
        expr = expr.strip()
        # Assignment operators (right-to-left, check longest first)
        assign_ops = ['<<=', '>>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '=']

        # Scan right-to-left for assignment operator (right-associative)
        depth = 0
        brace_depth = 0
        bracket_depth = 0
        for i in range(len(expr) - 1, -1, -1):
            c = expr[i]
            if c == ')':
                depth += 1
            elif c == '(':
                depth -= 1
            elif c == '}':
                brace_depth += 1
            elif c == '{' and brace_depth > 0:
                brace_depth -= 1
            elif c == ']':
                bracket_depth += 1
            elif c == '[' and bracket_depth > 0:
                bracket_depth -= 1
            elif depth == 0 and brace_depth == 0 and bracket_depth == 0:
                for op in assign_ops:
                    op_start = i - len(op) + 1
                    if op_start >= 0 and expr[op_start:i + 1] == op:
                        # Make sure it's not == or != or <= or >=
                        if op == '=' and op_start > 0 and expr[op_start - 1] in '=!<>':
                            continue
                        left = expr[:op_start].strip()
                        right = expr[i + 1:].strip()
                        if left and right:
                            # Left must be a variable name (or array access)
                            var_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)(\[.+\])?$', left)
                            if var_match:
                                var_name = var_match.group(1)
                                subscript = var_match.group(2)
                                subscript_expr = None
                                if subscript:
                                    subscript_expr = self._parse_arith_ternary(subscript[1:-1])
                                value_expr = self._parse_arith_assignment(right)
                                return ArithAssignmentNode(
                                    operator=op,
                                    variable=var_name,
                                    subscript=subscript_expr,
                                    value=value_expr
                                )
        return self._parse_arith_ternary(expr)

    def _parse_arith_ternary(self, expr: str) -> ArithExpr:
        """Parse ternary: cond ? a : b"""
        # Find unquoted ? and : for ternary
        depth = 0
        brace_depth = 0
        bracket_depth = 0
        question_pos = -1
        i = 0
        while i < len(expr):
            c = expr[i]
            if c == '$' and i + 1 < len(expr) and expr[i + 1] == '{':
                brace_depth += 1
                i += 2
                continue
            elif c == '{' and brace_depth > 0:
                brace_depth += 1
            elif c == '}' and brace_depth > 0:
                brace_depth -= 1
            elif brace_depth > 0:
                i += 1
                continue
            elif c == '[':
                bracket_depth += 1
            elif c == ']' and bracket_depth > 0:
                bracket_depth -= 1
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
            elif c == '?' and depth == 0 and bracket_depth == 0:
                question_pos = i
                i += 1
                break
            i += 1

        if question_pos > 0:
            # Find the matching : (must track nested ternary depth)
            colon_pos = -1
            ternary_depth = 0
            paren_depth = 0
            brace_depth2 = 0
            bracket_depth2 = 0
            for i in range(question_pos + 1, len(expr)):
                c = expr[i]
                if c == '$' and i + 1 < len(expr) and expr[i + 1] == '{':
                    brace_depth2 += 1
                elif c == '{' and brace_depth2 > 0:
                    brace_depth2 += 1
                elif c == '}' and brace_depth2 > 0:
                    brace_depth2 -= 1
                elif brace_depth2 > 0:
                    continue
                elif c == '[':
                    bracket_depth2 += 1
                elif c == ']' and bracket_depth2 > 0:
                    bracket_depth2 -= 1
                elif c == '(':
                    paren_depth += 1
                elif c == ')':
                    paren_depth -= 1
                elif c == '?' and paren_depth == 0 and bracket_depth2 == 0:
                    ternary_depth += 1  # Nested ternary
                elif c == ':' and paren_depth == 0 and bracket_depth2 == 0:
                    if ternary_depth > 0:
                        ternary_depth -= 1  # Close nested ternary
                    else:
                        colon_pos = i
                        break

            if colon_pos > 0:
                condition = self._parse_arith_or(expr[:question_pos].strip())
                consequent = self._parse_arith_ternary(expr[question_pos + 1:colon_pos].strip())
                alternate = self._parse_arith_ternary(expr[colon_pos + 1:].strip())
                return ArithTernaryNode(condition=condition, consequent=consequent, alternate=alternate)

        return self._parse_arith_or(expr)

    def _parse_arith_or(self, expr: str) -> ArithExpr:
        """Parse ||"""
        return self._parse_arith_binary(expr, ['||'], self._parse_arith_and)

    def _parse_arith_and(self, expr: str) -> ArithExpr:
        """Parse &&"""
        return self._parse_arith_binary(expr, ['&&'], self._parse_arith_bitor)

    def _parse_arith_bitor(self, expr: str) -> ArithExpr:
        """Parse |"""
        return self._parse_arith_binary(expr, ['|'], self._parse_arith_bitxor, exclude=['||'])

    def _parse_arith_bitxor(self, expr: str) -> ArithExpr:
        """Parse ^"""
        return self._parse_arith_binary(expr, ['^'], self._parse_arith_bitand)

    def _parse_arith_bitand(self, expr: str) -> ArithExpr:
        """Parse &"""
        return self._parse_arith_binary(expr, ['&'], self._parse_arith_equality, exclude=['&&'])

    def _parse_arith_equality(self, expr: str) -> ArithExpr:
        """Parse == !="""
        return self._parse_arith_binary(expr, ['==', '!='], self._parse_arith_comparison)

    def _parse_arith_comparison(self, expr: str) -> ArithExpr:
        """Parse < > <= >="""
        return self._parse_arith_binary(expr, ['<=', '>=', '<', '>'], self._parse_arith_shift, exclude=['<<', '>>'])

    def _parse_arith_shift(self, expr: str) -> ArithExpr:
        """Parse << >>"""
        return self._parse_arith_binary(expr, ['<<', '>>'], self._parse_arith_additive)

    def _parse_arith_additive(self, expr: str) -> ArithExpr:
        """Parse + -"""
        return self._parse_arith_binary(expr, ['+', '-'], self._parse_arith_multiplicative, exclude=['++', '--'])

    def _parse_arith_multiplicative(self, expr: str) -> ArithExpr:
        """Parse * / %"""
        return self._parse_arith_binary(expr, ['*', '/', '%'], self._parse_arith_power, exclude=['**'])

    def _parse_arith_power(self, expr: str) -> ArithExpr:
        """Parse ** (right associative)"""
        return self._parse_arith_binary(expr, ['**'], self._parse_arith_unary, right_assoc=True)

    def _parse_arith_binary(self, expr: str, operators: list[str], next_level,
                           exclude: list[str] | None = None, right_assoc: bool = False) -> ArithExpr:
        """Parse binary operators at a given precedence level."""
        expr = expr.strip()
        depth = 0
        brace_depth = 0  # Track ${...} depth
        bracket_depth = 0  # Track [...] depth

        # Sort operators by length (longest first) to match ** before *
        ops = sorted(operators, key=len, reverse=True)
        exclude = exclude or []

        # Characters that indicate the preceding context is an operator (not a value)
        # Used to distinguish binary +/- from unary +/-
        _op_chars = frozenset('+-*/%=<>!&|^~(,?:')

        # Scan for operator (right-to-left for left-assoc, left-to-right for right-assoc)
        positions = []
        i = 0
        while i < len(expr):
            c = expr[i]
            if c == '(' and brace_depth == 0:
                depth += 1
                i += 1
            elif c == ')' and brace_depth == 0:
                depth -= 1
                i += 1
            elif c == '$' and i + 1 < len(expr) and expr[i + 1] == '{':
                brace_depth += 1
                i += 2
            elif c == '{' and brace_depth > 0:
                brace_depth += 1
                i += 1
            elif c == '}' and brace_depth > 0:
                brace_depth -= 1
                i += 1
            elif c == '[' and depth == 0 and brace_depth == 0:
                bracket_depth += 1
                i += 1
            elif c == ']' and bracket_depth > 0:
                bracket_depth -= 1
                i += 1
            elif depth == 0 and brace_depth == 0 and bracket_depth == 0:
                # First check exclusions - skip past them entirely
                skip_len = 0
                for ex in exclude:
                    if expr[i:i+len(ex)] == ex:
                        skip_len = len(ex)
                        break
                if skip_len:
                    i += skip_len
                    continue
                # Check for operators
                matched = False
                for op in ops:
                    if expr[i:i+len(op)] == op:
                        # For single-char + or -, check if this is a binary or unary operator.
                        # It's unary if preceded by nothing or by an operator character.
                        if op in ('+', '-') and len(op) == 1:
                            # Find the last non-whitespace char before this position
                            prev_nonws = ''
                            for k in range(i - 1, -1, -1):
                                if expr[k] not in ' \t':
                                    prev_nonws = expr[k]
                                    break
                            if not prev_nonws or prev_nonws in _op_chars:
                                # This is a unary operator, not binary - skip it
                                i += 1
                                matched = True
                                break
                        positions.append((i, op))
                        matched = True
                        i += len(op)
                        break
                if not matched:
                    i += 1
            else:
                i += 1

        if positions:
            # For left-associative, take rightmost; for right-associative, take leftmost
            pos, op = positions[-1] if not right_assoc else positions[0]
            left = expr[:pos].strip()
            right = expr[pos + len(op):].strip()
            if left and right:
                left_node = self._parse_arith_binary(left, operators, next_level, exclude, right_assoc) if not right_assoc else next_level(left)
                right_node = next_level(right) if not right_assoc else self._parse_arith_binary(right, operators, next_level, exclude, right_assoc)
                return ArithBinaryNode(operator=op, left=left_node, right=right_node)

        return next_level(expr)

    def _parse_arith_unary(self, expr: str) -> ArithExpr:
        """Parse unary operators: - + ! ~ ++ --"""
        expr = expr.strip()
        # Pre-increment/decrement (must check before single +/-)
        if expr.startswith('++'):
            operand = self._parse_arith_unary(expr[2:].strip())
            return ArithUnaryNode(operator='++', operand=operand, prefix=True)
        if expr.startswith('--'):
            operand = self._parse_arith_unary(expr[2:].strip())
            return ArithUnaryNode(operator='--', operand=operand, prefix=True)
        if expr.startswith('-') and not expr[1:].lstrip().startswith('-'):
            operand = self._parse_arith_unary(expr[1:].strip())
            return ArithUnaryNode(operator='-', operand=operand, prefix=True)
        if expr.startswith('+') and len(expr) > 1:
            operand = self._parse_arith_unary(expr[1:].strip())
            return ArithUnaryNode(operator='+', operand=operand, prefix=True)
        if expr.startswith('!'):
            operand = self._parse_arith_unary(expr[1:].strip())
            return ArithUnaryNode(operator='!', operand=operand, prefix=True)
        if expr.startswith('~'):
            operand = self._parse_arith_unary(expr[1:].strip())
            return ArithUnaryNode(operator='~', operand=operand, prefix=True)
        return self._parse_arith_postfix(expr)

    def _parse_arith_postfix(self, expr: str) -> ArithExpr:
        """Parse postfix operators: ++ --"""
        expr = expr.strip()
        # Post-increment/decrement
        if expr.endswith('++'):
            operand = self._parse_arith_primary(expr[:-2].strip())
            return ArithUnaryNode(operator='++', operand=operand, prefix=False)
        if expr.endswith('--'):
            operand = self._parse_arith_primary(expr[:-2].strip())
            return ArithUnaryNode(operator='--', operand=operand, prefix=False)
        return self._parse_arith_primary(expr)

    def _parse_arith_primary(self, expr: str) -> ArithExpr:
        """Parse primary: numbers, variables, parentheses."""
        expr = expr.strip()

        # Empty expression
        if not expr:
            return ArithNumberNode(value=0)

        # Parenthesized expression
        if expr.startswith('(') and expr.endswith(')'):
            inner = expr[1:-1].strip()
            return ArithGroupNode(expression=self._parse_arith_comma(inner))

        # Hex number
        if expr.startswith('0x') or expr.startswith('0X'):
            try:
                return ArithNumberNode(value=int(expr, 16))
            except ValueError:
                pass

        # Octal number (starts with 0, more than one digit)
        if expr.startswith('0') and len(expr) > 1 and expr[1:].isdigit():
            try:
                return ArithNumberNode(value=int(expr, 8))
            except ValueError:
                pass

        # Number
        if expr.isdigit() or (expr.startswith('-') and expr[1:].isdigit()):
            return ArithNumberNode(value=int(expr))

        # Base N constant: base#value (e.g., 2#101, 16#ff, 36#z)
        base_match = re.match(r'^(\d+)#([a-zA-Z0-9@_]+)$', expr)
        if base_match:
            base = int(base_match.group(1))
            value_str = base_match.group(2)  # Keep case for bases > 36
            if 2 <= base <= 64:
                try:
                    result = self._parse_base_n_value(value_str, base)
                    return ArithNumberNode(value=result)
                except ValueError:
                    pass

        # Variable (possibly with $)
        var_name = expr
        if var_name.startswith('$'):
            var_name = var_name[1:]
        if var_name.startswith('{') and var_name.endswith('}'):
            var_name = var_name[1:-1]

        # Check if it's a valid identifier
        if var_name and (var_name[0].isalpha() or var_name[0] == '_'):
            if all(c.isalnum() or c == '_' for c in var_name):
                return ArithVariableNode(name=var_name)

        # Try as number anyway
        try:
            return ArithNumberNode(value=int(expr))
        except ValueError:
            pass

        # Fallback: treat as variable
        return ArithVariableNode(name=expr)

    def _parse_base_n_value(self, value_str: str, base: int) -> int:
        """Parse a value in base N (2-64).

        Digits:
        - 0-9 = values 0-9
        - a-z = values 10-35
        - A-Z = values 36-61 (or 10-35 if base <= 36)
        - @ = 62, _ = 63
        """
        result = 0
        for char in value_str:
            if char.isdigit():
                digit = int(char)
            elif 'a' <= char <= 'z':
                digit = ord(char) - ord('a') + 10
            elif 'A' <= char <= 'Z':
                if base <= 36:
                    # Case insensitive for bases <= 36
                    digit = ord(char.lower()) - ord('a') + 10
                else:
                    # A-Z are 36-61 for bases > 36
                    digit = ord(char) - ord('A') + 36
            elif char == '@':
                digit = 62
            elif char == '_':
                digit = 63
            else:
                raise ValueError(f"Invalid digit {char} for base {base}")

            if digit >= base:
                raise ValueError(f"Digit {char} out of range for base {base}")

            result = result * base + digit
        return result


def parse(input_text: str) -> ScriptNode:
    """Convenience function to parse input."""
    parser = Parser()
    return parser.parse(input_text)
