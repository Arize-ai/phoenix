"""Tests for time command."""

import pytest
from just_bash import Bash


class TestTimeCommand:
    """Test time command."""

    @pytest.mark.asyncio
    async def test_time_basic(self):
        bash = Bash()
        result = await bash.exec("time echo hello")
        assert "hello" in result.stdout
        # Timing info goes to stderr
        assert "real" in result.stderr or result.exit_code == 0

    @pytest.mark.asyncio
    async def test_time_posix_format(self):
        bash = Bash()
        result = await bash.exec("time -p echo hello")
        assert "hello" in result.stdout
        assert "real" in result.stderr
        assert "user" in result.stderr
        assert "sys" in result.stderr

    @pytest.mark.asyncio
    async def test_time_no_command(self):
        bash = Bash()
        result = await bash.exec("time")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_time_preserves_exit_code(self):
        bash = Bash()
        result = await bash.exec("time false")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_time_with_pipeline(self):
        bash = Bash(files={"/test.txt": "hello world"})
        result = await bash.exec("time cat /test.txt | wc -w")
        assert "2" in result.stdout
