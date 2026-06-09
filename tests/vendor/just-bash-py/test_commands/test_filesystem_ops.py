"""Tests for filesystem operations."""

import pytest
from just_bash import Bash


class TestRealpathResolution:
    """Test realpath/symlink resolution."""

    @pytest.mark.asyncio
    async def test_realpath_resolves_symlinks(self):
        bash = Bash()
        await bash.exec("mkdir /real")
        await bash.exec("ln -s /real /link")
        result = await bash.exec("readlink -f /link")
        assert result.stdout.strip() == "/real"

    @pytest.mark.asyncio
    async def test_realpath_resolves_chain(self):
        """Test resolving a chain of symlinks."""
        bash = Bash()
        await bash.exec("mkdir /actual")
        await bash.exec("ln -s /actual /link1")
        await bash.exec("ln -s /link1 /link2")
        result = await bash.exec("readlink -f /link2")
        assert result.stdout.strip() == "/actual"


class TestSymlinkOperations:
    """Test symlink creation and operations."""

    @pytest.mark.asyncio
    async def test_create_symlink(self):
        bash = Bash(files={"/target.txt": "content"})
        result = await bash.exec("ln -s /target.txt /link.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_readlink_basic(self):
        bash = Bash(files={"/target.txt": "content"})
        await bash.exec("ln -s /target.txt /link.txt")
        result = await bash.exec("readlink /link.txt")
        assert result.stdout.strip() == "/target.txt"

    @pytest.mark.asyncio
    async def test_symlink_to_directory(self):
        bash = Bash()
        await bash.exec("mkdir /real_dir")
        await bash.exec("ln -s /real_dir /link_dir")
        result = await bash.exec("ls /link_dir")
        assert result.exit_code == 0


class TestIntegration:
    """Integration tests combining filesystem operations."""

    @pytest.mark.asyncio
    async def test_rmdir_after_rm(self):
        bash = Bash(files={"/dir/file.txt": "content"})
        await bash.exec("rm /dir/file.txt")
        result = await bash.exec("rmdir /dir")
        assert result.exit_code == 0
