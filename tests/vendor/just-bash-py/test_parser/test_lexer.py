"""Tests for the bash lexer."""

import pytest
from just_bash.parser.lexer import Lexer, TokenType, tokenize


class TestBasicTokens:
    """Test basic token recognition."""

    def test_simple_command(self):
        tokens = tokenize("echo hello")
        assert len(tokens) == 3  # NAME, NAME, EOF
        assert tokens[0].type == TokenType.NAME
        assert tokens[0].value == "echo"
        assert tokens[1].type == TokenType.NAME
        assert tokens[1].value == "hello"
        assert tokens[2].type == TokenType.EOF

    def test_pipeline(self):
        tokens = tokenize("cat file.txt | grep pattern")
        assert TokenType.PIPE in [t.type for t in tokens]

    def test_and_and_operator(self):
        tokens = tokenize("true && false")
        types = [t.type for t in tokens]
        assert TokenType.AND_AND in types

    def test_or_or_operator(self):
        tokens = tokenize("true || false")
        types = [t.type for t in tokens]
        assert TokenType.OR_OR in types

    def test_semicolon(self):
        tokens = tokenize("echo a; echo b")
        types = [t.type for t in tokens]
        assert TokenType.SEMICOLON in types

    def test_newline(self):
        tokens = tokenize("echo a\necho b")
        types = [t.type for t in tokens]
        assert TokenType.NEWLINE in types


class TestReservedWords:
    """Test reserved word recognition."""

    def test_if_then_else_fi(self):
        tokens = tokenize("if true; then echo yes; else echo no; fi")
        types = [t.type for t in tokens]
        assert TokenType.IF in types
        assert TokenType.THEN in types
        assert TokenType.ELSE in types
        assert TokenType.FI in types

    def test_for_in_do_done(self):
        tokens = tokenize("for i in 1 2 3; do echo $i; done")
        types = [t.type for t in tokens]
        assert TokenType.FOR in types
        assert TokenType.IN in types
        assert TokenType.DO in types
        assert TokenType.DONE in types

    def test_while_do_done(self):
        tokens = tokenize("while true; do echo loop; done")
        types = [t.type for t in tokens]
        assert TokenType.WHILE in types
        assert TokenType.DO in types
        assert TokenType.DONE in types

    def test_case_esac(self):
        tokens = tokenize("case $x in a) echo a;; esac")
        types = [t.type for t in tokens]
        assert TokenType.CASE in types
        assert TokenType.ESAC in types


class TestRedirections:
    """Test redirection operator recognition."""

    def test_input_redirect(self):
        tokens = tokenize("cat < file.txt")
        types = [t.type for t in tokens]
        assert TokenType.LESS in types

    def test_output_redirect(self):
        tokens = tokenize("echo hello > file.txt")
        types = [t.type for t in tokens]
        assert TokenType.GREAT in types

    def test_append_redirect(self):
        tokens = tokenize("echo hello >> file.txt")
        types = [t.type for t in tokens]
        assert TokenType.DGREAT in types

    def test_heredoc(self):
        tokens = tokenize("cat <<EOF\nhello\nEOF\n")
        types = [t.type for t in tokens]
        assert TokenType.DLESS in types
        assert TokenType.HEREDOC_CONTENT in types

    def test_herestring(self):
        tokens = tokenize("cat <<< 'hello'")
        types = [t.type for t in tokens]
        assert TokenType.TLESS in types


class TestAssignments:
    """Test assignment recognition."""

    def test_simple_assignment(self):
        tokens = tokenize("VAR=value")
        assert tokens[0].type == TokenType.ASSIGNMENT_WORD
        assert tokens[0].value == "VAR=value"

    def test_assignment_with_command(self):
        tokens = tokenize("VAR=value echo $VAR")
        assert tokens[0].type == TokenType.ASSIGNMENT_WORD

    def test_array_assignment(self):
        tokens = tokenize("arr[0]=value")
        assert tokens[0].type == TokenType.ASSIGNMENT_WORD

    def test_append_assignment(self):
        tokens = tokenize("VAR+=more")
        assert tokens[0].type == TokenType.ASSIGNMENT_WORD


class TestQuotes:
    """Test quoted string handling."""

    def test_single_quoted(self):
        tokens = tokenize("echo 'hello world'")
        assert tokens[1].type == TokenType.WORD
        assert tokens[1].value == "hello world"
        assert tokens[1].single_quoted

    def test_double_quoted(self):
        tokens = tokenize('echo "hello world"')
        assert tokens[1].type == TokenType.WORD
        assert tokens[1].value == "hello world"
        assert tokens[1].quoted

    def test_escape_in_word(self):
        tokens = tokenize(r"echo hello\ world")
        assert tokens[1].type == TokenType.WORD


class TestExpansions:
    """Test expansion recognition (kept as raw strings for parser)."""

    def test_variable_expansion(self):
        tokens = tokenize("echo $VAR")
        assert "$VAR" in tokens[1].value

    def test_command_substitution(self):
        tokens = tokenize("echo $(date)")
        assert "$(date)" in tokens[1].value

    def test_parameter_expansion(self):
        tokens = tokenize("echo ${VAR}")
        assert "${VAR}" in tokens[1].value


class TestComments:
    """Test comment handling."""

    def test_line_comment(self):
        tokens = tokenize("echo hello # this is a comment")
        types = [t.type for t in tokens]
        assert TokenType.COMMENT in types

    def test_comment_at_start(self):
        tokens = tokenize("# comment\necho hello")
        assert tokens[0].type == TokenType.COMMENT


class TestBraces:
    """Test brace handling."""

    def test_command_group(self):
        tokens = tokenize("{ echo hello; }")
        types = [t.type for t in tokens]
        assert TokenType.LBRACE in types
        assert TokenType.RBRACE in types

    def test_find_placeholder(self):
        tokens = tokenize("find . -exec {} \\;")
        # {} should be recognized as a word
        values = [t.value for t in tokens]
        assert "{}" in values


class TestLineNumbers:
    """Test line and column tracking."""

    def test_single_line(self):
        tokens = tokenize("echo hello")
        assert tokens[0].line == 1
        assert tokens[0].column == 1
        assert tokens[1].column == 6

    def test_multiple_lines(self):
        tokens = tokenize("echo hello\necho world")
        # Find second echo
        second_echo = [t for t in tokens if t.value == "echo"][1]
        assert second_echo.line == 2
        assert second_echo.column == 1
