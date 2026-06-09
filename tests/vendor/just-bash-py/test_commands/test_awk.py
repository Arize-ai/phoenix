"""Tests for awk command."""

import pytest
from just_bash import Bash


class TestAwkBasic:
    """Test basic awk functionality."""

    @pytest.mark.asyncio
    async def test_awk_print_all(self):
        """Print all fields."""
        bash = Bash()
        result = await bash.exec("echo 'a b c' | awk '{print $0}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "a b c"

    @pytest.mark.asyncio
    async def test_awk_print_field(self):
        """Print specific field."""
        bash = Bash()
        result = await bash.exec("echo 'a b c' | awk '{print $2}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "b"

    @pytest.mark.asyncio
    async def test_awk_nf(self):
        """Number of fields."""
        bash = Bash()
        result = await bash.exec("echo 'a b c d' | awk '{print NF}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "4"

    @pytest.mark.asyncio
    async def test_awk_nr(self):
        """Record number."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("awk '{print NR, $0}' /test.txt")
        assert result.exit_code == 0
        assert "1 a" in result.stdout
        assert "2 b" in result.stdout
        assert "3 c" in result.stdout

    @pytest.mark.asyncio
    async def test_awk_begin_end(self):
        """BEGIN and END blocks."""
        bash = Bash(files={"/test.txt": "a\nb\n"})
        result = await bash.exec("awk 'BEGIN{print \"start\"} {print $0} END{print \"end\"}' /test.txt")
        assert result.exit_code == 0
        assert "start" in result.stdout
        assert "a" in result.stdout
        assert "end" in result.stdout

    @pytest.mark.asyncio
    async def test_awk_pattern(self):
        """Pattern matching."""
        bash = Bash(files={"/test.txt": "apple\nbanana\napricot\n"})
        result = await bash.exec("awk '/^a/{print}' /test.txt")
        assert result.exit_code == 0
        assert "apple" in result.stdout
        assert "apricot" in result.stdout
        assert "banana" not in result.stdout


class TestAwkFieldSeparator:
    """Test field separator options."""

    @pytest.mark.asyncio
    async def test_fs_variable(self):
        """Set FS variable."""
        bash = Bash()
        result = await bash.exec("echo 'a:b:c' | awk 'BEGIN{FS=\":\"} {print $2}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "b"

    @pytest.mark.asyncio
    async def test_f_flag(self):
        """Set field separator with -F flag."""
        bash = Bash()
        result = await bash.exec("echo 'a:b:c' | awk -F: '{print $2}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "b"

    @pytest.mark.asyncio
    async def test_f_flag_tab(self):
        """Tab field separator."""
        bash = Bash()
        result = await bash.exec("printf 'a\\tb\\tc' | awk -F'\\t' '{print $2}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "b"


class TestAwkVariables:
    """Test variable assignment and usage."""

    @pytest.mark.asyncio
    async def test_v_flag(self):
        """Set variable with -v flag."""
        bash = Bash()
        result = await bash.exec("echo 'test' | awk -v x=hello '{print x}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "hello"

    @pytest.mark.asyncio
    async def test_user_variables(self):
        """User-defined variables."""
        bash = Bash(files={"/test.txt": "1\n2\n3\n"})
        result = await bash.exec("awk '{sum += $1} END{print sum}' /test.txt")
        assert result.exit_code == 0
        assert result.stdout.strip() == "6"


class TestAwkStringFunctions:
    """Test string functions."""

    @pytest.mark.asyncio
    async def test_length(self):
        """length() function."""
        bash = Bash()
        result = await bash.exec("echo 'hello' | awk '{print length($0)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "5"

    @pytest.mark.asyncio
    async def test_substr(self):
        """substr() function."""
        bash = Bash()
        result = await bash.exec("echo 'hello' | awk '{print substr($0, 2, 3)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "ell"

    @pytest.mark.asyncio
    async def test_index(self):
        """index() function."""
        bash = Bash()
        result = await bash.exec("echo 'hello' | awk '{print index($0, \"ll\")}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_split(self):
        """split() function."""
        bash = Bash()
        result = await bash.exec("echo 'a:b:c' | awk '{n=split($0, arr, \":\"); print arr[2]}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "b"

    @pytest.mark.asyncio
    async def test_tolower_toupper(self):
        """tolower() and toupper() functions."""
        bash = Bash()
        result = await bash.exec("echo 'Hello' | awk '{print tolower($0)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "hello"

        result = await bash.exec("echo 'Hello' | awk '{print toupper($0)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "HELLO"

    @pytest.mark.asyncio
    async def test_gsub(self):
        """gsub() function."""
        bash = Bash()
        result = await bash.exec("echo 'aaa' | awk '{gsub(/a/, \"b\"); print}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "bbb"

    @pytest.mark.asyncio
    async def test_sub(self):
        """sub() function."""
        bash = Bash()
        result = await bash.exec("echo 'aaa' | awk '{sub(/a/, \"b\"); print}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "baa"


class TestAwkMathFunctions:
    """Test math functions."""

    @pytest.mark.asyncio
    async def test_int(self):
        """int() function."""
        bash = Bash()
        result = await bash.exec("echo '3.7' | awk '{print int($0)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_sqrt(self):
        """sqrt() function."""
        bash = Bash()
        result = await bash.exec("echo '16' | awk '{print sqrt($0)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "4"

    @pytest.mark.asyncio
    async def test_sin_cos(self):
        """sin() and cos() functions."""
        bash = Bash()
        result = await bash.exec("echo '0' | awk '{print sin($0)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "0"

        result = await bash.exec("echo '0' | awk '{print cos($0)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "1"

    @pytest.mark.asyncio
    async def test_log_exp(self):
        """log() and exp() functions."""
        bash = Bash()
        result = await bash.exec("echo '1' | awk '{print log($0)}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "0"


class TestAwkPrintf:
    """Test printf formatting."""

    @pytest.mark.asyncio
    async def test_printf_string(self):
        """printf %s format."""
        bash = Bash()
        result = await bash.exec("echo 'test' | awk '{printf \"%s\\n\", $0}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "test"

    @pytest.mark.asyncio
    async def test_printf_decimal(self):
        """printf %d format."""
        bash = Bash()
        result = await bash.exec("echo '42' | awk '{printf \"%d\\n\", $0}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "42"

    @pytest.mark.asyncio
    async def test_printf_float(self):
        """printf %f format."""
        bash = Bash()
        result = await bash.exec("echo '3.14159' | awk '{printf \"%.2f\\n\", $0}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "3.14"


class TestAwkArithmetic:
    """Test arithmetic operations."""

    @pytest.mark.asyncio
    async def test_arithmetic_ops(self):
        """Basic arithmetic."""
        bash = Bash()
        result = await bash.exec("echo '' | awk 'BEGIN{print 2 + 3}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "5"

        result = await bash.exec("echo '' | awk 'BEGIN{print 10 / 3}'")
        assert result.exit_code == 0
        assert "3.33" in result.stdout

    @pytest.mark.asyncio
    async def test_modulo(self):
        """Modulo operation."""
        bash = Bash()
        result = await bash.exec("echo '' | awk 'BEGIN{print 10 % 3}'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "1"
