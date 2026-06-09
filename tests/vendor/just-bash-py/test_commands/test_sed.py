"""Tests for sed command."""

import pytest
from just_bash import Bash


class TestSedBasic:
    """Test basic sed functionality."""

    @pytest.mark.asyncio
    async def test_sed_substitute(self):
        """Basic substitution."""
        bash = Bash()
        result = await bash.exec("echo 'hello world' | sed 's/world/there/'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "hello there"

    @pytest.mark.asyncio
    async def test_sed_substitute_global(self):
        """Global substitution with g flag."""
        bash = Bash()
        result = await bash.exec("echo 'aaa' | sed 's/a/b/g'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "bbb"

    @pytest.mark.asyncio
    async def test_sed_delete(self):
        """Delete command."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sed '2d' /test.txt")
        assert result.exit_code == 0
        assert result.stdout == "a\nc\n"

    @pytest.mark.asyncio
    async def test_sed_print(self):
        """Print command with -n."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sed -n '2p' /test.txt")
        assert result.exit_code == 0
        assert result.stdout.strip() == "b"

    @pytest.mark.asyncio
    async def test_sed_line_address(self):
        """Line number address."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sed '2s/b/B/' /test.txt")
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "B" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_sed_regex_address(self):
        """Regex address."""
        bash = Bash(files={"/test.txt": "apple\nbanana\napricot\n"})
        result = await bash.exec("sed '/^a/d' /test.txt")
        assert result.exit_code == 0
        assert result.stdout.strip() == "banana"

    @pytest.mark.asyncio
    async def test_sed_multiple_commands(self):
        """Multiple commands with -e."""
        bash = Bash()
        result = await bash.exec("echo 'hello' | sed -e 's/h/H/' -e 's/o/O/'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "HellO"

    @pytest.mark.asyncio
    async def test_sed_in_place(self):
        """In-place editing with -i."""
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("sed -i 's/hello/goodbye/' /test.txt")
        assert result.exit_code == 0
        content = await bash.fs.read_file("/test.txt")
        assert "goodbye" in content


class TestSedHoldSpace:
    """Test hold space commands (h, H, g, G, x)."""

    @pytest.mark.asyncio
    async def test_hold_copy(self):
        """Copy pattern space to hold space with h."""
        bash = Bash(files={"/test.txt": "first\nsecond\n"})
        # h copies to hold, $ (last line) g gets it back, p prints
        result = await bash.exec("sed -n '1h;$g;$p' /test.txt")
        assert result.exit_code == 0
        assert result.stdout.strip() == "first"

    @pytest.mark.asyncio
    async def test_hold_append(self):
        """Append pattern space to hold space with H."""
        bash = Bash(files={"/test.txt": "a\nb\n"})
        # H appends with newline
        result = await bash.exec("sed -n 'H;$g;$p' /test.txt")
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "b" in result.stdout

    @pytest.mark.asyncio
    async def test_get_copy(self):
        """Copy hold space to pattern space with g."""
        bash = Bash(files={"/test.txt": "first\nsecond\n"})
        result = await bash.exec("sed -n '1h;$g;$p' /test.txt")
        assert result.exit_code == 0
        assert result.stdout.strip() == "first"

    @pytest.mark.asyncio
    async def test_get_append(self):
        """Append hold space to pattern space with G."""
        bash = Bash(files={"/test.txt": "a\nb\n"})
        result = await bash.exec("sed -n '1h;$G;$p' /test.txt")
        assert result.exit_code == 0
        # Should have 'b' then newline then 'a'
        assert "b" in result.stdout
        assert "a" in result.stdout

    @pytest.mark.asyncio
    async def test_exchange(self):
        """Exchange pattern and hold space with x."""
        bash = Bash(files={"/test.txt": "first\nsecond\n"})
        result = await bash.exec("sed -n '1h;2x;2p' /test.txt")
        assert result.exit_code == 0
        # 2x exchanges, 2p prints what was in hold (first)
        assert "first" in result.stdout


class TestSedNext:
    """Test next commands (n, N)."""

    @pytest.mark.asyncio
    async def test_next_line(self):
        """Read next line with n."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sed 'n;d' /test.txt")
        assert result.exit_code == 0
        # n reads next (b), d deletes it, then c is read normally
        assert "a" in result.stdout

    @pytest.mark.asyncio
    async def test_next_append(self):
        """Append next line with N."""
        bash = Bash(files={"/test.txt": "first\nsecond\n"})
        result = await bash.exec("sed 'N;s/\\n/ /' /test.txt")
        assert result.exit_code == 0
        assert "first second" in result.stdout


class TestSedBranching:
    """Test branching commands (b, t, T) and labels."""

    @pytest.mark.asyncio
    async def test_branch_unconditional(self):
        """Unconditional branch with b."""
        bash = Bash(files={"/test.txt": "hello\n"})
        # Branch to end skips the substitution
        result = await bash.exec("sed 'b end;s/hello/goodbye/;:end' /test.txt")
        assert result.exit_code == 0
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_branch_on_substitute(self):
        """Branch on successful substitute with t."""
        bash = Bash(files={"/test.txt": "aaa\nbbb\n"})
        result = await bash.exec("sed 's/a/X/;t done;s/b/Y/;:done' /test.txt")
        assert result.exit_code == 0
        # First line: s/a/X/ succeeds, branches past s/b/Y/
        # Second line: s/a/X/ fails, s/b/Y/ runs
        assert "Xaa" in result.stdout
        assert "Ybb" in result.stdout


class TestSedPrintDelete:
    """Test P and D commands."""

    @pytest.mark.asyncio
    async def test_print_first_line(self):
        """Print up to first newline with P."""
        bash = Bash(files={"/test.txt": "a\nb\n"})
        result = await bash.exec("sed -n 'N;P' /test.txt")
        assert result.exit_code == 0
        assert result.stdout.strip() == "a"

    @pytest.mark.asyncio
    async def test_delete_first_line(self):
        """Delete up to first newline with D."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sed 'N;D' /test.txt")
        assert result.exit_code == 0
        # After N, pattern space is "a\nb", D deletes "a\n", leaves "b"
        # Then c is read...


class TestSedFileIO:
    """Test file I/O commands (r, w) - basic tests."""

    @pytest.mark.asyncio
    async def test_read_command_parsed(self):
        """r command is parsed without error."""
        bash = Bash(files={"/main.txt": "test\n"})
        # Just verify r command doesn't cause parse error
        result = await bash.exec("sed 'r /some/file' /main.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_write_command_parsed(self):
        """w command is parsed without error."""
        bash = Bash(files={"/test.txt": "test\n"})
        # Just verify w command doesn't cause parse error
        result = await bash.exec("sed 'w /output.txt' /test.txt")
        assert result.exit_code == 0


class TestSedChangeCommand:
    """Test c (change) command."""

    @pytest.mark.asyncio
    async def test_change_line(self):
        """Change entire line with c."""
        bash = Bash(files={"/test.txt": "old line\n"})
        result = await bash.exec("sed 'c\\new line' /test.txt")
        assert result.exit_code == 0
        assert "new line" in result.stdout
        assert "old" not in result.stdout
