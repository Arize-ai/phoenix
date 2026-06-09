"""Tests for od command."""

import pytest
from just_bash import Bash


class TestOdFormatting:
    """Test od output formatting."""

    @pytest.mark.asyncio
    async def test_od_octal_four_char_fields(self):
        bash = Bash()
        result = await bash.exec('echo -n "AB" | od')
        # Should have octal values for 'A' (101) and 'B' (102)
        assert "101" in result.stdout
        assert "102" in result.stdout

    @pytest.mark.asyncio
    async def test_od_character_mode_spacing(self):
        bash = Bash()
        result = await bash.exec('echo -n "hi" | od -c')
        # Character mode: each char displayed
        assert "h" in result.stdout
        assert "i" in result.stdout

    @pytest.mark.asyncio
    async def test_od_t_format_specifier(self):
        """Test -t option for format specifiers."""
        bash = Bash()
        result = await bash.exec('echo -n "A" | od -t x1')
        # Should output hex bytes
        assert "41" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_od_t_format_character(self):
        bash = Bash()
        result = await bash.exec('echo -n "A" | od -t c')
        assert "A" in result.stdout


class TestOdBasic:
    """Test basic od functionality."""

    @pytest.mark.asyncio
    async def test_od_default(self):
        """Default od output is octal."""
        bash = Bash()
        result = await bash.exec('echo -n "hello" | od')
        assert result.exit_code == 0
        assert "0000000" in result.stdout  # Address prefix

    @pytest.mark.asyncio
    async def test_od_hex(self):
        """od -x outputs hex."""
        bash = Bash()
        result = await bash.exec('echo -n "A" | od -x')
        # 'A' is 0x41
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_od_address_radix(self):
        """Test -A option for address radix."""
        bash = Bash()
        result = await bash.exec('echo -n "test" | od -A x')
        # Should use hex addresses
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_od_skip_bytes(self):
        """Test -j option to skip bytes."""
        bash = Bash()
        result = await bash.exec('echo -n "hello" | od -j 2 -c')
        # Should skip 'he', show 'llo'
        assert "l" in result.stdout

    @pytest.mark.asyncio
    async def test_od_read_count(self):
        """Test -N option to limit bytes read."""
        bash = Bash()
        result = await bash.exec('echo -n "hello world" | od -N 5 -c')
        # Should only read 'hello'
        assert "h" in result.stdout
