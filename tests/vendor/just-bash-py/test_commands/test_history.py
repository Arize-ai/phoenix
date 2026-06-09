"""Tests for history command improvements."""

import pytest

from just_bash import Bash


class TestHistoryDisplay:
    """Test history display functionality."""

    @pytest.mark.asyncio
    async def test_history_display_format(self):
        """Display history with proper 5-character line number format."""
        bash = Bash(env={"BASH_HISTORY": '["echo hello","ls -la"]'})
        result = await bash.exec("history")
        assert result.exit_code == 0
        assert result.stdout == "    1  echo hello\n    2  ls -la\n"

    @pytest.mark.asyncio
    async def test_history_empty(self):
        """Empty history returns nothing."""
        bash = Bash(env={"BASH_HISTORY": "[]"})
        result = await bash.exec("history")
        assert result.exit_code == 0
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_history_no_env_var(self):
        """No BASH_HISTORY env var returns nothing."""
        bash = Bash()
        result = await bash.exec("history")
        assert result.exit_code == 0
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_history_single_entry(self):
        """History with single entry."""
        bash = Bash(env={"BASH_HISTORY": '["pwd"]'})
        result = await bash.exec("history")
        assert result.exit_code == 0
        assert result.stdout == "    1  pwd\n"

    @pytest.mark.asyncio
    async def test_history_line_number_padding(self):
        """Line numbers are right-justified to 5 characters."""
        import json
        # Test with entries that have different digit line numbers
        commands = ["cmd1", "cmd2", "cmd3", "cmd4", "cmd5",
                   "cmd6", "cmd7", "cmd8", "cmd9", "cmd10"]
        bash = Bash(env={"BASH_HISTORY": json.dumps(commands)})
        result = await bash.exec("history")
        assert result.exit_code == 0
        lines = result.stdout.split("\n")
        # Single digit lines should have 4 spaces before the number
        assert lines[0] == "    1  cmd1"
        assert lines[8] == "    9  cmd9"
        # Double digit line should have 3 spaces before the number
        assert lines[9] == "   10  cmd10"


class TestHistoryClear:
    """Test history -c flag to clear history."""

    @pytest.mark.asyncio
    async def test_history_clear(self):
        """Clear history with -c flag."""
        bash = Bash(env={"BASH_HISTORY": '["cmd1","cmd2"]'})
        result = await bash.exec("history -c")
        assert result.exit_code == 0
        assert result.stdout == ""
        # Verify history is cleared (would need to check env)
        # Run history again to verify
        result = await bash.exec("history")
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_history_clear_empty(self):
        """Clear already empty history."""
        bash = Bash(env={"BASH_HISTORY": "[]"})
        result = await bash.exec("history -c")
        assert result.exit_code == 0


class TestHistoryLimit:
    """Test history with numeric argument to limit output."""

    @pytest.mark.asyncio
    async def test_history_limit(self):
        """Show last N entries with numeric argument."""
        bash = Bash(env={"BASH_HISTORY": '["a","b","c","d","e"]'})
        result = await bash.exec("history 2")
        assert result.exit_code == 0
        # Should show last 2 entries with their original line numbers
        assert result.stdout == "    4  d\n    5  e\n"

    @pytest.mark.asyncio
    async def test_history_limit_larger_than_history(self):
        """Numeric argument larger than history shows all."""
        bash = Bash(env={"BASH_HISTORY": '["a","b"]'})
        result = await bash.exec("history 10")
        assert result.exit_code == 0
        assert result.stdout == "    1  a\n    2  b\n"

    @pytest.mark.asyncio
    async def test_history_limit_zero(self):
        """Numeric argument of zero shows nothing."""
        bash = Bash(env={"BASH_HISTORY": '["a","b","c"]'})
        result = await bash.exec("history 0")
        assert result.exit_code == 0
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_history_limit_one(self):
        """Numeric argument of one shows last entry."""
        bash = Bash(env={"BASH_HISTORY": '["a","b","c"]'})
        result = await bash.exec("history 1")
        assert result.exit_code == 0
        assert result.stdout == "    3  c\n"


class TestHistoryHelp:
    """Test history --help."""

    @pytest.mark.asyncio
    async def test_history_help(self):
        """Show help with --help flag."""
        bash = Bash()
        result = await bash.exec("history --help")
        assert result.exit_code == 0
        assert "Usage:" in result.stdout
        assert "history" in result.stdout


class TestHistoryBackwardCompatibility:
    """Test backward compatibility with old newline-separated format."""

    @pytest.mark.asyncio
    async def test_history_legacy_format_fallback(self):
        """Legacy newline-separated format still works as fallback."""
        # If it's not valid JSON, treat as newline-separated (backward compat)
        bash = Bash(env={"BASH_HISTORY": "echo hello\nls -la"})
        result = await bash.exec("history")
        assert result.exit_code == 0
        # Should work with legacy format
        assert "echo hello" in result.stdout
        assert "ls -la" in result.stdout
