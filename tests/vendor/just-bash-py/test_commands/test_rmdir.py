"""Tests for rmdir command."""

import pytest
from just_bash import Bash


class TestRmdirCommand:
    """Test rmdir command."""

    @pytest.mark.asyncio
    async def test_rmdir_empty_directory(self):
        bash = Bash()
        await bash.exec("mkdir /test_dir")
        result = await bash.exec("rmdir /test_dir")
        assert result.exit_code == 0
        # Verify directory is gone
        result2 = await bash.exec("ls -d /test_dir")
        assert result2.exit_code != 0

    @pytest.mark.asyncio
    async def test_rmdir_non_empty_fails(self):
        bash = Bash(files={"/test_dir/file.txt": "content"})
        result = await bash.exec("rmdir /test_dir")
        assert result.exit_code == 1
        assert "Directory not empty" in result.stderr

    @pytest.mark.asyncio
    async def test_rmdir_not_a_directory(self):
        bash = Bash(files={"/file.txt": "content"})
        result = await bash.exec("rmdir /file.txt")
        assert result.exit_code == 1
        assert "Not a directory" in result.stderr

    @pytest.mark.asyncio
    async def test_rmdir_nonexistent(self):
        bash = Bash()
        result = await bash.exec("rmdir /nonexistent")
        assert result.exit_code == 1
        assert "No such file or directory" in result.stderr

    @pytest.mark.asyncio
    async def test_rmdir_parents_flag(self):
        bash = Bash()
        await bash.exec("mkdir -p /a/b/c")
        result = await bash.exec("rmdir -p /a/b/c")
        assert result.exit_code == 0
        # All directories should be gone
        result2 = await bash.exec("ls -d /a")
        assert result2.exit_code != 0

    @pytest.mark.asyncio
    async def test_rmdir_verbose_flag(self):
        bash = Bash()
        await bash.exec("mkdir /verbose_test")
        result = await bash.exec("rmdir -v /verbose_test")
        assert result.exit_code == 0
        assert "removing directory" in result.stdout

    @pytest.mark.asyncio
    async def test_rmdir_multiple_directories(self):
        bash = Bash()
        await bash.exec("mkdir /dir1 /dir2")
        result = await bash.exec("rmdir /dir1 /dir2")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_rmdir_parents_partial_fail(self):
        """When -p removes directories, it should stop if one is not empty."""
        bash = Bash(files={"/a/sibling.txt": "content"})
        await bash.exec("mkdir -p /a/b/c")
        result = await bash.exec("rmdir -p /a/b/c")
        # Should fail when trying to remove /a (contains sibling.txt)
        assert result.exit_code == 1
        # /a/b/c and /a/b should be removed, but /a should remain
        result2 = await bash.exec("ls -d /a")
        assert result2.exit_code == 0
