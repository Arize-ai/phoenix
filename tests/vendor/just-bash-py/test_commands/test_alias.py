"""Tests for alias and unalias builtins."""

import pytest
from just_bash import Bash


class TestAliasBasic:
    """Test basic alias functionality."""

    @pytest.mark.asyncio
    async def test_alias_define(self):
        """Define an alias."""
        bash = Bash()
        result = await bash.exec("alias ll='ls -la'")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_alias_show(self):
        """Show a defined alias."""
        bash = Bash()
        await bash.exec("alias ll='ls -la'")
        result = await bash.exec("alias ll")
        assert result.exit_code == 0
        assert "ll=" in result.stdout
        assert "ls -la" in result.stdout

    @pytest.mark.asyncio
    async def test_alias_show_all(self):
        """Show all aliases."""
        bash = Bash()
        await bash.exec("alias ll='ls -la'")
        await bash.exec("alias la='ls -a'")
        result = await bash.exec("alias")
        assert result.exit_code == 0
        assert "ll=" in result.stdout
        assert "la=" in result.stdout

    @pytest.mark.asyncio
    async def test_alias_not_found(self):
        """Show error for non-existent alias."""
        bash = Bash()
        result = await bash.exec("alias nonexistent")
        assert result.exit_code == 1
        assert "not found" in result.stderr

    @pytest.mark.asyncio
    async def test_alias_multiple_define(self):
        """Define multiple aliases at once."""
        bash = Bash()
        result = await bash.exec("alias ll='ls -la' la='ls -a'")
        assert result.exit_code == 0

        # Verify both are defined
        result = await bash.exec("alias")
        assert "ll=" in result.stdout
        assert "la=" in result.stdout


class TestAliasExpansion:
    """Test alias expansion during command execution."""

    @pytest.mark.asyncio
    async def test_alias_expansion_simple(self):
        """Alias is expanded during command execution."""
        bash = Bash()
        await bash.exec("alias greet='echo hello'")
        result = await bash.exec("greet")
        assert result.stdout.strip() == "hello"

    @pytest.mark.asyncio
    async def test_alias_expansion_with_args(self):
        """Alias expansion with additional arguments."""
        bash = Bash()
        await bash.exec("alias say='echo'")
        result = await bash.exec("say world")
        assert result.stdout.strip() == "world"

    @pytest.mark.asyncio
    async def test_alias_expansion_in_script(self):
        """Alias in a script (shopt expand_aliases needed)."""
        bash = Bash()
        # Note: In non-interactive shells, aliases may not expand by default
        await bash.exec("shopt -s expand_aliases")
        await bash.exec("alias greet='echo hello'")
        result = await bash.exec("greet")
        assert result.stdout.strip() == "hello"


class TestUnalias:
    """Test unalias builtin."""

    @pytest.mark.asyncio
    async def test_unalias_basic(self):
        """Remove an alias."""
        bash = Bash()
        await bash.exec("alias ll='ls -la'")
        result = await bash.exec("unalias ll")
        assert result.exit_code == 0

        # Verify it's removed
        result = await bash.exec("alias ll")
        assert result.exit_code == 1
        assert "not found" in result.stderr

    @pytest.mark.asyncio
    async def test_unalias_not_found(self):
        """Error when removing non-existent alias."""
        bash = Bash()
        result = await bash.exec("unalias nonexistent")
        assert result.exit_code == 1
        assert "not found" in result.stderr

    @pytest.mark.asyncio
    async def test_unalias_all(self):
        """Remove all aliases with -a."""
        bash = Bash()
        await bash.exec("alias ll='ls -la'")
        await bash.exec("alias la='ls -a'")
        result = await bash.exec("unalias -a")
        assert result.exit_code == 0

        # Verify all removed
        result = await bash.exec("alias")
        assert result.stdout.strip() == ""

    @pytest.mark.asyncio
    async def test_unalias_multiple(self):
        """Remove multiple aliases at once."""
        bash = Bash()
        await bash.exec("alias ll='ls -la'")
        await bash.exec("alias la='ls -a'")
        await bash.exec("alias lh='ls -lh'")
        result = await bash.exec("unalias ll lh")
        assert result.exit_code == 0

        # Verify only la remains
        result = await bash.exec("alias")
        assert "la=" in result.stdout
        assert "ll=" not in result.stdout
        assert "lh=" not in result.stdout


class TestAliasOptions:
    """Test alias command options."""

    @pytest.mark.asyncio
    async def test_alias_print_format(self):
        """Print aliases in reusable format with -p."""
        bash = Bash()
        await bash.exec("alias ll='ls -la'")
        result = await bash.exec("alias -p")
        assert result.exit_code == 0
        assert "alias ll=" in result.stdout

    @pytest.mark.asyncio
    async def test_alias_invalid_option(self):
        """Error on invalid option."""
        bash = Bash()
        result = await bash.exec("alias -z")
        assert result.exit_code == 1
        assert "invalid option" in result.stderr


class TestAliasEdgeCases:
    """Test edge cases for aliases."""

    @pytest.mark.asyncio
    async def test_alias_with_quotes(self):
        """Alias value containing quotes."""
        bash = Bash()
        await bash.exec("""alias say="echo 'hello world'" """)
        result = await bash.exec("alias say")
        assert result.exit_code == 0
        assert "hello world" in result.stdout

    @pytest.mark.asyncio
    async def test_alias_with_pipe(self):
        """Alias containing pipe."""
        bash = Bash()
        await bash.exec("alias mygrep='cat | grep'")
        result = await bash.exec("alias mygrep")
        assert "mygrep=" in result.stdout
        assert "cat | grep" in result.stdout

    @pytest.mark.asyncio
    async def test_alias_redefine(self):
        """Redefine an existing alias."""
        bash = Bash()
        await bash.exec("alias ll='ls -la'")
        await bash.exec("alias ll='ls -lah'")
        result = await bash.exec("alias ll")
        assert "ls -lah" in result.stdout
        assert "ls -la'" not in result.stdout

    @pytest.mark.asyncio
    async def test_alias_empty_value(self):
        """Alias with empty value."""
        bash = Bash()
        result = await bash.exec("alias empty=''")
        assert result.exit_code == 0
        result = await bash.exec("alias empty")
        assert "empty=''" in result.stdout
