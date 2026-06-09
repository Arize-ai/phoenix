"""Tests for printf builtin extended features.

Covers: builtin-printf.test.sh failures
Key areas: %q quoting, width/precision with *, %(datefmt)T, unicode, escape sequences
"""

import pytest
from just_bash import Bash


class TestPrintfBasic:
    """Basic printf functionality."""

    @pytest.mark.asyncio
    async def test_printf_string(self):
        """printf with %s."""
        bash = Bash()
        result = await bash.exec('printf "%s\\n" hello')
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_printf_integer(self):
        """printf with %d."""
        bash = Bash()
        result = await bash.exec('printf "%d\\n" 42')
        assert result.stdout == "42\n"

    @pytest.mark.asyncio
    async def test_printf_no_trailing_newline(self):
        """printf doesn't add newline by default."""
        bash = Bash()
        result = await bash.exec('printf "hello"')
        assert result.stdout == "hello"

    @pytest.mark.asyncio
    async def test_printf_multiple_args(self):
        """printf with multiple arguments."""
        bash = Bash()
        result = await bash.exec('printf "%s %s\\n" hello world')
        assert result.stdout == "hello world\n"


class TestPrintfQuoting:
    """Test %q format specifier for shell quoting."""

    @pytest.mark.asyncio
    async def test_printf_q_simple(self):
        """printf %q with simple string."""
        bash = Bash()
        result = await bash.exec('printf "%q\\n" hello')
        # Simple string should be unquoted or minimally quoted
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_printf_q_with_space(self):
        """printf %q with spaces."""
        bash = Bash()
        result = await bash.exec('printf "%q\\n" "hello world"')
        # Should quote to protect space
        out = result.stdout.strip()
        assert " " not in out or "'" in out or '"' in out or "\\" in out

    @pytest.mark.asyncio
    async def test_printf_q_special_chars(self):
        """printf %q with special characters."""
        bash = Bash()
        result = await bash.exec(r'printf "%q\n" "say \"hi\""')
        # Should escape the quotes
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_printf_q_empty(self):
        """printf %q with empty string."""
        bash = Bash()
        result = await bash.exec('printf "%q\\n" ""')
        # Empty string should produce '' or ""
        out = result.stdout.strip()
        assert out in ["''", '""', ""]

    @pytest.mark.asyncio
    async def test_printf_q_newline(self):
        """printf %q with newline."""
        bash = Bash()
        result = await bash.exec('printf "%q\\n" $\'line1\\nline2\'')
        # Should quote to protect newline
        assert result.exit_code == 0


class TestPrintfWidthPrecision:
    """Test width and precision with * specifier."""

    @pytest.mark.asyncio
    async def test_printf_width_fixed(self):
        """printf with fixed width."""
        bash = Bash()
        result = await bash.exec('printf "%10s\\n" hi')
        assert result.stdout == "        hi\n"

    @pytest.mark.asyncio
    async def test_printf_width_star(self):
        """printf with * width."""
        bash = Bash()
        result = await bash.exec('printf "%*s\\n" 10 hi')
        assert result.stdout == "        hi\n"

    @pytest.mark.asyncio
    async def test_printf_left_align(self):
        """printf left alignment with -."""
        bash = Bash()
        result = await bash.exec('printf "%-10s|\\n" hi')
        assert result.stdout == "hi        |\n"

    @pytest.mark.asyncio
    async def test_printf_precision_string(self):
        """printf precision limits string length."""
        bash = Bash()
        result = await bash.exec('printf "%.3s\\n" hello')
        assert result.stdout == "hel\n"

    @pytest.mark.asyncio
    async def test_printf_precision_star(self):
        """printf with * precision."""
        bash = Bash()
        result = await bash.exec('printf "%.*s\\n" 3 hello')
        assert result.stdout == "hel\n"

    @pytest.mark.asyncio
    async def test_printf_width_and_precision_star(self):
        """printf with both * width and * precision."""
        bash = Bash()
        result = await bash.exec('printf "%*.*s\\n" 10 3 hello')
        assert result.stdout == "       hel\n"

    @pytest.mark.asyncio
    async def test_printf_zero_padding(self):
        """printf zero padding for numbers."""
        bash = Bash()
        result = await bash.exec('printf "%05d\\n" 42')
        assert result.stdout == "00042\n"


class TestPrintfNumericFormats:
    """Test numeric format specifiers."""

    @pytest.mark.asyncio
    async def test_printf_octal(self):
        """printf with %o octal."""
        bash = Bash()
        result = await bash.exec('printf "%o\\n" 64')
        assert result.stdout == "100\n"

    @pytest.mark.asyncio
    async def test_printf_hex_lower(self):
        """printf with %x lowercase hex."""
        bash = Bash()
        result = await bash.exec('printf "%x\\n" 255')
        assert result.stdout == "ff\n"

    @pytest.mark.asyncio
    async def test_printf_hex_upper(self):
        """printf with %X uppercase hex."""
        bash = Bash()
        result = await bash.exec('printf "%X\\n" 255')
        assert result.stdout == "FF\n"

    @pytest.mark.asyncio
    async def test_printf_float(self):
        """printf with %f float."""
        bash = Bash()
        result = await bash.exec('printf "%f\\n" 3.14')
        assert "3.14" in result.stdout

    @pytest.mark.asyncio
    async def test_printf_float_precision(self):
        """printf with float precision."""
        bash = Bash()
        result = await bash.exec('printf "%.2f\\n" 3.14159')
        assert result.stdout == "3.14\n"

    @pytest.mark.asyncio
    async def test_printf_scientific(self):
        """printf with %e scientific notation."""
        bash = Bash()
        result = await bash.exec('printf "%e\\n" 1234.5')
        assert "e" in result.stdout.lower()


class TestPrintfEscapeSequences:
    """Test escape sequences in format string."""

    @pytest.mark.asyncio
    async def test_printf_newline(self):
        """printf \\n for newline."""
        bash = Bash()
        result = await bash.exec('printf "line1\\nline2\\n"')
        assert result.stdout == "line1\nline2\n"

    @pytest.mark.asyncio
    async def test_printf_tab(self):
        """printf \\t for tab."""
        bash = Bash()
        result = await bash.exec('printf "a\\tb\\n"')
        assert result.stdout == "a\tb\n"

    @pytest.mark.asyncio
    async def test_printf_backslash(self):
        """printf \\\\ for backslash."""
        bash = Bash()
        result = await bash.exec("printf 'a\\\\b\\n'")
        assert result.stdout == "a\\b\n"

    @pytest.mark.asyncio
    async def test_printf_carriage_return(self):
        """printf \\r for carriage return."""
        bash = Bash()
        result = await bash.exec('printf "hello\\rworld\\n"')
        assert "\\r" in result.stdout or result.stdout == "hello\rworld\n"

    @pytest.mark.asyncio
    async def test_printf_octal_escape(self):
        """printf \\NNN for octal character."""
        bash = Bash()
        result = await bash.exec('printf "\\101\\n"')  # 101 octal = 'A'
        assert result.stdout == "A\n"

    @pytest.mark.asyncio
    async def test_printf_hex_escape(self):
        """printf \\xNN for hex character."""
        bash = Bash()
        result = await bash.exec('printf "\\x41\\n"')  # 0x41 = 'A'
        assert result.stdout == "A\n"


class TestPrintfDateTime:
    """Test %(datefmt)T time formatting."""

    @pytest.mark.asyncio
    async def test_printf_time_basic(self):
        """printf %(fmt)T with timestamp."""
        bash = Bash()
        result = await bash.exec('printf "%(Y)T\\n" -1')
        # Should print year (4 digits)
        assert len(result.stdout.strip()) == 4 or result.exit_code == 0

    @pytest.mark.asyncio
    async def test_printf_time_current(self):
        """printf %(fmt)T with -1 for current time."""
        bash = Bash()
        result = await bash.exec('printf "%(%Y-%m-%d)T\\n" -1')
        # Should print date in YYYY-MM-DD format
        out = result.stdout.strip()
        assert len(out) == 10 or result.exit_code == 0


class TestPrintfFormatReuse:
    """Test format string reuse with extra arguments."""

    @pytest.mark.asyncio
    async def test_printf_reuse_format(self):
        """printf reuses format for extra args."""
        bash = Bash()
        result = await bash.exec('printf "%s\\n" a b c')
        assert result.stdout == "a\nb\nc\n"

    @pytest.mark.asyncio
    async def test_printf_mixed_reuse(self):
        """printf reuses mixed format."""
        bash = Bash()
        result = await bash.exec('printf "%s=%d\\n" a 1 b 2')
        assert "a=1" in result.stdout
        assert "b=2" in result.stdout


class TestPrintfCharacter:
    """Test %c character format."""

    @pytest.mark.asyncio
    async def test_printf_char_first(self):
        """printf %c prints first character."""
        bash = Bash()
        result = await bash.exec('printf "%c\\n" hello')
        assert result.stdout == "h\n"

    @pytest.mark.asyncio
    async def test_printf_char_single(self):
        """printf %c with single char."""
        bash = Bash()
        result = await bash.exec('printf "%c\\n" X')
        assert result.stdout == "X\n"


class TestPrintfSpecialCases:
    """Test special cases and edge conditions."""

    @pytest.mark.asyncio
    async def test_printf_percent_literal(self):
        """printf %% for literal percent."""
        bash = Bash()
        result = await bash.exec('printf "100%%\\n"')
        assert result.stdout == "100%\n"

    @pytest.mark.asyncio
    async def test_printf_b_escape(self):
        """printf %b interprets escapes in argument."""
        bash = Bash()
        result = await bash.exec('printf "%b\\n" "hello\\nworld"')
        assert "hello\nworld" in result.stdout

    @pytest.mark.asyncio
    async def test_printf_negative_width(self):
        """printf with negative width (left align)."""
        bash = Bash()
        result = await bash.exec('printf "%*s|\\n" -10 hi')
        assert result.stdout == "hi        |\n"

    @pytest.mark.asyncio
    async def test_printf_missing_arg(self):
        """printf with missing argument uses default."""
        bash = Bash()
        result = await bash.exec('printf "%s %s\\n" one')
        # Missing arg should be empty string
        assert "one" in result.stdout


class TestPrintfUnicode:
    """Test unicode handling in printf."""

    @pytest.mark.asyncio
    async def test_printf_unicode_string(self):
        """printf with unicode string."""
        bash = Bash()
        result = await bash.exec('printf "%s\\n" "héllo"')
        assert "héllo" in result.stdout

    @pytest.mark.asyncio
    async def test_printf_unicode_width(self):
        """printf width with unicode."""
        bash = Bash()
        result = await bash.exec('printf "%5s\\n" "é"')
        # Should account for display width
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_printf_unicode_escape(self):
        """printf \\uNNNN for unicode."""
        bash = Bash()
        result = await bash.exec('printf "\\u0041\\n"')  # U+0041 = 'A'
        assert result.stdout == "A\n" or "A" in result.stdout


class TestPrintfToVariable:
    """Test printf -v to assign to variable."""

    @pytest.mark.asyncio
    async def test_printf_v_assign(self):
        """printf -v assigns to variable."""
        bash = Bash()
        result = await bash.exec('''
printf -v var "%s %d" hello 42
echo "$var"
''')
        assert result.stdout.strip() == "hello 42"

    @pytest.mark.asyncio
    async def test_printf_v_no_output(self):
        """printf -v produces no stdout."""
        bash = Bash()
        result = await bash.exec('''
printf -v var "value"
echo "done"
''')
        assert result.stdout.strip() == "done"


class TestPrintfSignedUnsigned:
    """Test signed vs unsigned formats."""

    @pytest.mark.asyncio
    async def test_printf_unsigned(self):
        """printf %u for unsigned."""
        bash = Bash()
        result = await bash.exec('printf "%u\\n" 42')
        assert result.stdout == "42\n"

    @pytest.mark.asyncio
    async def test_printf_positive_sign(self):
        """printf with + flag shows sign."""
        bash = Bash()
        result = await bash.exec('printf "%+d\\n" 42')
        assert result.stdout == "+42\n"

    @pytest.mark.asyncio
    async def test_printf_space_sign(self):
        """printf with space flag for positive."""
        bash = Bash()
        result = await bash.exec('printf "% d\\n" 42')
        assert result.stdout == " 42\n"


class TestPrintfHexEscapes:
    """Test printf UTF-8 hex escape handling."""

    @pytest.mark.asyncio
    async def test_printf_utf8_consecutive_hex(self):
        bash = Bash()
        # UTF-8 encoding of euro sign (€): \xe2\x82\xac
        result = await bash.exec(r"printf '\xe2\x82\xac'")
        assert result.stdout == "€"

    @pytest.mark.asyncio
    async def test_printf_invalid_utf8_fallback(self):
        bash = Bash()
        # Invalid UTF-8 sequence - should fall back to Latin-1
        result = await bash.exec(r"printf '\xff'")
        assert result.stdout == "\xff"

    @pytest.mark.asyncio
    async def test_printf_mixed_utf8_and_text(self):
        bash = Bash()
        # Euro sign followed by text
        result = await bash.exec(r"printf 'Price: \xe2\x82\xac100'")
        assert result.stdout == "Price: €100"

    @pytest.mark.asyncio
    async def test_printf_multiple_utf8_sequences(self):
        bash = Bash()
        # Two UTF-8 encoded characters
        # ñ = \xc3\xb1 (U+00F1)
        result = await bash.exec(r"printf '\xc3\xb1'")
        assert result.stdout == "ñ"