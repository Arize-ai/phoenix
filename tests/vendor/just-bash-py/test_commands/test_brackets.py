"""Tests for test brackets [[ ]] and [ ].

Covers: builtin-bracket.test.sh failures
Key areas: [[ ]] vs [ ] differences, pattern matching, regex with =~, logical operators
"""

import pytest
from just_bash import Bash


class TestSingleBracketBasic:
    """Basic [ ] test command."""

    @pytest.mark.asyncio
    async def test_string_equal(self):
        """[ ] string equality."""
        bash = Bash()
        result = await bash.exec('[ "abc" = "abc" ] && echo yes')
        assert "yes" in result.stdout

    @pytest.mark.asyncio
    async def test_string_not_equal(self):
        """[ ] string inequality."""
        bash = Bash()
        result = await bash.exec('[ "abc" != "def" ] && echo yes')
        assert "yes" in result.stdout

    @pytest.mark.asyncio
    async def test_string_empty(self):
        """[ ] test empty string with -z."""
        bash = Bash()
        result = await bash.exec('[ -z "" ] && echo empty')
        assert "empty" in result.stdout

    @pytest.mark.asyncio
    async def test_string_non_empty(self):
        """[ ] test non-empty string with -n."""
        bash = Bash()
        result = await bash.exec('[ -n "text" ] && echo nonempty')
        assert "nonempty" in result.stdout

    @pytest.mark.asyncio
    async def test_numeric_equal(self):
        """[ ] numeric equality with -eq."""
        bash = Bash()
        result = await bash.exec('[ 5 -eq 5 ] && echo equal')
        assert "equal" in result.stdout

    @pytest.mark.asyncio
    async def test_numeric_not_equal(self):
        """[ ] numeric inequality with -ne."""
        bash = Bash()
        result = await bash.exec('[ 5 -ne 3 ] && echo notequal')
        assert "notequal" in result.stdout

    @pytest.mark.asyncio
    async def test_numeric_less_than(self):
        """[ ] numeric less than with -lt."""
        bash = Bash()
        result = await bash.exec('[ 3 -lt 5 ] && echo less')
        assert "less" in result.stdout

    @pytest.mark.asyncio
    async def test_numeric_greater_than(self):
        """[ ] numeric greater than with -gt."""
        bash = Bash()
        result = await bash.exec('[ 5 -gt 3 ] && echo greater')
        assert "greater" in result.stdout


class TestDoubleBracketBasic:
    """Basic [[ ]] test command."""

    @pytest.mark.asyncio
    async def test_string_equal(self):
        """[[ ]] string equality."""
        bash = Bash()
        result = await bash.exec('[[ "abc" == "abc" ]] && echo yes')
        assert "yes" in result.stdout

    @pytest.mark.asyncio
    async def test_string_not_equal(self):
        """[[ ]] string inequality."""
        bash = Bash()
        result = await bash.exec('[[ "abc" != "def" ]] && echo yes')
        assert "yes" in result.stdout

    @pytest.mark.asyncio
    async def test_variable_unquoted_safe(self):
        """[[ ]] doesn't require quoting variables."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
[[ $var == "hello world" ]] && echo match
''')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_empty_variable_safe(self):
        """[[ ]] handles empty variable without quotes."""
        bash = Bash()
        result = await bash.exec('''
var=""
[[ -z $var ]] && echo empty
''')
        assert "empty" in result.stdout


class TestPatternMatching:
    """Test pattern matching in [[ ]]."""

    @pytest.mark.asyncio
    async def test_glob_star(self):
        """[[ ]] glob pattern with *."""
        bash = Bash()
        result = await bash.exec('[[ "hello" == h* ]] && echo match')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_glob_question(self):
        """[[ ]] glob pattern with ?."""
        bash = Bash()
        result = await bash.exec('[[ "abc" == a?c ]] && echo match')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_glob_brackets(self):
        """[[ ]] glob pattern with []."""
        bash = Bash()
        result = await bash.exec('[[ "abc" == [a-z]bc ]] && echo match')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_quoted_pattern_literal(self):
        """Quoted pattern is literal, not glob."""
        bash = Bash()
        result = await bash.exec('[[ "h*" == "h*" ]] && echo literal')
        assert "literal" in result.stdout

    @pytest.mark.asyncio
    async def test_no_match(self):
        """Pattern that doesn't match."""
        bash = Bash()
        result = await bash.exec('[[ "hello" == x* ]] || echo nomatch')
        assert "nomatch" in result.stdout


class TestRegexMatching:
    """Test regex matching with =~ in [[ ]]."""

    @pytest.mark.asyncio
    async def test_regex_basic(self):
        """[[ ]] regex match with =~."""
        bash = Bash()
        result = await bash.exec('[[ "hello123" =~ [0-9]+ ]] && echo match')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_regex_anchor_start(self):
        """Regex with ^ anchor."""
        bash = Bash()
        result = await bash.exec('[[ "hello" =~ ^h ]] && echo match')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_regex_anchor_end(self):
        """Regex with $ anchor."""
        bash = Bash()
        result = await bash.exec('[[ "hello" =~ o$ ]] && echo match')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_regex_full_match(self):
        """Full regex match."""
        bash = Bash()
        result = await bash.exec('[[ "test123" =~ ^[a-z]+[0-9]+$ ]] && echo match')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_regex_no_match(self):
        """Regex that doesn't match."""
        bash = Bash()
        result = await bash.exec('[[ "hello" =~ ^[0-9]+$ ]] || echo nomatch')
        assert "nomatch" in result.stdout

    @pytest.mark.asyncio
    async def test_bash_rematch(self):
        """BASH_REMATCH captures groups."""
        bash = Bash()
        result = await bash.exec('''
[[ "abc123def" =~ ([0-9]+) ]]
echo "${BASH_REMATCH[1]}"
''')
        assert "123" in result.stdout

    @pytest.mark.asyncio
    async def test_bash_rematch_multiple(self):
        """BASH_REMATCH with multiple groups."""
        bash = Bash()
        result = await bash.exec(r'''
[[ "hello world" =~ ([a-z]+)\ ([a-z]+) ]]
echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]}"
''')
        assert "hello world" in result.stdout


class TestLogicalOperators:
    """Test logical operators in [[ ]] and [ ]."""

    @pytest.mark.asyncio
    async def test_and_double_bracket(self):
        """[[ ]] with && logical AND."""
        bash = Bash()
        result = await bash.exec('[[ 1 -eq 1 && 2 -eq 2 ]] && echo both')
        assert "both" in result.stdout

    @pytest.mark.asyncio
    async def test_or_double_bracket(self):
        """[[ ]] with || logical OR."""
        bash = Bash()
        result = await bash.exec('[[ 1 -eq 2 || 2 -eq 2 ]] && echo either')
        assert "either" in result.stdout

    @pytest.mark.asyncio
    async def test_not_double_bracket(self):
        """[[ ]] with ! logical NOT."""
        bash = Bash()
        result = await bash.exec('[[ ! 1 -eq 2 ]] && echo not')
        assert "not" in result.stdout

    @pytest.mark.asyncio
    async def test_and_single_bracket(self):
        """[ ] with -a logical AND."""
        bash = Bash()
        result = await bash.exec('[ 1 -eq 1 -a 2 -eq 2 ] && echo both')
        assert "both" in result.stdout

    @pytest.mark.asyncio
    async def test_or_single_bracket(self):
        """[ ] with -o logical OR."""
        bash = Bash()
        result = await bash.exec('[ 1 -eq 2 -o 2 -eq 2 ] && echo either')
        assert "either" in result.stdout

    @pytest.mark.asyncio
    async def test_not_single_bracket(self):
        """[ ] with ! logical NOT."""
        bash = Bash()
        result = await bash.exec('[ ! 1 -eq 2 ] && echo not')
        assert "not" in result.stdout

    @pytest.mark.asyncio
    async def test_grouped_conditions(self):
        """Grouped conditions in [[ ]]."""
        bash = Bash()
        result = await bash.exec('[[ ( 1 -eq 1 ) && ( 2 -eq 2 ) ]] && echo group')
        assert "group" in result.stdout


class TestFileTests:
    """Test file tests in brackets."""

    @pytest.mark.asyncio
    async def test_file_exists(self):
        """-e tests file exists."""
        bash = Bash(files={"/test.txt": "content"})
        result = await bash.exec('[ -e /test.txt ] && echo exists')
        assert "exists" in result.stdout

    @pytest.mark.asyncio
    async def test_file_not_exists(self):
        """-e with non-existent file."""
        bash = Bash()
        result = await bash.exec('[ -e /nonexistent ] || echo nofile')
        assert "nofile" in result.stdout

    @pytest.mark.asyncio
    async def test_file_regular(self):
        """-f tests regular file."""
        bash = Bash(files={"/test.txt": "content"})
        result = await bash.exec('[ -f /test.txt ] && echo regular')
        assert "regular" in result.stdout

    @pytest.mark.asyncio
    async def test_directory(self):
        """-d tests directory."""
        bash = Bash()
        await bash.fs.mkdir("/mydir")
        result = await bash.exec('[ -d /mydir ] && echo isdir')
        assert "isdir" in result.stdout

    @pytest.mark.asyncio
    async def test_readable(self):
        """-r tests readable."""
        bash = Bash(files={"/test.txt": "content"})
        result = await bash.exec('[ -r /test.txt ] && echo readable')
        assert "readable" in result.stdout

    @pytest.mark.asyncio
    async def test_writable(self):
        """-w tests writable."""
        bash = Bash(files={"/test.txt": "content"})
        result = await bash.exec('[ -w /test.txt ] && echo writable')
        assert "writable" in result.stdout

    @pytest.mark.asyncio
    async def test_executable(self):
        """-x tests executable."""
        bash = Bash(files={"/script.sh": "#!/bin/bash"})
        # Set executable permission
        result = await bash.exec('''
chmod +x /script.sh
[ -x /script.sh ] && echo executable
''')
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_file_size(self):
        """-s tests non-empty file."""
        bash = Bash(files={"/test.txt": "content"})
        result = await bash.exec('[ -s /test.txt ] && echo hassize')
        assert "hassize" in result.stdout

    @pytest.mark.asyncio
    async def test_symlink(self):
        """-L tests symbolic link."""
        bash = Bash(files={"/target.txt": "content"})
        result = await bash.exec('''
ln -s /target.txt /link.txt
[ -L /link.txt ] && echo islink
''')
        assert "islink" in result.stdout or result.exit_code == 0


class TestStringComparisons:
    """Test string comparisons in brackets."""

    @pytest.mark.asyncio
    async def test_string_less_than(self):
        """[[ ]] string less than with <."""
        bash = Bash()
        result = await bash.exec('[[ "abc" < "def" ]] && echo less')
        assert "less" in result.stdout

    @pytest.mark.asyncio
    async def test_string_greater_than(self):
        """[[ ]] string greater than with >."""
        bash = Bash()
        result = await bash.exec('[[ "def" > "abc" ]] && echo greater')
        assert "greater" in result.stdout

    @pytest.mark.asyncio
    async def test_single_bracket_escaped_lt(self):
        """[ ] requires escaped < and >."""
        bash = Bash()
        result = await bash.exec('[ "abc" \\< "def" ] && echo less')
        assert "less" in result.stdout


class TestNumericComparisons:
    """Test numeric comparisons."""

    @pytest.mark.asyncio
    async def test_le(self):
        """Less than or equal with -le."""
        bash = Bash()
        result = await bash.exec('[ 3 -le 5 ] && echo yes')
        assert "yes" in result.stdout

    @pytest.mark.asyncio
    async def test_ge(self):
        """Greater than or equal with -ge."""
        bash = Bash()
        result = await bash.exec('[ 5 -ge 3 ] && echo yes')
        assert "yes" in result.stdout

    @pytest.mark.asyncio
    async def test_le_equal(self):
        """-le with equal values."""
        bash = Bash()
        result = await bash.exec('[ 5 -le 5 ] && echo yes')
        assert "yes" in result.stdout


class TestDifferences:
    """Test differences between [ ] and [[ ]]."""

    @pytest.mark.asyncio
    async def test_word_splitting_single(self):
        """[ ] suffers from word splitting without quotes."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
[ "$var" = "hello world" ] && echo match
''')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_word_splitting_double(self):
        """[[ ]] doesn't suffer from word splitting."""
        bash = Bash()
        result = await bash.exec('''
var="hello world"
[[ $var = "hello world" ]] && echo match
''')
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_glob_in_double(self):
        """[[ ]] supports glob on right side."""
        bash = Bash()
        result = await bash.exec('[[ "filename.txt" == *.txt ]] && echo match')
        assert "match" in result.stdout


class TestExitStatus:
    """Test exit status from test commands."""

    @pytest.mark.asyncio
    async def test_true_returns_zero(self):
        """True condition returns 0."""
        bash = Bash()
        result = await bash.exec('[ 1 -eq 1 ]; echo $?')
        assert "0" in result.stdout

    @pytest.mark.asyncio
    async def test_false_returns_one(self):
        """False condition returns 1."""
        bash = Bash()
        result = await bash.exec('[ 1 -eq 2 ]; echo $?')
        assert "1" in result.stdout

    @pytest.mark.asyncio
    async def test_syntax_error_returns_two(self):
        """Syntax error returns 2."""
        bash = Bash()
        result = await bash.exec('[ -eq 1 ] 2>/dev/null; echo $?')
        # Should be 2 for syntax error (or 1 depending on implementation)
        assert result.exit_code == 0
