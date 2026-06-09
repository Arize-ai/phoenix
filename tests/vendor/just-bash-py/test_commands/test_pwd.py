"""Tests for pwd command options."""

import pytest
from just_bash import Bash


class TestPwdOptions:
    """Test pwd -P/-L options."""

    @pytest.mark.asyncio
    async def test_pwd_physical_flag(self):
        bash = Bash()
        # Create a symlink to a directory
        await bash.exec("mkdir /real_dir")
        await bash.exec("ln -s /real_dir /link_dir")
        await bash.exec("cd /link_dir")
        result = await bash.exec("pwd -P")
        assert result.stdout.strip() == "/real_dir"

    @pytest.mark.asyncio
    async def test_pwd_logical_flag(self):
        bash = Bash()
        await bash.exec("mkdir /real_dir")
        await bash.exec("ln -s /real_dir /link_dir")
        await bash.exec("cd /link_dir")
        result = await bash.exec("pwd -L")
        # Should show /link_dir (logical path)
        assert result.stdout.strip() == "/link_dir"

    @pytest.mark.asyncio
    async def test_pwd_default_is_logical(self):
        """Default pwd behavior should be logical (like -L)."""
        bash = Bash()
        await bash.exec("mkdir /real_dir")
        await bash.exec("ln -s /real_dir /link_dir")
        await bash.exec("cd /link_dir")
        result = await bash.exec("pwd")
        assert result.stdout.strip() == "/link_dir"
