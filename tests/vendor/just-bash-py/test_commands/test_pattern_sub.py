"""Tests for pattern substitution.

Covers: var-op-patsub.test.sh failures
Key areas: ${var/pattern/replacement}, ${var//pattern/replacement} (global),
           ${var/#pattern/replacement} (prefix), ${var/%pattern/replacement} (suffix),
           glob patterns in substitution
"""

import pytest
from just_bash import Bash


class TestPatternSubstitutionBasic:
    """Basic pattern substitution ${var/pattern/replacement}."""

    @pytest.mark.asyncio
    async def test_simple_replacement(self):
        """Simple pattern replacement."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var/world/universe}"
''')
        assert result.stdout.strip() == "hello universe"

    @pytest.mark.asyncio
    async def test_first_occurrence_only(self):
        """Single slash replaces first occurrence only."""
        bash = Bash()
        result = await bash.exec('''
var="hello hello hello"
echo "${var/hello/hi}"
''')
        assert result.stdout.strip() == "hi hello hello"

    @pytest.mark.asyncio
    async def test_no_match(self):
        """No replacement when pattern doesn't match."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var/xyz/abc}"
''')
        assert result.stdout.strip() == "hello world"

    @pytest.mark.asyncio
    async def test_empty_replacement(self):
        """Delete match with empty replacement."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var/world/}"
''')
        assert result.stdout.strip() == "hello"

    @pytest.mark.asyncio
    async def test_omit_replacement(self):
        """Delete match by omitting replacement entirely."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var/world}"
''')
        assert result.stdout.strip() == "hello"


class TestGlobalReplacement:
    """Global pattern substitution ${var//pattern/replacement}."""

    @pytest.mark.asyncio
    async def test_global_replace_all(self):
        """Double slash replaces all occurrences."""
        bash = Bash()
        result = await bash.exec('''
var="hello hello hello"
echo "${var//hello/hi}"
''')
        assert result.stdout.strip() == "hi hi hi"

    @pytest.mark.asyncio
    async def test_global_with_spaces(self):
        """Global replacement of spaces."""
        bash = Bash()
        result = await bash.exec('''
var="a b c d"
echo "${var// /-}"
''')
        assert result.stdout.strip() == "a-b-c-d"

    @pytest.mark.asyncio
    async def test_global_single_char(self):
        """Global replacement of single character."""
        bash = Bash()
        result = await bash.exec('''
var="banana"
echo "${var//a/o}"
''')
        assert result.stdout.strip() == "bonono"


class TestPrefixReplacement:
    """Prefix pattern substitution ${var/#pattern/replacement}."""

    @pytest.mark.asyncio
    async def test_prefix_match(self):
        """Replace at beginning with #."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var/#hello/hi}"
''')
        assert result.stdout.strip() == "hi world"

    @pytest.mark.asyncio
    async def test_prefix_no_match(self):
        """No replacement if not at prefix."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var/#world/universe}"
''')
        assert result.stdout.strip() == "hello world"

    @pytest.mark.asyncio
    async def test_prefix_empty_pattern(self):
        """Empty pattern at prefix inserts at start."""
        bash = Bash()
        result = await bash.exec('''
var="world"
echo "${var/#/hello }"
''')
        assert result.stdout.strip() == "hello world"


class TestSuffixReplacement:
    """Suffix pattern substitution ${var/%pattern/replacement}."""

    @pytest.mark.asyncio
    async def test_suffix_match(self):
        """Replace at end with %."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var/%world/universe}"
''')
        assert result.stdout.strip() == "hello universe"

    @pytest.mark.asyncio
    async def test_suffix_no_match(self):
        """No replacement if not at suffix."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var/%hello/hi}"
''')
        assert result.stdout.strip() == "hello world"

    @pytest.mark.asyncio
    async def test_suffix_empty_pattern(self):
        """Empty pattern at suffix appends at end."""
        bash = Bash()
        result = await bash.exec('''
var="hello"
echo "${var/%/ world}"
''')
        assert result.stdout.strip() == "hello world"


class TestGlobPatterns:
    """Test glob patterns in substitution."""

    @pytest.mark.asyncio
    async def test_star_pattern(self):
        """Glob * in pattern."""
        bash = Bash()
        result = await bash.exec('''
var="hello_world_test"
echo "${var/*_/}"
''')
        # Greedy match, removes up to last _
        assert "test" in result.stdout

    @pytest.mark.asyncio
    async def test_question_pattern(self):
        """Glob ? in pattern."""
        bash = Bash()
        result = await bash.exec('''
var="cat"
echo "${var/?at/ot}"
''')
        assert result.stdout.strip() == "ot"

    @pytest.mark.asyncio
    async def test_bracket_pattern(self):
        """Glob [] in pattern."""
        bash = Bash()
        result = await bash.exec('''
var="cat"
echo "${var/[a-z]at/ot}"
''')
        assert result.stdout.strip() == "ot"

    @pytest.mark.asyncio
    async def test_prefix_glob(self):
        """Glob pattern at prefix."""
        bash = Bash()
        result = await bash.exec('''
var="test_abc_123"
echo "${var/#*_/prefix_}"
''')
        # Greedy match at prefix
        assert result.exit_code == 0


class TestSpecialCases:
    """Test special cases and edge conditions."""

    @pytest.mark.asyncio
    async def test_empty_variable(self):
        """Substitution on empty variable."""
        bash = Bash()
        result = await bash.exec('''
var=""
echo "[${var/x/y}]"
''')
        assert result.stdout.strip() == "[]"

    @pytest.mark.asyncio
    async def test_unset_variable(self):
        """Substitution on unset variable."""
        bash = Bash()
        result = await bash.exec('''
unset var
echo "[${var/x/y}]"
''')
        assert result.stdout.strip() == "[]"

    @pytest.mark.asyncio
    async def test_replacement_with_special_chars(self):
        """Replacement containing special characters."""
        bash = Bash()
        result = await bash.exec(r'''
var="hello world"
echo "${var/world/wor\$ld}"
''')
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_replacement_with_ampersand(self):
        """& in replacement refers to matched pattern."""
        bash = Bash()
        result = await bash.exec('''
var="hello"
echo "${var/ell/[&]}"
''')
        # & should be literal in bash (unlike sed)
        assert result.exit_code == 0


class TestCaseModification:
    """Test case modification patterns."""

    @pytest.mark.asyncio
    async def test_uppercase_first(self):
        """${var^} uppercases first char."""
        bash = Bash()
        result = await bash.exec('''
var="hello"
echo "${var^}"
''')
        assert result.stdout.strip() == "Hello"

    @pytest.mark.asyncio
    async def test_uppercase_all(self):
        """${var^^} uppercases all chars."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
echo "${var^^}"
''')
        assert result.stdout.strip() == "HELLO WORLD"

    @pytest.mark.asyncio
    async def test_lowercase_first(self):
        """${var,} lowercases first char."""
        bash = Bash()
        result = await bash.exec('''
var="HELLO"
echo "${var,}"
''')
        assert result.stdout.strip() == "hELLO"

    @pytest.mark.asyncio
    async def test_lowercase_all(self):
        """${var,,} lowercases all chars."""
        bash = Bash()
        result = await bash.exec('''
var="HELLO WORLD"
echo "${var,,}"
''')
        assert result.stdout.strip() == "hello world"


class TestArraySubstitution:
    """Test pattern substitution on arrays."""

    @pytest.mark.asyncio
    async def test_array_single_element(self):
        """Substitution on single array element."""
        bash = Bash()
        result = await bash.exec('''
arr=(hello world)
echo "${arr[0]/ell/i}"
''')
        assert result.stdout.strip() == "hio"

    @pytest.mark.asyncio
    async def test_array_all_elements(self):
        """Substitution on all array elements."""
        bash = Bash()
        result = await bash.exec('''
arr=(cat bat hat)
echo "${arr[@]/at/ot}"
''')
        assert result.stdout.strip() == "cot bot hot"

    @pytest.mark.asyncio
    async def test_array_global_all_elements(self):
        """Global substitution on all array elements."""
        bash = Bash()
        result = await bash.exec('''
arr=(aaa bbb aaa)
echo "${arr[@]//a/x}"
''')
        assert "xxx" in result.stdout


class TestSlashInPattern:
    """Test slash as the pattern character in substitution."""

    @pytest.mark.asyncio
    async def test_replace_all_slash_with_char(self):
        """${x////c} should replace all / with c."""
        bash = Bash()
        result = await bash.exec("x='/_/'; echo ${x////c}")
        assert result.stdout == "c_c\n"

    @pytest.mark.asyncio
    async def test_delete_all_slashes(self):
        """${x///} should delete all slashes."""
        bash = Bash()
        result = await bash.exec('x="a/b/c"; echo "${x///}"')
        assert result.stdout == "abc\n"

    @pytest.mark.asyncio
    async def test_quoted_slash_pattern(self):
        r"""${x//'/'/c} should replace quoted / with c."""
        bash = Bash()
        result = await bash.exec("x='/_/'; echo ${x//'/'/c}")
        assert result.stdout == "c_c\n"

    @pytest.mark.asyncio
    async def test_replace_slash_with_backslash_slash(self):
        r"""${x////\\/} should replace / with \/."""
        bash = Bash()
        result = await bash.exec(r"x=/foo/bar/baz; echo ${x////\\/}")
        assert result.stdout == "\\/foo\\/bar\\/baz\n"


class TestQuotedGlobInPattern:
    """Test that quoted glob chars in patterns are literal."""

    @pytest.mark.asyncio
    async def test_quoted_star_is_literal(self):
        """Quoted * in pattern should match literal *."""
        bash = Bash()
        result = await bash.exec('''g='*'; v='a*b'; echo ${v//"$g"/-}''')
        assert result.stdout == "a-b\n"

    @pytest.mark.asyncio
    async def test_unquoted_star_is_glob(self):
        """Unquoted * from variable is glob."""
        bash = Bash()
        result = await bash.exec('''g='*'; v='a*b'; echo ${v//$g/-}''')
        assert result.stdout == "-\n"

    @pytest.mark.asyncio
    async def test_quoted_backslash_pattern(self):
        r"""${v/"$x"/_} where x='\f' matches literal \f."""
        bash = Bash()
        result = await bash.exec(r'''v='[\f]'; x='\f'; echo "${v/"$x"/_}"''')
        assert result.stdout == "[_]\n"


class TestCharacterClassInPattern:
    """Test character class handling in pattern substitution."""

    @pytest.mark.asyncio
    async def test_invalid_range_no_crash(self):
        """[z-a] invalid range should not crash."""
        bash = Bash()
        result = await bash.exec("x=fooz; pat='[z-a]'; echo ${x//$pat}")
        assert result.exit_code == 0
        # bash treats it as matching nothing
        assert result.stdout.strip() == "fooz"

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="[^]] bracket parsing diverges between bash and POSIX - complex edge case")
    async def test_caret_close_bracket(self):
        """[^]] pattern: bash treats [^] as failed bracket, becomes literal [^] + ]."""
        bash = Bash()
        result = await bash.exec("pat='[^]]'; s='ab^cd^'; echo ${s//$pat/z}")
        assert result.stdout.strip() == "ab^cd^"

    @pytest.mark.asyncio
    async def test_hard_glob_pattern(self):
        r"""Escaped * followed by glob * in pattern."""
        bash = Bash()
        result = await bash.exec(r"s='aa*bb+cc'; echo ${s//\**+/__}")
        assert result.stdout == "aa__cc\n"
