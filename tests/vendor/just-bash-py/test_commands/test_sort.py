"""Tests for sort command."""

import pytest
from just_bash import Bash


class TestSortBasic:
    """Test basic sort functionality."""

    @pytest.mark.asyncio
    async def test_sort_alphabetic(self):
        """Basic alphabetic sort."""
        bash = Bash(files={"/test.txt": "banana\napple\ncherry\n"})
        result = await bash.exec("sort /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["apple", "banana", "cherry"]

    @pytest.mark.asyncio
    async def test_sort_reverse(self):
        """Reverse sort with -r."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sort -r /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["c", "b", "a"]

    @pytest.mark.asyncio
    async def test_sort_numeric(self):
        """Numeric sort with -n."""
        bash = Bash(files={"/test.txt": "10\n2\n1\n20\n"})
        result = await bash.exec("sort -n /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["1", "2", "10", "20"]

    @pytest.mark.asyncio
    async def test_sort_unique(self):
        """Unique with -u."""
        bash = Bash(files={"/test.txt": "a\nb\na\nc\nb\n"})
        result = await bash.exec("sort -u /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["a", "b", "c"]

    @pytest.mark.asyncio
    async def test_sort_stdin(self):
        """Sort from stdin."""
        bash = Bash()
        result = await bash.exec("echo -e 'c\\nb\\na' | sort")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["a", "b", "c"]


class TestSortKeyField:
    """Test key/field sorting options."""

    @pytest.mark.asyncio
    async def test_sort_key(self):
        """Sort by key field with -k."""
        bash = Bash(files={"/test.txt": "3 apple\n1 cherry\n2 banana\n"})
        result = await bash.exec("sort -k1 -n /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert "1 cherry" in lines[0]
        assert "2 banana" in lines[1]
        assert "3 apple" in lines[2]

    @pytest.mark.asyncio
    async def test_sort_field_separator(self):
        """Custom field separator with -t."""
        bash = Bash(files={"/test.txt": "c:3\na:1\nb:2\n"})
        result = await bash.exec("sort -t: -k2 -n /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0].startswith("a")
        assert lines[1].startswith("b")
        assert lines[2].startswith("c")


class TestSortAdvanced:
    """Test advanced sort options."""

    @pytest.mark.asyncio
    async def test_sort_ignore_case(self):
        """Ignore case with -f."""
        bash = Bash(files={"/test.txt": "Banana\napple\nCherry\n"})
        result = await bash.exec("sort -f /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Case-insensitive: apple, Banana, Cherry
        assert lines[0].lower() == "apple"

    @pytest.mark.asyncio
    async def test_sort_check(self):
        """Check if sorted with -c."""
        bash = Bash(files={"/sorted.txt": "a\nb\nc\n"})
        result = await bash.exec("sort -c /sorted.txt")
        assert result.exit_code == 0

        bash = Bash(files={"/unsorted.txt": "b\na\nc\n"})
        result = await bash.exec("sort -c /unsorted.txt")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_sort_stable(self):
        """Stable sort with -s."""
        bash = Bash(files={"/test.txt": "a 1\nb 2\na 3\n"})
        result = await bash.exec("sort -s -k1,1 /test.txt")
        assert result.exit_code == 0
        # Stable sort preserves original order for equal keys

    @pytest.mark.asyncio
    async def test_sort_human_numeric(self):
        """Human-readable numeric sort with -h."""
        bash = Bash(files={"/test.txt": "1K\n1M\n1G\n100\n"})
        result = await bash.exec("sort -h /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Should sort: 100, 1K, 1M, 1G
        assert lines[0] == "100"
        assert lines[-1] == "1G"

    @pytest.mark.asyncio
    async def test_sort_version(self):
        """Version sort with -V."""
        bash = Bash(files={"/test.txt": "v1.10\nv1.2\nv1.1\n"})
        result = await bash.exec("sort -V /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Version sort: v1.1, v1.2, v1.10
        assert lines == ["v1.1", "v1.2", "v1.10"]

    @pytest.mark.asyncio
    async def test_sort_month(self):
        """Month sort with -M."""
        bash = Bash(files={"/test.txt": "Mar\nJan\nFeb\n"})
        result = await bash.exec("sort -M /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["Jan", "Feb", "Mar"]
