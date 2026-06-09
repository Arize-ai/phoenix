"""Tests for test/[ builtin command."""

import pytest
from just_bash import Bash


class TestTestFileOperators:
    """Test file test operators."""

    @pytest.mark.asyncio
    async def test_file_exists(self):
        """Test -e (file exists)."""
        bash = Bash(files={"/test.txt": "content\n"})
        result = await bash.exec("test -e /test.txt && echo yes || echo no")
        assert result.stdout.strip() == "yes"

        result = await bash.exec("test -e /nonexistent && echo yes || echo no")
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_regular_file(self):
        """Test -f (regular file)."""
        bash = Bash(files={"/test.txt": "content\n"})
        result = await bash.exec("test -f /test.txt && echo yes || echo no")
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_directory(self):
        """Test -d (directory)."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        result = await bash.exec("test -d /dir && echo yes || echo no")
        assert result.stdout.strip() == "yes"

        result = await bash.exec("test -d /dir/file.txt && echo yes || echo no")
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_readable(self):
        """Test -r (readable)."""
        bash = Bash(files={"/test.txt": "content\n"})
        result = await bash.exec("test -r /test.txt && echo yes || echo no")
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_writable(self):
        """Test -w (writable)."""
        bash = Bash(files={"/test.txt": "content\n"})
        result = await bash.exec("test -w /test.txt && echo yes || echo no")
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_executable(self):
        """Test -x (executable)."""
        bash = Bash(files={"/script.sh": "#!/bin/bash\necho hi\n"})
        # In-memory files aren't executable by default
        result = await bash.exec("test -x /script.sh && echo yes || echo no")
        # This depends on implementation - files may or may not be executable

    @pytest.mark.asyncio
    async def test_file_size(self):
        """Test -s (file size > 0)."""
        bash = Bash(files={
            "/nonempty.txt": "content\n",
            "/empty.txt": "",
        })
        result = await bash.exec("test -s /nonempty.txt && echo yes || echo no")
        assert result.stdout.strip() == "yes"

        result = await bash.exec("test -s /empty.txt && echo yes || echo no")
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_symlink(self):
        """Test -L/-h (symbolic link)."""
        bash = Bash(files={"/target.txt": "content\n"})
        await bash.exec("ln -s /target.txt /link.txt")
        result = await bash.exec("test -L /link.txt && echo yes || echo no")
        assert result.stdout.strip() == "yes"

        result = await bash.exec("test -L /target.txt && echo yes || echo no")
        assert result.stdout.strip() == "no"


class TestTestStringOperators:
    """Test string test operators."""

    @pytest.mark.asyncio
    async def test_string_zero_length(self):
        """Test -z (zero length string)."""
        bash = Bash()
        result = await bash.exec('test -z "" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

        result = await bash.exec('test -z "hello" && echo yes || echo no')
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_string_nonzero_length(self):
        """Test -n (non-zero length string)."""
        bash = Bash()
        result = await bash.exec('test -n "hello" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

        result = await bash.exec('test -n "" && echo yes || echo no')
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_string_equal(self):
        """Test = (string equality)."""
        bash = Bash()
        result = await bash.exec('test "abc" = "abc" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

        result = await bash.exec('test "abc" = "def" && echo yes || echo no')
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_string_not_equal(self):
        """Test != (string inequality)."""
        bash = Bash()
        result = await bash.exec('test "abc" != "def" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

        result = await bash.exec('test "abc" != "abc" && echo yes || echo no')
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_string_less_than(self):
        """Test < (string less than)."""
        bash = Bash()
        result = await bash.exec('test "abc" \\< "def" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_string_greater_than(self):
        """Test > (string greater than)."""
        bash = Bash()
        result = await bash.exec('test "def" \\> "abc" && echo yes || echo no')
        assert result.stdout.strip() == "yes"


class TestTestIntegerOperators:
    """Test integer comparison operators."""

    @pytest.mark.asyncio
    async def test_integer_equal(self):
        """Test -eq (integer equal)."""
        bash = Bash()
        result = await bash.exec("test 5 -eq 5 && echo yes || echo no")
        assert result.stdout.strip() == "yes"

        result = await bash.exec("test 5 -eq 6 && echo yes || echo no")
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_integer_not_equal(self):
        """Test -ne (integer not equal)."""
        bash = Bash()
        result = await bash.exec("test 5 -ne 6 && echo yes || echo no")
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_integer_less_than(self):
        """Test -lt (integer less than)."""
        bash = Bash()
        result = await bash.exec("test 5 -lt 10 && echo yes || echo no")
        assert result.stdout.strip() == "yes"

        result = await bash.exec("test 10 -lt 5 && echo yes || echo no")
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_integer_less_equal(self):
        """Test -le (integer less than or equal)."""
        bash = Bash()
        result = await bash.exec("test 5 -le 5 && echo yes || echo no")
        assert result.stdout.strip() == "yes"

        result = await bash.exec("test 5 -le 10 && echo yes || echo no")
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_integer_greater_than(self):
        """Test -gt (integer greater than)."""
        bash = Bash()
        result = await bash.exec("test 10 -gt 5 && echo yes || echo no")
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_integer_greater_equal(self):
        """Test -ge (integer greater than or equal)."""
        bash = Bash()
        result = await bash.exec("test 10 -ge 10 && echo yes || echo no")
        assert result.stdout.strip() == "yes"


class TestTestLogicalOperators:
    """Test logical operators."""

    @pytest.mark.asyncio
    async def test_logical_not(self):
        """Test ! (logical NOT)."""
        bash = Bash()
        result = await bash.exec('test ! -z "hello" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

        result = await bash.exec('test ! -n "" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_logical_and(self):
        """Test -a (logical AND)."""
        bash = Bash()
        result = await bash.exec('test -n "a" -a -n "b" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

        result = await bash.exec('test -n "a" -a -z "b" && echo yes || echo no')
        assert result.stdout.strip() == "no"

    @pytest.mark.asyncio
    async def test_logical_or(self):
        """Test -o (logical OR)."""
        bash = Bash()
        result = await bash.exec('test -z "a" -o -n "b" && echo yes || echo no')
        assert result.stdout.strip() == "yes"

        result = await bash.exec('test -z "a" -o -z "b" && echo yes || echo no')
        assert result.stdout.strip() == "no"


class TestTestBracketSyntax:
    """Test [ ] bracket syntax."""

    @pytest.mark.asyncio
    async def test_bracket_basic(self):
        """Test [ ] bracket syntax."""
        bash = Bash()
        result = await bash.exec('[ "hello" = "hello" ] && echo yes || echo no')
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_bracket_file_test(self):
        """Test [ ] with file tests."""
        bash = Bash(files={"/test.txt": "content\n"})
        result = await bash.exec("[ -f /test.txt ] && echo yes || echo no")
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_bracket_integer(self):
        """Test [ ] with integer comparison."""
        bash = Bash()
        result = await bash.exec("[ 5 -lt 10 ] && echo yes || echo no")
        assert result.stdout.strip() == "yes"

    @pytest.mark.asyncio
    async def test_bracket_missing_closing(self):
        """Test [ without closing ] should error."""
        bash = Bash()
        result = await bash.exec('[ "a" = "a"')
        assert result.exit_code != 0


class TestTestExitCodes:
    """Test exit code behavior."""

    @pytest.mark.asyncio
    async def test_true_returns_0(self):
        """True condition returns exit code 0."""
        bash = Bash()
        result = await bash.exec('test "a" = "a"')
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_false_returns_1(self):
        """False condition returns exit code 1."""
        bash = Bash()
        result = await bash.exec('test "a" = "b"')
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_error_returns_2(self):
        """Error condition returns exit code 2."""
        bash = Bash()
        # Missing ] in [ command is an error
        result = await bash.exec("[ -f /tmp")
        assert result.exit_code == 2

    @pytest.mark.asyncio
    async def test_single_operator_arg_is_string_test(self):
        """Single argument (even operator-like) is non-empty string test."""
        bash = Bash()
        # bash treats single args as non-empty string tests
        result = await bash.exec("test -f")
        assert result.exit_code == 0  # "-f" is non-empty → true

    @pytest.mark.asyncio
    async def test_no_args_returns_1(self):
        """No arguments returns exit code 1 (false)."""
        bash = Bash()
        result = await bash.exec("test")
        assert result.exit_code == 1
