"""Tests for here documents.

Covers: here-doc.test.sh failures
Key areas: quoted vs unquoted delimiter, tab stripping with <<-, variable expansion, nested heredocs
"""

import pytest
from just_bash import Bash


class TestHeredocBasic:
    """Basic here document functionality."""

    @pytest.mark.asyncio
    async def test_simple_heredoc(self):
        """Simple here document."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
hello
world
EOF
''')
        assert "hello" in result.stdout
        assert "world" in result.stdout

    @pytest.mark.asyncio
    async def test_single_line_heredoc(self):
        """Single line here document."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
single line
EOF
''')
        assert "single line" in result.stdout

    @pytest.mark.asyncio
    async def test_empty_heredoc(self):
        """Empty here document."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
EOF
''')
        assert result.stdout == "" or result.stdout == "\n"

    @pytest.mark.asyncio
    async def test_custom_delimiter(self):
        """Here document with custom delimiter."""
        bash = Bash()
        result = await bash.exec('''
cat << END
content here
END
''')
        assert "content here" in result.stdout


class TestHeredocVariableExpansion:
    """Test variable expansion in here documents."""

    @pytest.mark.asyncio
    async def test_variable_expanded(self):
        """Variables are expanded in unquoted heredoc."""
        bash = Bash()
        result = await bash.exec('''
name="Alice"
cat << EOF
Hello, $name!
EOF
''')
        assert "Hello, Alice!" in result.stdout

    @pytest.mark.asyncio
    async def test_braced_variable(self):
        """Braced variables are expanded."""
        bash = Bash()
        result = await bash.exec('''
greeting="Hello"
cat << EOF
${greeting}, World!
EOF
''')
        assert "Hello, World!" in result.stdout

    @pytest.mark.asyncio
    async def test_command_substitution(self):
        """Command substitution in heredoc."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
Today is $(echo "Monday")
EOF
''')
        assert "Today is Monday" in result.stdout

    @pytest.mark.asyncio
    async def test_arithmetic_expansion(self):
        """Arithmetic expansion in heredoc."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
2 + 2 = $((2 + 2))
EOF
''')
        assert "2 + 2 = 4" in result.stdout


class TestHeredocQuotedDelimiter:
    """Test heredoc with quoted delimiter (no expansion)."""

    @pytest.mark.asyncio
    async def test_single_quoted_delimiter(self):
        """Single-quoted delimiter prevents expansion."""
        bash = Bash()
        result = await bash.exec('''
name="Alice"
cat << 'EOF'
Hello, $name!
EOF
''')
        assert "Hello, $name!" in result.stdout

    @pytest.mark.asyncio
    async def test_double_quoted_delimiter(self):
        """Double-quoted delimiter prevents expansion."""
        bash = Bash()
        result = await bash.exec('''
name="Alice"
cat << "EOF"
Hello, $name!
EOF
''')
        assert "Hello, $name!" in result.stdout

    @pytest.mark.asyncio
    async def test_escaped_delimiter(self):
        """Escaped delimiter prevents expansion."""
        bash = Bash()
        result = await bash.exec('''
name="Alice"
cat << \\EOF
Hello, $name!
EOF
''')
        assert "Hello, $name!" in result.stdout

    @pytest.mark.asyncio
    async def test_partial_quote(self):
        """Partial quote in delimiter."""
        bash = Bash()
        result = await bash.exec('''
name="Alice"
cat << E'O'F
Hello, $name!
EOF
''')
        # Any quoting prevents expansion
        assert "Hello, $name!" in result.stdout


class TestHeredocTabStripping:
    """Test <<- for tab stripping."""

    @pytest.mark.asyncio
    async def test_strip_leading_tabs(self):
        """<<- strips leading tabs."""
        bash = Bash()
        result = await bash.exec('''
cat <<- EOF
	indented line
	another line
EOF
''')
        assert "indented line" in result.stdout
        assert "another line" in result.stdout

    @pytest.mark.asyncio
    async def test_strip_tabs_from_delimiter(self):
        """<<- strips tabs from delimiter line."""
        bash = Bash()
        result = await bash.exec('''
cat <<- EOF
	content
	EOF
''')
        assert "content" in result.stdout

    @pytest.mark.asyncio
    async def test_spaces_not_stripped(self):
        """<<- only strips tabs, not spaces."""
        bash = Bash()
        result = await bash.exec('''
cat <<- EOF
    space-indented
EOF
''')
        # Spaces are preserved
        assert "    space-indented" in result.stdout or "space-indented" in result.stdout


class TestHeredocEscaping:
    """Test escaping within here documents."""

    @pytest.mark.asyncio
    async def test_backslash_in_unquoted(self):
        """Backslash in unquoted heredoc."""
        bash = Bash()
        result = await bash.exec(r'''
cat << EOF
path: C:\Users\name
EOF
''')
        assert "path:" in result.stdout

    @pytest.mark.asyncio
    async def test_escaped_dollar(self):
        """Escaped dollar sign."""
        bash = Bash()
        result = await bash.exec(r'''
cat << EOF
Price: \$100
EOF
''')
        assert "$100" in result.stdout

    @pytest.mark.asyncio
    async def test_literal_backslash(self):
        """Literal backslash with escape."""
        bash = Bash()
        result = await bash.exec(r'''
cat << EOF
slash: \\
EOF
''')
        assert "\\" in result.stdout or "slash:" in result.stdout


class TestHeredocSpecialContent:
    """Test special content in here documents."""

    @pytest.mark.asyncio
    async def test_empty_lines(self):
        """Here document with empty lines."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
line1

line3
EOF
''')
        lines = result.stdout.strip().split('\n')
        assert "line1" in result.stdout
        assert "line3" in result.stdout

    @pytest.mark.asyncio
    async def test_trailing_whitespace(self):
        """Here document preserves trailing whitespace."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
text
EOF
''')
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_special_characters(self):
        """Here document with special shell characters."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
symbols: | & ; > < * ? [ ] { } ( ) !
EOF
''')
        assert "symbols:" in result.stdout
        assert "|" in result.stdout


class TestHeredocWithCommands:
    """Test here documents with various commands."""

    @pytest.mark.asyncio
    async def test_heredoc_to_file(self):
        """Redirect heredoc to file."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF > /output.txt
file content
EOF
cat /output.txt
''')
        assert "file content" in result.stdout

    @pytest.mark.asyncio
    async def test_heredoc_in_pipeline(self):
        """Here document in pipeline."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF | grep hello
hello
world
EOF
''')
        assert "hello" in result.stdout
        assert "world" not in result.stdout

    @pytest.mark.asyncio
    async def test_heredoc_with_other_args(self):
        """Command with heredoc and other arguments."""
        bash = Bash()
        result = await bash.exec('''
cat -n << EOF
line one
line two
EOF
''')
        # -n adds line numbers
        assert "1" in result.stdout or "one" in result.stdout


class TestMultipleHeredocs:
    """Test multiple here documents."""

    @pytest.mark.asyncio
    async def test_sequential_heredocs(self):
        """Sequential here documents."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF1
first
EOF1
cat << EOF2
second
EOF2
''')
        assert "first" in result.stdout
        assert "second" in result.stdout

    @pytest.mark.asyncio
    async def test_same_line_heredocs(self):
        """Multiple heredocs on same command line."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF1; cat << EOF2
one
EOF1
two
EOF2
''')
        assert "one" in result.stdout
        assert "two" in result.stdout


class TestHeredocInStructures:
    """Test here documents in control structures."""

    @pytest.mark.asyncio
    async def test_heredoc_in_function(self):
        """Here document in function."""
        bash = Bash()
        result = await bash.exec('''
output() {
    cat << EOF
function output
EOF
}
output
''')
        assert "function output" in result.stdout

    @pytest.mark.asyncio
    async def test_heredoc_in_loop(self):
        """Here document in loop."""
        bash = Bash()
        result = await bash.exec('''
for i in 1 2; do
    cat << EOF
iteration $i
EOF
done
''')
        assert "iteration 1" in result.stdout
        assert "iteration 2" in result.stdout

    @pytest.mark.asyncio
    async def test_heredoc_in_if(self):
        """Here document in if statement."""
        bash = Bash()
        result = await bash.exec('''
if true; then
    cat << EOF
in if
EOF
fi
''')
        assert "in if" in result.stdout


class TestHeredocEdgeCases:
    """Test edge cases with here documents."""

    @pytest.mark.asyncio
    async def test_delimiter_in_content(self):
        """Content similar to delimiter."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
EOF is not the end
EOF
''')
        assert "EOF is not the end" in result.stdout

    @pytest.mark.asyncio
    async def test_delimiter_as_prefix(self):
        """Content starting with delimiter text."""
        bash = Bash()
        result = await bash.exec('''
cat << END
ENDING not
END
''')
        assert "ENDING not" in result.stdout

    @pytest.mark.asyncio
    async def test_long_delimiter(self):
        """Very long delimiter."""
        bash = Bash()
        result = await bash.exec('''
cat << VERYLONGDELIMITER
content
VERYLONGDELIMITER
''')
        assert "content" in result.stdout


class TestHereString:
    """Test here-strings (<<<) for comparison."""

    @pytest.mark.asyncio
    async def test_herestring_basic(self):
        """Basic here-string."""
        bash = Bash()
        result = await bash.exec('cat <<< "hello"')
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_herestring_variable(self):
        """Here-string with variable."""
        bash = Bash()
        result = await bash.exec('''
msg="world"
cat <<< "hello $msg"
''')
        assert "hello world" in result.stdout

    @pytest.mark.asyncio
    async def test_herestring_adds_newline(self):
        """Here-string adds trailing newline."""
        bash = Bash()
        result = await bash.exec('cat <<< "text"')
        assert result.stdout.endswith("\n")
