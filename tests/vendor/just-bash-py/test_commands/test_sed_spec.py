"""Tests for sed command features (Phase 13)."""

import pytest
from just_bash import Bash


class TestSedBasic:
    """Test basic sed substitution."""

    @pytest.mark.asyncio
    async def test_basic_substitution(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | sed 's/hello/bye/'")
        assert result.stdout == "bye world\n"

    @pytest.mark.asyncio
    async def test_global_substitution(self):
        bash = Bash()
        result = await bash.exec("echo 'aaa' | sed 's/a/b/g'")
        assert result.stdout == "bbb\n"

    @pytest.mark.asyncio
    async def test_case_insensitive(self):
        bash = Bash()
        result = await bash.exec("echo 'Hello HELLO hello' | sed 's/hello/bye/gi'")
        assert result.stdout == "bye bye bye\n"

    @pytest.mark.asyncio
    async def test_delete_line(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed '2d' /input.txt")
        assert result.stdout == "a\nc\n"

    @pytest.mark.asyncio
    async def test_print_line(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed -n '2p' /input.txt")
        assert result.stdout == "b\n"

    @pytest.mark.asyncio
    async def test_line_range(self):
        bash = Bash(files={"/input.txt": "a\nb\nc\nd\ne"})
        result = await bash.exec("sed -n '2,4p' /input.txt")
        assert result.stdout == "b\nc\nd\n"

    @pytest.mark.asyncio
    async def test_last_line(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed -n '$p' /input.txt")
        assert result.stdout == "c\n"


class TestSedAddresses:
    """Test sed address patterns."""

    @pytest.mark.asyncio
    async def test_regex_address(self):
        bash = Bash(files={"/input.txt": "hello world\nfoo bar\nhello again"})
        result = await bash.exec("sed -n '/hello/p' /input.txt")
        assert result.stdout == "hello world\nhello again\n"

    @pytest.mark.asyncio
    async def test_regex_range(self):
        bash = Bash(files={"/input.txt": "start\na\nb\nstop\nc"})
        result = await bash.exec("sed -n '/start/,/stop/p' /input.txt")
        assert result.stdout == "start\na\nb\nstop\n"

    @pytest.mark.asyncio
    async def test_negate_address(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed -n '2!p' /input.txt")
        assert result.stdout == "a\nc\n"


class TestSedCommands:
    """Test various sed commands."""

    @pytest.mark.asyncio
    async def test_insert_before(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed '2i\\NEW' /input.txt")
        assert result.stdout == "a\nNEW\nb\nc\n"

    @pytest.mark.asyncio
    async def test_append_after(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed '2a\\NEW' /input.txt")
        assert result.stdout == "a\nb\nNEW\nc\n"

    @pytest.mark.asyncio
    async def test_change_line(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed '2c\\NEW' /input.txt")
        assert result.stdout == "a\nNEW\nc\n"

    @pytest.mark.asyncio
    async def test_transliterate(self):
        bash = Bash()
        result = await bash.exec("echo 'hello' | sed 'y/helo/HELO/'")
        assert result.stdout == "HELLO\n"

    @pytest.mark.asyncio
    async def test_line_number_equals(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed -n '2=' /input.txt")
        assert result.stdout == "2\n"


class TestSedHoldSpace:
    """Test sed hold space operations."""

    @pytest.mark.asyncio
    async def test_hold_and_get(self):
        """Hold pattern space, get it back later."""
        bash = Bash(files={"/input.txt": "first\nsecond\nthird"})
        result = await bash.exec("sed -n '1h;3{x;p}' /input.txt")
        assert result.stdout == "first\n"

    @pytest.mark.asyncio
    async def test_swap_hold_pattern(self):
        bash = Bash()
        result = await bash.exec("echo -e 'a\\nb' | sed -n 'h;s/.*/X/;x;p'")
        assert "a" in result.stdout

    @pytest.mark.asyncio
    async def test_append_to_hold(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed -n 'H;${x;p}' /input.txt")
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout


class TestSedMultipleCommands:
    """Test sed with multiple commands."""

    @pytest.mark.asyncio
    async def test_multiple_e(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | sed -e 's/hello/hi/' -e 's/world/earth/'")
        assert result.stdout == "hi earth\n"

    @pytest.mark.asyncio
    async def test_semicolon_separated(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | sed 's/hello/hi/;s/world/earth/'")
        assert result.stdout == "hi earth\n"


class TestSedDelimiters:
    """Test sed with different delimiters."""

    @pytest.mark.asyncio
    async def test_alternate_delimiter(self):
        bash = Bash()
        result = await bash.exec("echo '/usr/bin/env' | sed 's|/usr/bin|/opt/bin|'")
        assert result.stdout == "/opt/bin/env\n"

    @pytest.mark.asyncio
    async def test_hash_delimiter(self):
        bash = Bash()
        result = await bash.exec("echo '/usr/bin/env' | sed 's#/usr/bin#/opt/bin#'")
        assert result.stdout == "/opt/bin/env\n"


class TestSedExtendedRegex:
    """Test sed with extended regex."""

    @pytest.mark.asyncio
    async def test_ere_plus(self):
        bash = Bash()
        result = await bash.exec("echo 'aaa' | sed -E 's/a+/b/'")
        assert result.stdout == "b\n"

    @pytest.mark.asyncio
    async def test_ere_alternation(self):
        bash = Bash()
        result = await bash.exec("echo 'cat and dog' | sed -E 's/cat|dog/pet/g'")
        assert result.stdout == "pet and pet\n"

    @pytest.mark.asyncio
    async def test_ere_groups(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | sed -E 's/(hello) (world)/\\2 \\1/'")
        assert result.stdout == "world hello\n"


class TestSedBranching:
    """Test sed branching commands."""

    @pytest.mark.asyncio
    async def test_quit(self):
        bash = Bash(files={"/input.txt": "a\nb\nc\nd"})
        result = await bash.exec("sed '3q' /input.txt")
        assert result.stdout == "a\nb\nc\n"

    @pytest.mark.asyncio
    async def test_next_line(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("sed 'n;d' /input.txt")
        assert result.stdout == "a\nc\n"
