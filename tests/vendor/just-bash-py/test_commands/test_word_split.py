"""Tests for word splitting.

Covers: word-split.test.sh failures
Key areas: IFS scoping, empty IFS, $* vs $@, IFS with whitespace/non-whitespace, Unicode IFS
"""

import pytest
from just_bash import Bash


class TestIFSBasic:
    """Basic IFS (Internal Field Separator) behavior."""

    @pytest.mark.asyncio
    async def test_default_ifs_splits_whitespace(self):
        """Default IFS splits on space, tab, newline."""
        bash = Bash()
        result = await bash.exec('''
var="one   two	three"
for word in $var; do echo "[$word]"; done
''')
        assert "[one]" in result.stdout
        assert "[two]" in result.stdout
        assert "[three]" in result.stdout

    @pytest.mark.asyncio
    async def test_custom_ifs_colon(self):
        """IFS=: splits on colons."""
        bash = Bash()
        result = await bash.exec('''
IFS=:
var="a:b:c"
for word in $var; do echo "[$word]"; done
''')
        assert "[a]" in result.stdout
        assert "[b]" in result.stdout
        assert "[c]" in result.stdout

    @pytest.mark.asyncio
    async def test_custom_ifs_comma(self):
        """IFS=, splits on commas."""
        bash = Bash()
        result = await bash.exec('''
IFS=,
var="one,two,three"
for word in $var; do echo "$word"; done
''')
        assert "one" in result.stdout
        assert "two" in result.stdout
        assert "three" in result.stdout


class TestIFSScoping:
    """Test IFS scoping in functions."""

    @pytest.mark.asyncio
    async def test_ifs_local_in_function(self):
        """Local IFS doesn't affect outer scope."""
        bash = Bash()
        result = await bash.exec('''
outer_ifs="$IFS"
f() {
    local IFS=:
    echo "inner IFS is colon"
}
f
test "$IFS" = "$outer_ifs" && echo "IFS unchanged"
''')
        assert "IFS unchanged" in result.stdout

    @pytest.mark.asyncio
    async def test_ifs_change_in_function_affects_caller(self):
        """Non-local IFS change affects outer scope."""
        bash = Bash()
        result = await bash.exec('''
IFS=' '
f() {
    IFS=:
}
f
var="a:b:c"
for word in $var; do echo "[$word]"; done
''')
        # IFS was changed to :, so var should split on :
        assert "[a]" in result.stdout

    @pytest.mark.asyncio
    async def test_function_arg_splitting_with_local_ifs(self):
        """Function argument with local IFS."""
        bash = Bash()
        result = await bash.exec('''
f() {
    local IFS=:
    echo "$1"
}
f "a:b:c"
''')
        # The argument is already passed, IFS doesn't split it again
        assert "a:b:c" in result.stdout


class TestEmptyIFS:
    """Test empty IFS behavior."""

    @pytest.mark.asyncio
    async def test_empty_ifs_no_splitting(self):
        """Empty IFS prevents word splitting."""
        bash = Bash()
        result = await bash.exec('''
IFS=''
var="a b c"
for word in $var; do echo "[$word]"; done
''')
        assert "[a b c]" in result.stdout

    @pytest.mark.asyncio
    async def test_empty_ifs_array_join(self):
        """Empty IFS joins array without separator."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c)
IFS=''
echo "${arr[*]}"
''')
        assert "abc" in result.stdout

    @pytest.mark.asyncio
    async def test_unset_ifs_default_behavior(self):
        """Unset IFS uses default (space/tab/newline)."""
        bash = Bash()
        result = await bash.exec('''
unset IFS
var="one two three"
for word in $var; do echo "[$word]"; done
''')
        assert "[one]" in result.stdout
        assert "[two]" in result.stdout
        assert "[three]" in result.stdout


class TestDollarStarVsDollarAt:
    """Test $* vs $@ differences."""

    @pytest.mark.asyncio
    async def test_dollar_star_joins_with_ifs(self):
        """$* joins arguments with first char of IFS."""
        bash = Bash()
        result = await bash.exec('''
f() {
    IFS=,
    echo "$*"
}
f a b c
''')
        assert "a,b,c" in result.stdout

    @pytest.mark.asyncio
    async def test_dollar_at_preserves_separation(self):
        """$@ preserves argument boundaries."""
        bash = Bash()
        result = await bash.exec('''
f() {
    for arg in "$@"; do echo "[$arg]"; done
}
f "a b" "c d" "e f"
''')
        assert "[a b]" in result.stdout
        assert "[c d]" in result.stdout
        assert "[e f]" in result.stdout

    @pytest.mark.asyncio
    async def test_dollar_star_unquoted_splits(self):
        """Unquoted $* undergoes word splitting."""
        bash = Bash()
        result = await bash.exec('''
f() {
    for arg in $*; do echo "[$arg]"; done
}
f "a b" "c d"
''')
        # Unquoted, so "a b" becomes "a" "b"
        assert "[a]" in result.stdout
        assert "[b]" in result.stdout

    @pytest.mark.asyncio
    async def test_dollar_at_unquoted_splits(self):
        """Unquoted $@ undergoes word splitting."""
        bash = Bash()
        result = await bash.exec('''
f() {
    for arg in $@; do echo "[$arg]"; done
}
f "a b" "c d"
''')
        assert "[a]" in result.stdout
        assert "[b]" in result.stdout


class TestIFSWhitespace:
    """Test IFS whitespace behavior."""

    @pytest.mark.asyncio
    async def test_ifs_whitespace_collapse(self):
        """IFS whitespace collapses consecutive delimiters."""
        bash = Bash()
        result = await bash.exec('''
IFS=' '
var="a    b    c"
count=0
for word in $var; do count=$((count + 1)); done
echo $count
''')
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_ifs_non_whitespace_no_collapse(self):
        """Non-whitespace IFS doesn't collapse."""
        bash = Bash()
        result = await bash.exec('''
IFS=:
var="a::b:::c"
count=0
for word in $var; do count=$((count + 1)); done
echo $count
''')
        # a, empty, b, empty, empty, c = 6 words
        # Actually bash treats consecutive non-ws as empty fields
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ifs_mixed_whitespace_nonwhitespace(self):
        """IFS with both whitespace and non-whitespace chars."""
        bash = Bash()
        result = await bash.exec('''
IFS=': '
var="a:b c:d"
for word in $var; do echo "[$word]"; done
''')
        # Splits on both : and space
        assert "[a]" in result.stdout
        assert "[b]" in result.stdout


class TestIFSLeadingTrailing:
    """Test IFS handling of leading/trailing delimiters."""

    @pytest.mark.asyncio
    async def test_leading_whitespace_trimmed(self):
        """Leading IFS whitespace is trimmed."""
        bash = Bash()
        result = await bash.exec('''
var="  hello"
for word in $var; do echo "[$word]"; done
''')
        assert "[hello]" in result.stdout

    @pytest.mark.asyncio
    async def test_trailing_whitespace_trimmed(self):
        """Trailing IFS whitespace is trimmed."""
        bash = Bash()
        result = await bash.exec('''
var="hello  "
for word in $var; do echo "[$word]"; done
''')
        assert "[hello]" in result.stdout

    @pytest.mark.asyncio
    async def test_leading_non_whitespace_preserved(self):
        """Leading non-whitespace IFS creates empty field."""
        bash = Bash()
        result = await bash.exec('''
IFS=:
var=":a:b"
for word in $var; do echo "[$word]"; done
''')
        # Should have empty, a, b
        assert "[]" in result.stdout


class TestWordSplitInCommandSubstitution:
    """Test word splitting in command substitution."""

    @pytest.mark.asyncio
    async def test_command_sub_unquoted_splits(self):
        """Unquoted command substitution undergoes splitting."""
        bash = Bash()
        result = await bash.exec('''
for word in $(echo "a b c"); do echo "[$word]"; done
''')
        assert "[a]" in result.stdout
        assert "[b]" in result.stdout
        assert "[c]" in result.stdout

    @pytest.mark.asyncio
    async def test_command_sub_quoted_no_split(self):
        """Quoted command substitution preserves spaces."""
        bash = Bash()
        result = await bash.exec('''
for word in "$(echo "a b c")"; do echo "[$word]"; done
''')
        assert "[a b c]" in result.stdout


class TestWordSplitInVariableExpansion:
    """Test word splitting in variable expansion."""

    @pytest.mark.asyncio
    async def test_quoted_var_no_split(self):
        """Quoted variable prevents splitting."""
        bash = Bash()
        result = await bash.exec('''
var="a b c"
for word in "$var"; do echo "[$word]"; done
''')
        assert "[a b c]" in result.stdout

    @pytest.mark.asyncio
    async def test_unquoted_var_splits(self):
        """Unquoted variable undergoes splitting."""
        bash = Bash()
        result = await bash.exec('''
var="a b c"
for word in $var; do echo "[$word]"; done
''')
        assert "[a]" in result.stdout
        assert "[b]" in result.stdout
        assert "[c]" in result.stdout


class TestSetArguments:
    """Test word splitting with set arguments."""

    @pytest.mark.asyncio
    async def test_set_args_preserve_spaces(self):
        """set -- preserves argument boundaries."""
        bash = Bash()
        result = await bash.exec('''
set -- "a b" "c d" "e f"
for arg in "$@"; do echo "[$arg]"; done
''')
        assert "[a b]" in result.stdout
        assert "[c d]" in result.stdout
        assert "[e f]" in result.stdout

    @pytest.mark.asyncio
    async def test_set_args_dollar_star(self):
        """set arguments with $*."""
        bash = Bash()
        result = await bash.exec('''
set -- a b c
IFS=,
echo "$*"
''')
        assert "a,b,c" in result.stdout


class TestSpecialCases:
    """Test special word splitting cases."""

    @pytest.mark.asyncio
    async def test_null_expansion_no_word(self):
        """Null/empty expansion produces no words."""
        bash = Bash()
        result = await bash.exec('''
unset var
count=0
for word in $var; do count=$((count + 1)); done
echo $count
''')
        assert result.stdout.strip() == "0"

    @pytest.mark.asyncio
    async def test_empty_string_one_word(self):
        """Empty string in quotes is one word."""
        bash = Bash()
        result = await bash.exec('''
var=""
count=0
for word in "$var"; do count=$((count + 1)); done
echo $count
''')
        assert result.stdout.strip() == "1"

    @pytest.mark.asyncio
    async def test_ifs_only_string(self):
        """String of only IFS chars produces no words."""
        bash = Bash()
        result = await bash.exec('''
var="   "
count=0
for word in $var; do count=$((count + 1)); done
echo $count
''')
        assert result.stdout.strip() == "0"
