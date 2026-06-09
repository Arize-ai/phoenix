"""Tests for find command."""

import pytest
from just_bash import Bash


class TestFindBasic:
    """Test basic find functionality."""

    @pytest.mark.asyncio
    async def test_find_all(self):
        """Find all files in directory."""
        bash = Bash(files={
            "/dir/a.txt": "a\n",
            "/dir/b.txt": "b\n",
            "/dir/sub/c.txt": "c\n",
        })
        result = await bash.exec("find /dir")
        assert result.exit_code == 0
        assert "/dir" in result.stdout
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout
        assert "c.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_find_name(self):
        """Find by name pattern with -name."""
        bash = Bash(files={
            "/dir/a.txt": "a\n",
            "/dir/b.log": "b\n",
            "/dir/c.txt": "c\n",
        })
        result = await bash.exec("find /dir -name '*.txt'")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "c.txt" in result.stdout
        assert "b.log" not in result.stdout

    @pytest.mark.asyncio
    async def test_find_type_file(self):
        """Find only files with -type f."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        await bash.exec("mkdir -p /dir/subdir")
        result = await bash.exec("find /dir -type f")
        assert result.exit_code == 0
        assert "file.txt" in result.stdout
        # Should not include directory names (except as path component)

    @pytest.mark.asyncio
    async def test_find_type_directory(self):
        """Find only directories with -type d."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        await bash.exec("mkdir -p /dir/subdir")
        result = await bash.exec("find /dir -type d")
        assert result.exit_code == 0
        assert "/dir" in result.stdout


class TestFindDepth:
    """Test depth limiting options."""

    @pytest.mark.asyncio
    async def test_find_maxdepth(self):
        """Limit search depth with -maxdepth."""
        bash = Bash(files={
            "/dir/a.txt": "a\n",
            "/dir/sub/b.txt": "b\n",
            "/dir/sub/deep/c.txt": "c\n",
        })
        result = await bash.exec("find /dir -maxdepth 2 -name '*.txt'")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout
        # c.txt is at depth 3, should not be included
        assert "c.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_find_mindepth(self):
        """Minimum search depth with -mindepth."""
        bash = Bash(files={
            "/dir/a.txt": "a\n",
            "/dir/sub/b.txt": "b\n",
        })
        result = await bash.exec("find /dir -mindepth 2 -name '*.txt'")
        assert result.exit_code == 0
        # a.txt is at depth 1, should not be included
        assert "a.txt" not in result.stdout
        assert "b.txt" in result.stdout


class TestFindPredicates:
    """Test various find predicates."""

    @pytest.mark.asyncio
    async def test_find_iname(self):
        """Case-insensitive name with -iname."""
        bash = Bash(files={
            "/dir/File.TXT": "a\n",
            "/dir/other.log": "b\n",
        })
        result = await bash.exec("find /dir -iname '*.txt'")
        assert result.exit_code == 0
        assert "File.TXT" in result.stdout
        assert "other.log" not in result.stdout

    @pytest.mark.asyncio
    async def test_find_empty(self):
        """Find empty files with -empty."""
        bash = Bash(files={
            "/dir/empty.txt": "",
            "/dir/nonempty.txt": "content\n",
        })
        result = await bash.exec("find /dir -empty -type f")
        assert result.exit_code == 0
        assert "empty.txt" in result.stdout
        assert "nonempty.txt" not in result.stdout


class TestFindActions:
    """Test find actions."""

    @pytest.mark.asyncio
    async def test_find_print(self):
        """Print action (default)."""
        bash = Bash(files={"/dir/a.txt": "a\n"})
        result = await bash.exec("find /dir -name '*.txt' -print")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_find_exec(self):
        """Execute command with -exec."""
        bash = Bash(files={
            "/dir/a.txt": "hello\n",
            "/dir/b.txt": "world\n",
        })
        result = await bash.exec("find /dir -name '*.txt' -exec cat {} \\;")
        assert result.exit_code == 0
        assert "hello" in result.stdout
        assert "world" in result.stdout
