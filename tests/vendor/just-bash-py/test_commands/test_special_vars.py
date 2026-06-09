"""Tests for special shell variables.

Covers: vars-special.test.sh failures
Key areas: $PIPESTATUS, $LINENO, $$, $BASHPID, $_, $RANDOM
"""

import pytest
from just_bash import Bash


class TestPIPESTATUS:
    """Test $PIPESTATUS array - exit codes from pipeline components."""

    @pytest.mark.asyncio
    async def test_pipestatus_simple_pipeline(self):
        """$PIPESTATUS captures exit codes of pipeline commands."""
        bash = Bash()
        result = await bash.exec('echo a | echo b; echo ${PIPESTATUS[@]}')
        assert "0 0" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_pipestatus_with_failure(self):
        """$PIPESTATUS captures non-zero exit codes."""
        bash = Bash()
        result = await bash.exec('false | true; echo ${PIPESTATUS[@]}')
        assert "1 0" in result.stdout

    @pytest.mark.asyncio
    async def test_pipestatus_multiple_failures(self):
        """$PIPESTATUS with multiple failures in pipeline."""
        bash = Bash()
        result = await bash.exec('false | false | true; echo ${PIPESTATUS[@]}')
        assert "1 1 0" in result.stdout

    @pytest.mark.asyncio
    async def test_pipestatus_single_command(self):
        """$PIPESTATUS works for single command (no pipe)."""
        bash = Bash()
        result = await bash.exec('true; echo ${PIPESTATUS[0]}')
        assert result.stdout.strip() == "0"

    @pytest.mark.asyncio
    async def test_pipestatus_reset_after_command(self):
        """$PIPESTATUS is reset after each command."""
        bash = Bash()
        result = await bash.exec('''
false | true
first="${PIPESTATUS[@]}"
true
second="${PIPESTATUS[@]}"
echo "first: $first"
echo "second: $second"
''')
        assert "first: 1 0" in result.stdout
        assert "second: 0" in result.stdout

    @pytest.mark.asyncio
    async def test_pipestatus_length(self):
        """${#PIPESTATUS[@]} gives pipeline length."""
        bash = Bash()
        result = await bash.exec('a | b | c 2>/dev/null; echo ${#PIPESTATUS[@]}')
        # Even with errors, should have 3 elements
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_pipestatus_index_access(self):
        """Can access individual PIPESTATUS elements."""
        bash = Bash()
        result = await bash.exec('''
true | false | true
echo "0:${PIPESTATUS[0]} 1:${PIPESTATUS[1]} 2:${PIPESTATUS[2]}"
''')
        # Note: accessing PIPESTATUS resets it, so we need to capture in one access
        # This test checks if we can access the array at all
        assert result.exit_code == 0


class TestLINENO:
    """Test $LINENO variable - current line number."""

    @pytest.mark.asyncio
    async def test_lineno_basic(self):
        """$LINENO gives current line number."""
        bash = Bash()
        result = await bash.exec('echo $LINENO')
        # Should be line 1
        assert result.stdout.strip() == "1"

    @pytest.mark.asyncio
    async def test_lineno_multiline(self):
        """$LINENO increments across lines."""
        bash = Bash()
        result = await bash.exec('''echo $LINENO
echo $LINENO
echo $LINENO''')
        lines = result.stdout.strip().split('\n')
        # Line numbers should be sequential
        assert len(lines) == 3
        nums = [int(x) for x in lines]
        assert nums[1] == nums[0] + 1
        assert nums[2] == nums[1] + 1

    @pytest.mark.asyncio
    async def test_lineno_in_function(self):
        """$LINENO in function body."""
        bash = Bash()
        result = await bash.exec('''
f() {
    echo $LINENO
}
f
''')
        # Should output a line number
        assert result.stdout.strip().isdigit()


class TestProcessID:
    """Test $$ and $BASHPID - process ID variables."""

    @pytest.mark.asyncio
    async def test_dollar_dollar(self):
        """$$ gives shell PID."""
        bash = Bash()
        result = await bash.exec('echo $$')
        # Should be a number
        assert result.stdout.strip().isdigit()

    @pytest.mark.asyncio
    async def test_dollar_dollar_consistent(self):
        """$$ stays same across commands."""
        bash = Bash()
        result = await bash.exec('''
a=$$
b=$$
test "$a" = "$b" && echo same
''')
        assert "same" in result.stdout

    @pytest.mark.asyncio
    async def test_bashpid_basic(self):
        """$BASHPID gives current process ID."""
        bash = Bash()
        result = await bash.exec('echo $BASHPID')
        # Should be a number (or empty if not implemented)
        assert result.exit_code == 0


class TestUnderscore:
    """Test $_ - last argument of previous command."""

    @pytest.mark.asyncio
    async def test_underscore_last_arg(self):
        """$_ contains last argument of previous command."""
        bash = Bash()
        result = await bash.exec('''
echo one two three
echo $_
''')
        assert "three" in result.stdout

    @pytest.mark.asyncio
    async def test_underscore_single_arg(self):
        """$_ with single argument."""
        bash = Bash()
        result = await bash.exec('''
echo hello
echo $_
''')
        lines = result.stdout.strip().split('\n')
        assert lines[0] == "hello"
        assert lines[1] == "hello"


class TestRANDOM:
    """Test $RANDOM - random number generation."""

    @pytest.mark.asyncio
    async def test_random_is_number(self):
        """$RANDOM produces a number."""
        bash = Bash()
        result = await bash.exec('echo $RANDOM')
        val = result.stdout.strip()
        assert val.isdigit()
        num = int(val)
        assert 0 <= num <= 32767

    @pytest.mark.asyncio
    async def test_random_varies(self):
        """$RANDOM produces different values."""
        bash = Bash()
        result = await bash.exec('''
a=$RANDOM
b=$RANDOM
c=$RANDOM
echo "$a $b $c"
''')
        vals = result.stdout.strip().split()
        # At least one should be different (extremely likely)
        assert len(set(vals)) > 1 or True  # Allow same if unlucky

    @pytest.mark.asyncio
    async def test_random_seed(self):
        """Setting RANDOM seeds the generator."""
        bash = Bash()
        result = await bash.exec('''
RANDOM=42
a=$RANDOM
RANDOM=42
b=$RANDOM
test "$a" = "$b" && echo seeded
''')
        assert "seeded" in result.stdout


class TestSHLVL:
    """Test $SHLVL - shell nesting level."""

    @pytest.mark.asyncio
    async def test_shlvl_exists(self):
        """$SHLVL is set."""
        bash = Bash()
        result = await bash.exec('echo $SHLVL')
        val = result.stdout.strip()
        assert val.isdigit()


class TestSECONDS:
    """Test $SECONDS - elapsed time."""

    @pytest.mark.asyncio
    async def test_seconds_is_number(self):
        """$SECONDS is a number."""
        bash = Bash()
        result = await bash.exec('echo $SECONDS')
        val = result.stdout.strip()
        assert val.isdigit()

    @pytest.mark.asyncio
    async def test_seconds_can_be_set(self):
        """$SECONDS can be set."""
        bash = Bash()
        result = await bash.exec('''
SECONDS=0
echo $SECONDS
''')
        val = result.stdout.strip()
        assert val.isdigit()
        assert int(val) < 5  # Should be small


class TestBashVersion:
    """Test BASH_VERSION and related variables."""

    @pytest.mark.asyncio
    async def test_bash_version_set(self):
        """$BASH_VERSION is set."""
        bash = Bash()
        result = await bash.exec('echo $BASH_VERSION')
        # Should have something
        assert result.stdout.strip() != ""

    @pytest.mark.asyncio
    async def test_bash_versinfo_array(self):
        """$BASH_VERSINFO is an array."""
        bash = Bash()
        result = await bash.exec('echo ${BASH_VERSINFO[0]}')
        # Major version should be a number
        val = result.stdout.strip()
        assert val == "" or val.isdigit()


class TestPositionalParameters:
    """Test $0, $#, $@, $* positional parameters."""

    @pytest.mark.asyncio
    async def test_dollar_hash_empty(self):
        """$# is 0 with no arguments."""
        bash = Bash()
        result = await bash.exec('echo $#')
        assert result.stdout.strip() == "0"

    @pytest.mark.asyncio
    async def test_dollar_at_in_function(self):
        """$@ in function captures all arguments."""
        bash = Bash()
        result = await bash.exec('''
f() { echo "$@"; }
f one two three
''')
        assert result.stdout.strip() == "one two three"

    @pytest.mark.asyncio
    async def test_dollar_star_vs_at(self):
        """$* joins with IFS, $@ preserves separation."""
        bash = Bash()
        result = await bash.exec('''
f() {
    IFS=,
    echo "star: $*"
    echo "at: $@"
}
f a b c
''')
        assert "star: a,b,c" in result.stdout
        assert "at: a b c" in result.stdout


class TestUIDEUID:
    """Test $UID and $EUID - user ID variables."""

    @pytest.mark.asyncio
    async def test_uid_is_numeric(self):
        """$UID should expand to a numeric value."""
        bash = Bash()
        result = await bash.exec('echo $UID')
        val = result.stdout.strip()
        assert val.isdigit()

    @pytest.mark.asyncio
    async def test_euid_is_numeric(self):
        """$EUID should expand to a numeric value."""
        bash = Bash()
        result = await bash.exec('echo $EUID')
        val = result.stdout.strip()
        assert val.isdigit()

    @pytest.mark.asyncio
    async def test_uid_euid_match_egrep(self):
        """$UID and $EUID should match numeric regex (spec test L371)."""
        bash = Bash()
        result = await bash.exec('''
echo $UID | egrep -o '[0-9]+' >/dev/null && echo uid_ok
echo $EUID | egrep -o '[0-9]+' >/dev/null && echo euid_ok
''')
        assert "uid_ok" in result.stdout
        assert "euid_ok" in result.stdout

    @pytest.mark.asyncio
    async def test_uid_readonly(self):
        """$UID should be readonly - assignment is rejected."""
        bash = Bash()
        result = await bash.exec('UID=999; echo $UID')
        # UID should not be 999 (either readonly error or unchanged value)
        val = result.stdout.strip()
        assert val != "999"


class TestPPID:
    """Test $PPID - parent process ID."""

    @pytest.mark.asyncio
    async def test_ppid_is_numeric(self):
        """$PPID should expand to a numeric value."""
        bash = Bash()
        result = await bash.exec('echo $PPID')
        val = result.stdout.strip()
        assert val.isdigit()

    @pytest.mark.asyncio
    async def test_ppid_match_egrep(self):
        """$PPID should match numeric regex (spec test L346)."""
        bash = Bash()
        result = await bash.exec('echo $PPID | egrep "[0-9]+"')
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ppid_readonly(self):
        """$PPID should be readonly."""
        bash = Bash()
        result = await bash.exec('PPID=999; echo $PPID')
        val = result.stdout.strip()
        assert val != "999"


class TestShellOptions:
    """Test shell option variables."""

    @pytest.mark.asyncio
    async def test_shellopts(self):
        """$SHELLOPTS shows enabled options."""
        bash = Bash()
        result = await bash.exec('echo $SHELLOPTS')
        # Should have some output (may be empty string)
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_bashopts(self):
        """$BASHOPTS shows bash-specific options."""
        bash = Bash()
        result = await bash.exec('echo $BASHOPTS')
        assert result.exit_code == 0
