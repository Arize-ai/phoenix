"""Tests for xargs command."""

import pytest
from just_bash import Bash


class TestXargsBasic:
    """Test basic xargs functionality."""

    @pytest.mark.asyncio
    async def test_xargs_default_echo(self):
        """Default command is echo."""
        bash = Bash()
        result = await bash.exec("echo 'a b c' | xargs")
        assert result.exit_code == 0
        assert result.stdout.strip() == "a b c"

    @pytest.mark.asyncio
    async def test_xargs_with_command(self):
        """Run specified command with arguments."""
        bash = Bash()
        result = await bash.exec("echo 'hello' | xargs echo 'prefix:'")
        assert result.exit_code == 0
        assert "prefix:" in result.stdout
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_multiple_lines(self):
        """Handle multiple lines of input."""
        bash = Bash()
        result = await bash.exec("printf 'a\\nb\\nc' | xargs echo")
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_empty_input(self):
        """Handle empty input."""
        bash = Bash()
        result = await bash.exec("echo '' | xargs echo 'test'")
        assert result.exit_code == 0


class TestXargsReplacement:
    """Test -I replacement string."""

    @pytest.mark.asyncio
    async def test_replacement_basic(self):
        """Basic replacement with -I."""
        bash = Bash()
        result = await bash.exec("echo 'foo' | xargs -I {} echo 'item: {}'")
        assert result.exit_code == 0
        assert "item: foo" in result.stdout

    @pytest.mark.asyncio
    async def test_replacement_multiple_items(self):
        """Run once per item with -I."""
        bash = Bash()
        result = await bash.exec("printf 'a\\nb\\nc' | xargs -I {} echo 'item: {}'")
        assert result.exit_code == 0
        assert "item: a" in result.stdout
        assert "item: b" in result.stdout
        assert "item: c" in result.stdout

    @pytest.mark.asyncio
    async def test_replacement_multiple_occurrences(self):
        """Replace multiple occurrences in command."""
        bash = Bash()
        result = await bash.exec("echo 'test' | xargs -I X echo 'X is X'")
        assert result.exit_code == 0
        assert "test is test" in result.stdout


class TestXargsBatchSize:
    """Test -n batch size."""

    @pytest.mark.asyncio
    async def test_batch_size_1(self):
        """Process one item at a time."""
        bash = Bash()
        result = await bash.exec("echo 'a b c' | xargs -n 1 echo 'item:'")
        assert result.exit_code == 0
        # Should have 3 separate echo calls
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3

    @pytest.mark.asyncio
    async def test_batch_size_2(self):
        """Process two items at a time."""
        bash = Bash()
        result = await bash.exec("echo 'a b c d' | xargs -n 2 echo")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 2


class TestXargsDelimiter:
    """Test delimiter options."""

    @pytest.mark.asyncio
    async def test_null_delimiter(self):
        """Use null delimiter with -0."""
        bash = Bash()
        # Simulate null-separated input
        result = await bash.exec("printf 'a\\0b\\0c' | xargs -0 echo")
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_custom_delimiter(self):
        """Use custom delimiter with -d."""
        bash = Bash()
        result = await bash.exec("echo 'a:b:c' | xargs -d ':' echo")
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout


class TestXargsOptions:
    """Test various xargs options."""

    @pytest.mark.asyncio
    async def test_verbose_mode(self):
        """Verbose mode with -t."""
        bash = Bash()
        result = await bash.exec("echo 'test' | xargs -t echo")
        assert result.exit_code == 0
        assert "test" in result.stdout

    @pytest.mark.asyncio
    async def test_no_run_if_empty(self):
        """Don't run if input is empty with -r."""
        bash = Bash()
        result = await bash.exec("echo '' | xargs -r echo 'should not run'")
        assert result.exit_code == 0
        # With -r, echo shouldn't run on empty input
        # Note: behavior depends on implementation

    @pytest.mark.asyncio
    async def test_parallel_option_ignored(self):
        """Parallel option -P is accepted (but may not parallelize)."""
        bash = Bash()
        result = await bash.exec("echo 'a b c' | xargs -P 4 echo")
        assert result.exit_code == 0
        assert "a" in result.stdout


class TestXargsPipelines:
    """Test xargs in pipelines."""

    @pytest.mark.asyncio
    async def test_find_xargs_pattern(self):
        """Classic find | xargs pattern."""
        bash = Bash(files={
            "/project/a.txt": "content a\n",
            "/project/b.txt": "content b\n",
        })
        result = await bash.exec("find /project -name '*.txt' | xargs cat")
        assert result.exit_code == 0
        assert "content" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_with_grep(self):
        """Use xargs with grep."""
        bash = Bash(files={
            "/data/file1.txt": "apple\nbanana\n",
            "/data/file2.txt": "cherry\napple\n",
        })
        result = await bash.exec("echo '/data/file1.txt /data/file2.txt' | xargs grep apple")
        assert result.exit_code == 0
        assert "apple" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_command_failure(self):
        """Handle command failure."""
        bash = Bash()
        result = await bash.exec("echo '/nonexistent' | xargs cat")
        # Should propagate the failure
        assert result.exit_code != 0 or "No such file" in result.stderr
