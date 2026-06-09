"""Tests for grep command edge cases (Phase 12)."""

import pytest
from just_bash import Bash


class TestGrepBasic:
    """Test basic grep functionality."""

    @pytest.mark.asyncio
    async def test_basic_match(self):
        bash = Bash(files={"/input.txt": "hello\nworld\nfoo"})
        result = await bash.exec("grep hello /input.txt")
        assert result.stdout == "hello\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_no_match(self):
        bash = Bash(files={"/input.txt": "hello\nworld"})
        result = await bash.exec("grep missing /input.txt")
        assert result.stdout == ""
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_ignore_case(self):
        bash = Bash(files={"/input.txt": "Hello\nWORLD\nfoo"})
        result = await bash.exec("grep -i hello /input.txt")
        assert result.stdout == "Hello\n"

    @pytest.mark.asyncio
    async def test_invert_match(self):
        bash = Bash(files={"/input.txt": "hello\nworld\nfoo"})
        result = await bash.exec("grep -v hello /input.txt")
        assert result.stdout == "world\nfoo\n"

    @pytest.mark.asyncio
    async def test_count(self):
        bash = Bash(files={"/input.txt": "hello\nworld\nhello again"})
        result = await bash.exec("grep -c hello /input.txt")
        assert result.stdout == "2\n"

    @pytest.mark.asyncio
    async def test_line_number(self):
        bash = Bash(files={"/input.txt": "hello\nworld\nfoo"})
        result = await bash.exec("grep -n world /input.txt")
        assert result.stdout == "2:world\n"

    @pytest.mark.asyncio
    async def test_quiet_match(self):
        bash = Bash(files={"/input.txt": "hello\nworld"})
        result = await bash.exec("grep -q hello /input.txt")
        assert result.stdout == ""
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_quiet_no_match(self):
        bash = Bash(files={"/input.txt": "hello\nworld"})
        result = await bash.exec("grep -q missing /input.txt")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_stdin(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | grep hello")
        assert result.stdout == "hello world\n"

    @pytest.mark.asyncio
    async def test_only_matching(self):
        bash = Bash(files={"/input.txt": "hello world"})
        result = await bash.exec("grep -o 'hell' /input.txt")
        assert result.stdout == "hell\n"


class TestGrepRegex:
    """Test grep regex patterns."""

    @pytest.mark.asyncio
    async def test_dot_matches_any(self):
        bash = Bash(files={"/input.txt": "cat\ncar\ncab\ndog"})
        result = await bash.exec("grep 'ca.' /input.txt")
        assert result.stdout == "cat\ncar\ncab\n"

    @pytest.mark.asyncio
    async def test_star_quantifier(self):
        bash = Bash(files={"/input.txt": "ab\naab\naaab\nb"})
        result = await bash.exec("grep 'a*b' /input.txt")
        assert result.stdout == "ab\naab\naaab\nb\n"

    @pytest.mark.asyncio
    async def test_anchored_start(self):
        bash = Bash(files={"/input.txt": "hello\nworld hello"})
        result = await bash.exec("grep '^hello' /input.txt")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_anchored_end(self):
        bash = Bash(files={"/input.txt": "hello world\nworld"})
        result = await bash.exec("grep 'world$' /input.txt")
        assert result.stdout == "hello world\nworld\n"

    @pytest.mark.asyncio
    async def test_character_class(self):
        bash = Bash(files={"/input.txt": "cat\ncut\ncot\ncit"})
        result = await bash.exec("grep 'c[aou]t' /input.txt")
        assert result.stdout == "cat\ncut\ncot\n"

    @pytest.mark.asyncio
    async def test_negated_character_class(self):
        bash = Bash(files={"/input.txt": "cat\ncut\ncot\ncit"})
        result = await bash.exec("grep 'c[^aou]t' /input.txt")
        assert result.stdout == "cit\n"

    @pytest.mark.asyncio
    async def test_bre_escaped_plus(self):
        """In BRE, + needs to be escaped as \\+."""
        bash = Bash(files={"/input.txt": "ab\naab\nb"})
        result = await bash.exec("grep 'a\\+b' /input.txt")
        assert result.stdout == "ab\naab\n"

    @pytest.mark.asyncio
    async def test_ere_plus(self):
        """In ERE, + is a quantifier."""
        bash = Bash(files={"/input.txt": "ab\naab\nb"})
        result = await bash.exec("grep -E 'a+b' /input.txt")
        assert result.stdout == "ab\naab\n"

    @pytest.mark.asyncio
    async def test_ere_alternation(self):
        bash = Bash(files={"/input.txt": "cat\ndog\nbird"})
        result = await bash.exec("grep -E 'cat|dog' /input.txt")
        assert result.stdout == "cat\ndog\n"

    @pytest.mark.asyncio
    async def test_word_boundary(self):
        bash = Bash(files={"/input.txt": "cat\ncatch\nthe cat"})
        result = await bash.exec("grep -w cat /input.txt")
        assert result.stdout == "cat\nthe cat\n"


class TestGrepContextLines:
    """Test grep context line options."""

    @pytest.mark.asyncio
    async def test_after_context(self):
        bash = Bash(files={"/input.txt": "a\nb\nc\nd\ne"})
        result = await bash.exec("grep -A1 'c' /input.txt")
        assert result.stdout == "c\nd\n"

    @pytest.mark.asyncio
    async def test_before_context(self):
        bash = Bash(files={"/input.txt": "a\nb\nc\nd\ne"})
        result = await bash.exec("grep -B1 'c' /input.txt")
        assert result.stdout == "b\nc\n"

    @pytest.mark.asyncio
    async def test_context_both(self):
        bash = Bash(files={"/input.txt": "a\nb\nc\nd\ne"})
        result = await bash.exec("grep -C1 'c' /input.txt")
        assert result.stdout == "b\nc\nd\n"


class TestGrepFixedString:
    """Test grep -F (fixed string) mode."""

    @pytest.mark.asyncio
    async def test_fixed_string(self):
        bash = Bash(files={"/input.txt": "a.b\naxb\na*b"})
        result = await bash.exec("grep -F 'a.b' /input.txt")
        assert result.stdout == "a.b\n"

    @pytest.mark.asyncio
    async def test_fgrep(self):
        bash = Bash(files={"/input.txt": "a.b\naxb\na*b"})
        result = await bash.exec("fgrep 'a.b' /input.txt")
        assert result.stdout == "a.b\n"


class TestGrepMultiplePatterns:
    """Test grep with multiple patterns."""

    @pytest.mark.asyncio
    async def test_multiple_e_patterns(self):
        bash = Bash(files={"/input.txt": "cat\ndog\nbird\nfish"})
        result = await bash.exec("grep -e cat -e dog /input.txt")
        assert result.stdout == "cat\ndog\n"

    @pytest.mark.asyncio
    async def test_files_with_matches(self):
        bash = Bash(files={"/a.txt": "hello\n", "/b.txt": "world\n", "/c.txt": "hello world\n"})
        result = await bash.exec("grep -l hello /a.txt /b.txt /c.txt")
        assert "/a.txt" in result.stdout
        assert "/c.txt" in result.stdout
        assert "/b.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_files_without_matches(self):
        bash = Bash(files={"/a.txt": "hello\n", "/b.txt": "world\n"})
        result = await bash.exec("grep -L hello /a.txt /b.txt")
        assert result.stdout == "/b.txt\n"


class TestGrepExitCodes:
    """Test grep exit codes."""

    @pytest.mark.asyncio
    async def test_match_exit_0(self):
        bash = Bash(files={"/input.txt": "hello"})
        result = await bash.exec("grep hello /input.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_no_match_exit_1(self):
        bash = Bash(files={"/input.txt": "hello"})
        result = await bash.exec("grep xyz /input.txt")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_whole_line_match(self):
        bash = Bash(files={"/input.txt": "hello\nhello world"})
        result = await bash.exec("grep -x hello /input.txt")
        assert result.stdout == "hello\n"
