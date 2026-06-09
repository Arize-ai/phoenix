"""Tests for touch command extended options."""

import pytest
from just_bash import Bash


class TestTouchDate:
    """Test touch -d option."""

    @pytest.mark.asyncio
    async def test_touch_with_date(self):
        bash = Bash()
        result = await bash.exec("touch -d '2024-01-15' /testfile")
        assert result.exit_code == 0
        # Verify file was created
        stat_result = await bash.exec("stat -c %Y /testfile")
        assert stat_result.exit_code == 0
        # Should be January 15, 2024 timestamp (1705276800)
        mtime = int(stat_result.stdout.strip())
        # Allow some flexibility for timezone handling
        assert 1705190400 <= mtime <= 1705363200  # Jan 14-16 range

    @pytest.mark.asyncio
    async def test_touch_date_iso_format(self):
        bash = Bash()
        result = await bash.exec("touch -d '2024-06-20 14:30:00' /testfile")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_touch_date_long_option(self):
        bash = Bash()
        result = await bash.exec("touch --date='2024-03-10' /testfile")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_touch_date_slash_format(self):
        bash = Bash()
        result = await bash.exec("touch -d '2024/01/15' /testfile")
        assert result.exit_code == 0


class TestTouchTimestamp:
    """Test touch timestamp modification."""

    @pytest.mark.asyncio
    async def test_utimes_updates_mtime(self):
        bash = Bash(files={"/test.txt": "content"})
        await bash.exec("touch -d '2020-01-01' /test.txt")
        stat_result = await bash.exec("stat -c %Y /test.txt")
        mtime = int(stat_result.stdout.strip())
        # Should be around 2020-01-01 timestamp (1577836800)
        assert 1577750400 <= mtime <= 1577923200  # Dec 31, 2019 - Jan 2, 2020
