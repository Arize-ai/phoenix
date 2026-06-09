"""Tests for brace expansion.

Covers: brace-expansion.test.sh failures
Key areas: sequences {1..10}, {a..z}, step sequences {1..10..2}, nested braces, edge cases with quotes
"""

import pytest
from just_bash import Bash


class TestBraceExpansionBasic:
    """Basic brace expansion with comma-separated values."""

    @pytest.mark.asyncio
    async def test_simple_list(self):
        """Simple comma-separated list."""
        bash = Bash()
        result = await bash.exec('echo {a,b,c}')
        assert result.stdout.strip() == "a b c"

    @pytest.mark.asyncio
    async def test_with_prefix(self):
        """Brace expansion with prefix."""
        bash = Bash()
        result = await bash.exec('echo pre{a,b,c}')
        assert result.stdout.strip() == "prea preb prec"

    @pytest.mark.asyncio
    async def test_with_suffix(self):
        """Brace expansion with suffix."""
        bash = Bash()
        result = await bash.exec('echo {a,b,c}suf')
        assert result.stdout.strip() == "asuf bsuf csuf"

    @pytest.mark.asyncio
    async def test_with_prefix_and_suffix(self):
        """Brace expansion with both prefix and suffix."""
        bash = Bash()
        result = await bash.exec('echo pre{a,b,c}suf')
        assert result.stdout.strip() == "preasuf prebsuf precsuf"

    @pytest.mark.asyncio
    async def test_file_extension(self):
        """Brace expansion for file extensions."""
        bash = Bash()
        result = await bash.exec('echo file.{txt,log,csv}')
        assert result.stdout.strip() == "file.txt file.log file.csv"


class TestBraceExpansionSequences:
    """Test numeric and alphabetic sequences."""

    @pytest.mark.asyncio
    async def test_numeric_sequence(self):
        """Numeric sequence {1..5}."""
        bash = Bash()
        result = await bash.exec('echo {1..5}')
        assert result.stdout.strip() == "1 2 3 4 5"

    @pytest.mark.asyncio
    async def test_numeric_sequence_large(self):
        """Larger numeric sequence."""
        bash = Bash()
        result = await bash.exec('echo {1..10}')
        assert result.stdout.strip() == "1 2 3 4 5 6 7 8 9 10"

    @pytest.mark.asyncio
    async def test_reverse_numeric(self):
        """Reverse numeric sequence."""
        bash = Bash()
        result = await bash.exec('echo {5..1}')
        assert result.stdout.strip() == "5 4 3 2 1"

    @pytest.mark.asyncio
    async def test_alpha_sequence_lower(self):
        """Lowercase alphabetic sequence."""
        bash = Bash()
        result = await bash.exec('echo {a..e}')
        assert result.stdout.strip() == "a b c d e"

    @pytest.mark.asyncio
    async def test_alpha_sequence_upper(self):
        """Uppercase alphabetic sequence."""
        bash = Bash()
        result = await bash.exec('echo {A..E}')
        assert result.stdout.strip() == "A B C D E"

    @pytest.mark.asyncio
    async def test_reverse_alpha(self):
        """Reverse alphabetic sequence."""
        bash = Bash()
        result = await bash.exec('echo {e..a}')
        assert result.stdout.strip() == "e d c b a"

    @pytest.mark.asyncio
    async def test_zero_padded_sequence(self):
        """Zero-padded numeric sequence."""
        bash = Bash()
        result = await bash.exec('echo {01..05}')
        assert result.stdout.strip() == "01 02 03 04 05"

    @pytest.mark.asyncio
    async def test_wider_zero_padding(self):
        """Zero-padding with larger numbers."""
        bash = Bash()
        result = await bash.exec('echo {001..003}')
        assert result.stdout.strip() == "001 002 003"


class TestBraceExpansionStep:
    """Test sequences with step/increment."""

    @pytest.mark.asyncio
    async def test_step_by_two(self):
        """Step by 2."""
        bash = Bash()
        result = await bash.exec('echo {1..10..2}')
        assert result.stdout.strip() == "1 3 5 7 9"

    @pytest.mark.asyncio
    async def test_step_by_three(self):
        """Step by 3."""
        bash = Bash()
        result = await bash.exec('echo {0..12..3}')
        assert result.stdout.strip() == "0 3 6 9 12"

    @pytest.mark.asyncio
    async def test_reverse_with_step(self):
        """Reverse sequence with step."""
        bash = Bash()
        result = await bash.exec('echo {10..1..2}')
        assert result.stdout.strip() == "10 8 6 4 2"

    @pytest.mark.asyncio
    async def test_alpha_with_step(self):
        """Alphabetic sequence with step."""
        bash = Bash()
        result = await bash.exec('echo {a..z..5}')
        # a, f, k, p, u, z
        assert "a" in result.stdout
        assert "f" in result.stdout


class TestBraceExpansionNested:
    """Test nested brace expansions."""

    @pytest.mark.asyncio
    async def test_nested_braces(self):
        """Nested brace expansion."""
        bash = Bash()
        result = await bash.exec('echo {a,b{1,2},c}')
        assert result.stdout.strip() == "a b1 b2 c"

    @pytest.mark.asyncio
    async def test_double_nested(self):
        """Double nested braces."""
        bash = Bash()
        result = await bash.exec('echo {a{1,2},b{3,4}}')
        assert result.stdout.strip() == "a1 a2 b3 b4"

    @pytest.mark.asyncio
    async def test_multiple_braces(self):
        """Multiple brace expansions in sequence."""
        bash = Bash()
        result = await bash.exec('echo {a,b}{1,2}')
        assert result.stdout.strip() == "a1 a2 b1 b2"

    @pytest.mark.asyncio
    async def test_cartesian_product(self):
        """Three expansions (cartesian product)."""
        bash = Bash()
        result = await bash.exec('echo {a,b}{1,2}{x,y}')
        # Should produce 8 combinations
        words = result.stdout.strip().split()
        assert len(words) == 8


class TestBraceExpansionQuotes:
    """Test brace expansion with quotes."""

    @pytest.mark.asyncio
    async def test_quoted_no_expansion(self):
        """Quoted braces are not expanded."""
        bash = Bash()
        result = await bash.exec('echo "{a,b,c}"')
        assert result.stdout.strip() == "{a,b,c}"

    @pytest.mark.asyncio
    async def test_single_quoted_no_expansion(self):
        """Single-quoted braces are not expanded."""
        bash = Bash()
        result = await bash.exec("echo '{a,b,c}'")
        assert result.stdout.strip() == "{a,b,c}"

    @pytest.mark.asyncio
    async def test_partial_quote(self):
        """Partial quoting prevents expansion."""
        bash = Bash()
        result = await bash.exec('echo "pre"{a,b}"suf"')
        assert result.stdout.strip() == "preasuf prebsuf"

    @pytest.mark.asyncio
    async def test_escaped_brace(self):
        """Escaped braces are literal."""
        bash = Bash()
        result = await bash.exec('echo \\{a,b\\}')
        assert "{a,b}" in result.stdout


class TestBraceExpansionEdgeCases:
    """Test edge cases and special scenarios."""

    @pytest.mark.asyncio
    async def test_single_element_no_expansion(self):
        """Single element without comma is literal."""
        bash = Bash()
        result = await bash.exec('echo {abc}')
        assert result.stdout.strip() == "{abc}"

    @pytest.mark.asyncio
    async def test_empty_element(self):
        """Empty element in list."""
        bash = Bash()
        result = await bash.exec('echo a{,b,c}')
        assert result.stdout.strip() == "a ab ac"

    @pytest.mark.asyncio
    async def test_leading_empty(self):
        """Leading empty element."""
        bash = Bash()
        result = await bash.exec('echo {,a,b}x')
        assert result.stdout.strip() == "x ax bx"

    @pytest.mark.asyncio
    async def test_trailing_empty(self):
        """Trailing empty element."""
        bash = Bash()
        result = await bash.exec('echo {a,b,}x')
        assert result.stdout.strip() == "ax bx x"

    @pytest.mark.asyncio
    async def test_negative_sequence(self):
        """Negative number sequence."""
        bash = Bash()
        result = await bash.exec('echo {-3..3}')
        assert result.stdout.strip() == "-3 -2 -1 0 1 2 3"

    @pytest.mark.asyncio
    async def test_single_negative(self):
        """Sequence crossing zero."""
        bash = Bash()
        result = await bash.exec('echo {-2..2}')
        assert result.stdout.strip() == "-2 -1 0 1 2"


class TestBraceExpansionPaths:
    """Test brace expansion for file paths."""

    @pytest.mark.asyncio
    async def test_directory_expansion(self):
        """Brace expansion for directories."""
        bash = Bash()
        result = await bash.exec('echo /path/{src,lib,bin}')
        assert result.stdout.strip() == "/path/src /path/lib /path/bin"

    @pytest.mark.asyncio
    async def test_file_backup(self):
        """Common backup pattern."""
        bash = Bash()
        result = await bash.exec('echo file{,.bak}')
        assert result.stdout.strip() == "file file.bak"

    @pytest.mark.asyncio
    async def test_multiple_extensions(self):
        """Multiple file extensions."""
        bash = Bash()
        result = await bash.exec('echo image.{jpg,png,gif}')
        assert result.stdout.strip() == "image.jpg image.png image.gif"


class TestBraceExpansionVariables:
    """Test brace expansion with variables."""

    @pytest.mark.asyncio
    async def test_variable_in_prefix(self):
        """Variable in prefix (expands first)."""
        bash = Bash()
        result = await bash.exec('''
prefix="dir"
echo ${prefix}/{a,b}
''')
        # Variable expansion happens before brace expansion
        assert "dir/a dir/b" in result.stdout

    @pytest.mark.asyncio
    async def test_variable_not_in_braces(self):
        """Variables inside braces are literal."""
        bash = Bash()
        result = await bash.exec('''
x="value"
echo {$x,other}
''')
        # $x is expanded, then brace expansion happens
        assert "value other" in result.stdout


class TestBraceExpansionSpecialChars:
    """Test brace expansion with special characters."""

    @pytest.mark.asyncio
    async def test_with_dots(self):
        """Braces with dots in elements."""
        bash = Bash()
        result = await bash.exec('echo {1.0,2.0,3.0}')
        assert result.stdout.strip() == "1.0 2.0 3.0"

    @pytest.mark.asyncio
    async def test_with_underscores(self):
        """Braces with underscores."""
        bash = Bash()
        result = await bash.exec('echo {a_1,b_2,c_3}')
        assert result.stdout.strip() == "a_1 b_2 c_3"

    @pytest.mark.asyncio
    async def test_with_dashes(self):
        """Braces with dashes."""
        bash = Bash()
        result = await bash.exec('echo {a-x,b-y,c-z}')
        assert result.stdout.strip() == "a-x b-y c-z"


class TestBraceExpansionCrossPart:
    """Test brace expansion where braces span across quoted parts."""

    @pytest.mark.asyncio
    async def test_single_and_double_quotes_in_braces(self):
        """Brace expansion with single and double quotes inside braces."""
        bash = Bash()
        result = await bash.exec("""echo {'a',b}_{c,"d"}""")
        assert result.stdout.strip() == "a_c a_d b_c b_d"

    @pytest.mark.asyncio
    async def test_mixed_quotes_in_braces(self):
        """Brace expansion with mixed escaped and quoted content."""
        bash = Bash()
        result = await bash.exec(r"""echo -{\X"b",'cd'}-""")
        assert result.stdout.strip() == "-Xb- -cd-"

    @pytest.mark.asyncio
    async def test_escaped_special_chars_in_braces(self):
        r"""Brace expansion with escaped special chars: -{$,[,]}-."""
        bash = Bash()
        result = await bash.exec(r"echo -{\$,\[,\]}-")
        assert result.stdout.strip() == "-$- -[- -]-"

    @pytest.mark.asyncio
    async def test_double_quoted_content_in_braces(self):
        """Double-quoted element in brace expansion."""
        bash = Bash()
        result = await bash.exec('echo {"hello",world}')
        assert result.stdout.strip() == "hello world"

    @pytest.mark.asyncio
    async def test_braced_var_in_braces(self):
        """Braced variable expansion inside brace expansion."""
        bash = Bash()
        result = await bash.exec('a=A; echo {${a},b}_{c,d}')
        assert result.stdout.strip() == "A_c A_d b_c b_d"


class TestBraceExpansionEmptyAlternatives:
    """Test brace expansion with empty alternatives."""

    @pytest.mark.asyncio
    async def test_empty_alternatives_elided_without_quotes(self):
        """Empty unquoted alternatives are elided (bash word elision)."""
        bash = Bash()
        result = await bash.exec("echo {X,,Y,}")
        # Bash elides empty unquoted alternatives
        assert result.stdout.strip() == "X Y"

    @pytest.mark.asyncio
    async def test_empty_alternatives_count(self):
        """Empty alternatives produce correct number of words."""
        bash = Bash()
        # {X,,Y,} should produce 4 values: X, '', Y, ''
        # With '' suffix, each gets '' appended (no change)
        result = await bash.exec("argv.py {X,,Y,}''")
        assert result.stdout.strip() == "['X', '', 'Y', '']"


class TestBraceExpansionAssignment:
    """Test brace expansion on assignment RHS."""

    @pytest.mark.asyncio
    async def test_no_expansion_on_rhs(self):
        """Brace expansion should NOT happen on RHS of assignment."""
        bash = Bash()
        result = await bash.exec("v={X,Y}; echo $v")
        assert result.stdout.strip() == "{X,Y}"


class TestBraceExpansionSequenceValidation:
    """Test that invalid sequences are treated as literal."""

    @pytest.mark.asyncio
    async def test_mixed_number_and_letter_is_literal(self):
        """Mixing numbers and letters in sequence should be literal."""
        bash = Bash()
        result = await bash.exec("echo {1..a}")
        assert result.stdout.strip() == "{1..a}"

    @pytest.mark.asyncio
    async def test_mixed_letter_and_number_is_literal(self):
        """Mixing letters and numbers in sequence should be literal."""
        bash = Bash()
        result = await bash.exec("echo {z..3}")
        assert result.stdout.strip() == "{z..3}"

    @pytest.mark.asyncio
    async def test_mixed_case_sequence_is_literal(self):
        """Mixed case char expansion like {z..A} should not expand."""
        bash = Bash()
        result = await bash.exec("echo -{z..A}-")
        # Mixed case sequences are treated as literal
        assert result.stdout.strip() == "-{z..A}-"
        assert result.exit_code == 0
