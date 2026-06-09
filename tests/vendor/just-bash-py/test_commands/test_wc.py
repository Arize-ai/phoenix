"""Tests for wc command."""

import pytest
from just_bash import Bash


class TestWcAlignment:
    """Test wc column alignment."""

    @pytest.mark.asyncio
    async def test_wc_multiple_files_min_width(self):
        bash = Bash(files={
            "/a.txt": "a",
            "/b.txt": "bb",
        })
        result = await bash.exec("wc -c /a.txt /b.txt")
        # Columns should be aligned with min width 3
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3  # 2 files + total

    @pytest.mark.asyncio
    async def test_wc_dynamic_width_based_on_values(self):
        """Width should be based on the largest value."""
        bash = Bash(files={
            "/small.txt": "a",
            "/large.txt": "a" * 1000,
        })
        result = await bash.exec("wc -c /small.txt /large.txt")
        lines = result.stdout.strip().split("\n")
        # Total line should show 1001, width should accommodate 4 digits
        assert "1001" in lines[-1]

    @pytest.mark.asyncio
    async def test_wc_single_file_no_padding(self):
        """Single file with single counter should have no padding."""
        bash = Bash(files={"/a.txt": "hello"})
        result = await bash.exec("wc -c /a.txt")
        # Should be "5 /a.txt" not "      5 /a.txt"
        assert result.stdout == "5 /a.txt\n"


class TestWcBasic:
    """Test basic wc functionality."""

    @pytest.mark.asyncio
    async def test_wc_lines(self):
        """Count lines with -l."""
        bash = Bash(files={"/test.txt": "line1\nline2\nline3\n"})
        result = await bash.exec("wc -l /test.txt")
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_words(self):
        """Count words with -w."""
        bash = Bash(files={"/test.txt": "one two three four\n"})
        result = await bash.exec("wc -w /test.txt")
        assert "4" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_bytes(self):
        """Count bytes with -c."""
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("wc -c /test.txt")
        assert "5" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_stdin(self):
        """wc reads from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'one two three' | wc -w")
        assert "3" in result.stdout
