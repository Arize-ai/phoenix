"""Tests for minor command improvements (ls, stat, uniq, cut, head, tail, wc)."""

import pytest
from just_bash import Bash


class TestLsExtended:
    """Test extended ls options."""

    @pytest.mark.asyncio
    async def test_ls_reverse(self):
        """Reverse sort with -r."""
        bash = Bash(files={
            "/dir/a.txt": "a\n",
            "/dir/b.txt": "b\n",
            "/dir/c.txt": "c\n",
        })
        result = await bash.exec("ls -1r /dir")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "c.txt"
        assert lines[-1] == "a.txt"

    @pytest.mark.asyncio
    async def test_ls_all(self):
        """Show hidden files with -a."""
        bash = Bash(files={
            "/dir/.hidden": "hidden\n",
            "/dir/visible": "visible\n",
        })
        result = await bash.exec("ls -a /dir")
        assert result.exit_code == 0
        assert ".hidden" in result.stdout
        assert "visible" in result.stdout


class TestStatExtended:
    """Test extended stat options."""

    @pytest.mark.asyncio
    async def test_stat_basic(self):
        """Basic stat output."""
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("stat /test.txt")
        assert result.exit_code == 0
        assert "test.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_stat_format_size(self):
        """Stat format %s (size)."""
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("stat -c '%s' /test.txt")
        assert result.exit_code == 0
        assert "6" in result.stdout  # "hello\n" is 6 bytes


class TestUniqExtended:
    """Test extended uniq options."""

    @pytest.mark.asyncio
    async def test_uniq_basic(self):
        """Basic unique lines."""
        bash = Bash(files={"/test.txt": "a\na\nb\nb\nc\n"})
        result = await bash.exec("uniq /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["a", "b", "c"]

    @pytest.mark.asyncio
    async def test_uniq_count(self):
        """Count occurrences with -c."""
        bash = Bash(files={"/test.txt": "a\na\nb\nc\nc\nc\n"})
        result = await bash.exec("uniq -c /test.txt")
        assert result.exit_code == 0
        assert "2" in result.stdout  # 2 a's
        assert "3" in result.stdout  # 3 c's

    @pytest.mark.asyncio
    async def test_uniq_duplicates_only(self):
        """Show only duplicates with -d."""
        bash = Bash(files={"/test.txt": "a\na\nb\nc\nc\n"})
        result = await bash.exec("uniq -d /test.txt")
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "c" in result.stdout
        assert "b" not in result.stdout


class TestCutExtended:
    """Test extended cut options."""

    @pytest.mark.asyncio
    async def test_cut_fields(self):
        """Cut by fields with -f."""
        bash = Bash()
        result = await bash.exec("echo 'a:b:c' | cut -d: -f2")
        assert result.exit_code == 0
        assert result.stdout.strip() == "b"

    @pytest.mark.asyncio
    async def test_cut_characters(self):
        """Cut by characters with -c."""
        bash = Bash()
        result = await bash.exec("echo 'hello' | cut -c2-4")
        assert result.exit_code == 0
        assert result.stdout.strip() == "ell"

    @pytest.mark.asyncio
    async def test_cut_multiple_fields(self):
        """Cut multiple fields."""
        bash = Bash()
        result = await bash.exec("echo 'a:b:c:d' | cut -d: -f1,3")
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "c" in result.stdout


class TestHeadTailExtended:
    """Test extended head/tail options."""

    @pytest.mark.asyncio
    async def test_head_default(self):
        """Head shows first 10 lines by default."""
        lines = "\n".join([f"line{i}" for i in range(20)])
        bash = Bash(files={"/test.txt": lines + "\n"})
        result = await bash.exec("head /test.txt")
        assert result.exit_code == 0
        output_lines = result.stdout.strip().split("\n")
        assert len(output_lines) == 10
        assert "line0" in output_lines[0]

    @pytest.mark.asyncio
    async def test_head_n(self):
        """Head with -n option."""
        bash = Bash(files={"/test.txt": "a\nb\nc\nd\ne\n"})
        result = await bash.exec("head -n 3 /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3

    @pytest.mark.asyncio
    async def test_tail_default(self):
        """Tail shows last 10 lines by default."""
        lines = "\n".join([f"line{i}" for i in range(20)])
        bash = Bash(files={"/test.txt": lines + "\n"})
        result = await bash.exec("tail /test.txt")
        assert result.exit_code == 0
        output_lines = result.stdout.strip().split("\n")
        assert len(output_lines) == 10
        assert "line19" in output_lines[-1]

    @pytest.mark.asyncio
    async def test_tail_n(self):
        """Tail with -n option."""
        bash = Bash(files={"/test.txt": "a\nb\nc\nd\ne\n"})
        result = await bash.exec("tail -n 2 /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["d", "e"]


class TestWcExtended:
    """Test extended wc options."""

    @pytest.mark.asyncio
    async def test_wc_lines(self):
        """Count lines with -l."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("wc -l /test.txt")
        assert result.exit_code == 0
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_words(self):
        """Count words with -w."""
        bash = Bash(files={"/test.txt": "hello world\nfoo bar baz\n"})
        result = await bash.exec("wc -w /test.txt")
        assert result.exit_code == 0
        assert "5" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_bytes(self):
        """Count bytes with -c."""
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("wc -c /test.txt")
        assert result.exit_code == 0
        assert "6" in result.stdout  # "hello\n" = 6 bytes

    @pytest.mark.asyncio
    async def test_wc_default(self):
        """Default wc shows lines, words, bytes."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("wc /test.txt")
        assert result.exit_code == 0
        # Should have 1 line, 2 words, 12 bytes
        assert "1" in result.stdout
        assert "2" in result.stdout
        assert "12" in result.stdout
