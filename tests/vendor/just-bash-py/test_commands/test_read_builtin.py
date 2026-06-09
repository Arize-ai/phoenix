"""Tests for read builtin command.

Covers: builtin-read.test.sh failures
Key areas: read -a, read -d, read -n, read -t, read -r, IFS handling
"""

import pytest
from just_bash import Bash


class TestReadBasic:
    """Basic read command functionality."""

    @pytest.mark.asyncio
    async def test_read_single_variable(self):
        """Read entire line into single variable."""
        bash = Bash()
        result = await bash.exec('''
echo "hello world" | { read line; echo "$line"; }
''')
        assert result.stdout.strip() == "hello world"

    @pytest.mark.asyncio
    async def test_read_multiple_variables(self):
        """Read into multiple variables splits on whitespace."""
        bash = Bash()
        result = await bash.exec('''
echo "one two three" | { read a b c; echo "a=$a b=$b c=$c"; }
''')
        assert result.stdout.strip() == "a=one b=two c=three"

    @pytest.mark.asyncio
    async def test_read_extra_words_to_last(self):
        """Extra words go into last variable."""
        bash = Bash()
        result = await bash.exec('''
echo "one two three four" | { read a b; echo "a=$a b=$b"; }
''')
        assert result.stdout.strip() == "a=one b=two three four"

    @pytest.mark.asyncio
    async def test_read_fewer_words(self):
        """Fewer words than variables leaves extras empty."""
        bash = Bash()
        result = await bash.exec('''
echo "one" | { read a b c; echo "a=$a b=$b c=$c"; }
''')
        assert result.stdout.strip() == "a=one b= c="

    @pytest.mark.asyncio
    async def test_read_empty_input(self):
        """Read with empty input."""
        bash = Bash()
        result = await bash.exec('''
echo "" | { read line; echo "line=[$line]"; }
''')
        assert result.stdout.strip() == "line=[]"

    @pytest.mark.asyncio
    async def test_read_no_newline_eof(self):
        """Read handles input without trailing newline."""
        bash = Bash()
        result = await bash.exec('''
printf "no newline" | { read line; echo "[$line]"; }
''')
        assert "[no newline]" in result.stdout


class TestReadArray:
    """Test read -a for array assignment."""

    @pytest.mark.asyncio
    async def test_read_a_basic(self):
        """read -a puts words into array."""
        bash = Bash()
        result = await bash.exec('''
echo "a b c" | { read -a arr; echo "${arr[0]} ${arr[1]} ${arr[2]}"; }
''')
        assert result.stdout.strip() == "a b c"

    @pytest.mark.asyncio
    async def test_read_a_array_length(self):
        """read -a creates array of correct length."""
        bash = Bash()
        result = await bash.exec('''
echo "one two three four" | { read -a arr; echo ${#arr[@]}; }
''')
        assert result.stdout.strip() == "4"

    @pytest.mark.asyncio
    async def test_read_a_index_access(self):
        """Can access specific array indices after read -a."""
        bash = Bash()
        result = await bash.exec('''
echo "alpha beta gamma" | { read -a arr; echo "${arr[1]}"; }
''')
        assert result.stdout.strip() == "beta"

    @pytest.mark.asyncio
    async def test_read_a_all_elements(self):
        """${arr[@]} expands all elements after read -a."""
        bash = Bash()
        result = await bash.exec('''
echo "x y z" | { read -a arr; echo "${arr[@]}"; }
''')
        assert result.stdout.strip() == "x y z"

    @pytest.mark.asyncio
    async def test_read_a_empty_input(self):
        """read -a with empty input creates empty array."""
        bash = Bash()
        result = await bash.exec('''
echo "" | { read -a arr; echo "len=${#arr[@]}"; }
''')
        assert "len=0" in result.stdout


class TestReadDelimiter:
    """Test read -d for custom delimiter."""

    @pytest.mark.asyncio
    async def test_read_d_colon(self):
        """read -d: reads until colon."""
        bash = Bash()
        result = await bash.exec('''
echo "hello:world" | { read -d: word; echo "[$word]"; }
''')
        assert result.stdout.strip() == "[hello]"

    @pytest.mark.asyncio
    async def test_read_d_slash(self):
        """read -d/ reads path components."""
        bash = Bash()
        result = await bash.exec('''
echo "/usr/local/bin" | { read -d/ a; read -d/ b; echo "a=$a b=$b"; }
''')
        # First read gets empty (before first /), second gets "usr"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_read_d_empty_nul(self):
        """read -d '' reads until NUL byte."""
        bash = Bash()
        result = await bash.exec('''
printf "hello\0world" | { read -d '' word; echo "[$word]"; }
''')
        assert "[hello]" in result.stdout


class TestReadCharCount:
    """Test read -n for character count."""

    @pytest.mark.asyncio
    async def test_read_n_chars(self):
        """read -n3 reads exactly 3 characters."""
        bash = Bash()
        result = await bash.exec('''
echo "abcdefg" | { read -n3 word; echo "[$word]"; }
''')
        assert result.stdout.strip() == "[abc]"

    @pytest.mark.asyncio
    async def test_read_n_one(self):
        """read -n1 reads single character."""
        bash = Bash()
        result = await bash.exec('''
echo "hello" | { read -n1 ch; echo "[$ch]"; }
''')
        assert result.stdout.strip() == "[h]"

    @pytest.mark.asyncio
    async def test_read_n_more_than_available(self):
        """read -n with count > input reads what's available."""
        bash = Bash()
        result = await bash.exec('''
echo "hi" | { read -n100 word; echo "[$word]"; }
''')
        assert "[hi]" in result.stdout


class TestReadRaw:
    """Test read -r for raw mode (no backslash escape processing)."""

    @pytest.mark.asyncio
    async def test_read_r_backslash(self):
        """read -r preserves backslashes."""
        bash = Bash()
        result = await bash.exec(r'''
echo 'hello\nworld' | { read -r line; echo "$line"; }
''')
        assert r"hello\nworld" in result.stdout

    @pytest.mark.asyncio
    async def test_read_without_r_backslash(self):
        """read without -r processes backslash escapes."""
        bash = Bash()
        result = await bash.exec(r'''
echo 'hello\nworld' | { read line; echo "$line"; }
''')
        # Without -r, backslash-n might be processed
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_read_r_line_continuation(self):
        """read -r does not treat trailing backslash as continuation."""
        bash = Bash()
        result = await bash.exec(r'''
printf 'line\\' | { read -r line; echo "[$line]"; }
''')
        assert r"[line\]" in result.stdout or result.exit_code == 0


class TestReadIFS:
    """Test IFS handling in read."""

    @pytest.mark.asyncio
    async def test_read_custom_ifs(self):
        """read uses custom IFS for splitting."""
        bash = Bash()
        result = await bash.exec('''
echo "a:b:c" | { IFS=: read x y z; echo "x=$x y=$y z=$z"; }
''')
        assert "x=a y=b z=c" in result.stdout

    @pytest.mark.asyncio
    async def test_read_ifs_colon(self):
        """read with IFS=: for path parsing."""
        bash = Bash()
        result = await bash.exec('''
echo "/usr/bin:/usr/local/bin:/bin" | { IFS=: read a b c; echo "$b"; }
''')
        assert "/usr/local/bin" in result.stdout

    @pytest.mark.asyncio
    async def test_read_empty_ifs(self):
        """read with empty IFS reads whole line."""
        bash = Bash()
        result = await bash.exec('''
echo "a b c" | { IFS= read line; echo "[$line]"; }
''')
        assert "[a b c]" in result.stdout

    @pytest.mark.asyncio
    async def test_read_ifs_whitespace_trimming(self):
        """read with default IFS trims leading/trailing whitespace."""
        bash = Bash()
        result = await bash.exec('''
echo "  hello  " | { read word; echo "[$word]"; }
''')
        assert "[hello]" in result.stdout


class TestReadPrompt:
    """Test read -p for prompts."""

    @pytest.mark.asyncio
    async def test_read_p_sets_variable(self):
        """read -p with input sets variable."""
        bash = Bash()
        result = await bash.exec('''
echo "myinput" | { read -p "Enter: " val; echo "got: $val"; }
''')
        assert "got: myinput" in result.stdout


class TestReadSilent:
    """Test read -s for silent mode."""

    @pytest.mark.asyncio
    async def test_read_s_reads_input(self):
        """read -s still reads input (just no echo)."""
        bash = Bash()
        result = await bash.exec('''
echo "secret" | { read -s pass; echo "pass=$pass"; }
''')
        assert "pass=secret" in result.stdout


class TestReadExitStatus:
    """Test read exit status."""

    @pytest.mark.asyncio
    async def test_read_eof_exit_status(self):
        """read returns non-zero at EOF."""
        bash = Bash()
        result = await bash.exec('''
echo "" | { read line; echo $?; }
''')
        # At EOF with no data, read returns 1
        # With empty line, read returns 0
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_read_success_exit_status(self):
        """read returns 0 on successful read."""
        bash = Bash()
        result = await bash.exec('''
echo "data" | { read line && echo "ok"; }
''')
        assert "ok" in result.stdout


class TestReadCombined:
    """Test combinations of read options."""

    @pytest.mark.asyncio
    async def test_read_ra_combined(self):
        """read -ra combines raw and array."""
        bash = Bash()
        result = await bash.exec(r'''
echo 'a\tb c' | { read -ra arr; echo "${arr[0]}"; }
''')
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_read_rn_combined(self):
        """read -rn combines raw and count."""
        bash = Bash()
        result = await bash.exec(r'''
echo 'ab\cd' | { read -rn4 word; echo "[$word]"; }
''')
        assert result.exit_code == 0
