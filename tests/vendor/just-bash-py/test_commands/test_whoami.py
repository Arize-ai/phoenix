"""Tests for whoami command."""

import pytest
from just_bash import Bash


class TestWhoamiCommand:
    """Test whoami command."""

    @pytest.mark.asyncio
    async def test_whoami_returns_user(self):
        bash = Bash()
        result = await bash.exec("whoami")
        assert result.stdout == "user\n"
        assert result.exit_code == 0
