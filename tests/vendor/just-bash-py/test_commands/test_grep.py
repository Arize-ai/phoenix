"""Tests for grep command."""

import pytest
from just_bash import Bash


class TestGrepBasic:
    """Test basic grep functionality."""

    @pytest.mark.asyncio
    async def test_grep_simple_match(self):
        """Simple pattern match."""
        bash = Bash(files={"/test.txt": "hello\nworld\nhello world\n"})
        result = await bash.exec("grep hello /test.txt")
        assert result.exit_code == 0
        assert "hello" in result.stdout
        assert result.stdout.count("\n") == 2  # Two matching lines

    @pytest.mark.asyncio
    async def test_grep_no_match(self):
        """No match returns exit code 1."""
        bash = Bash(files={"/test.txt": "hello\nworld\n"})
        result = await bash.exec("grep notfound /test.txt")
        assert result.exit_code == 1
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_grep_stdin(self):
        """Read from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'hello world' | grep hello")
        assert result.exit_code == 0
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_ignore_case(self):
        """Case-insensitive matching with -i."""
        bash = Bash(files={"/test.txt": "Hello\nWORLD\nhello\n"})
        result = await bash.exec("grep -i hello /test.txt")
        assert result.exit_code == 0
        assert "Hello" in result.stdout
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_invert_match(self):
        """Invert match with -v."""
        bash = Bash(files={"/test.txt": "apple\nbanana\ncherry\n"})
        result = await bash.exec("grep -v banana /test.txt")
        assert result.exit_code == 0
        assert "apple" in result.stdout
        assert "cherry" in result.stdout
        assert "banana" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_line_number(self):
        """Show line numbers with -n."""
        bash = Bash(files={"/test.txt": "apple\nbanana\ncherry\n"})
        result = await bash.exec("grep -n banana /test.txt")
        assert result.exit_code == 0
        assert "2:" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_count(self):
        """Count matches with -c."""
        bash = Bash(files={"/test.txt": "apple\napple pie\nbanana\napple tart\n"})
        result = await bash.exec("grep -c apple /test.txt")
        assert result.exit_code == 0
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_files_with_matches(self):
        """List matching files with -l."""
        bash = Bash(files={
            "/a.txt": "apple\n",
            "/b.txt": "banana\n",
        })
        result = await bash.exec("grep -l apple /a.txt /b.txt")
        assert result.exit_code == 0
        assert "/a.txt" in result.stdout
        assert "/b.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_files_without_match(self):
        """List non-matching files with -L."""
        bash = Bash(files={
            "/a.txt": "apple\n",
            "/b.txt": "banana\n",
        })
        result = await bash.exec("grep -L apple /a.txt /b.txt")
        assert result.exit_code == 0
        assert "/b.txt" in result.stdout
        assert "/a.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_only_matching(self):
        """Show only matching part with -o."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("grep -o hello /test.txt")
        assert result.exit_code == 0
        assert result.stdout.strip() == "hello"

    @pytest.mark.asyncio
    async def test_grep_quiet(self):
        """Quiet mode with -q."""
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("grep -q hello /test.txt")
        assert result.exit_code == 0
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_grep_word_regexp(self):
        """Word boundary matching with -w."""
        bash = Bash(files={"/test.txt": "hello\nhelloworld\nworld hello\n"})
        result = await bash.exec("grep -w hello /test.txt")
        assert result.exit_code == 0
        assert "hello\n" in result.stdout
        assert "world hello" in result.stdout
        # "helloworld" should not match
        lines = [l for l in result.stdout.strip().split("\n") if l]
        assert not any("helloworld" in l for l in lines)

    @pytest.mark.asyncio
    async def test_grep_line_regexp(self):
        """Full line matching with -x."""
        bash = Bash(files={"/test.txt": "hello\nhello world\n"})
        result = await bash.exec("grep -x hello /test.txt")
        assert result.exit_code == 0
        assert result.stdout.strip() == "hello"

    @pytest.mark.asyncio
    async def test_grep_fixed_strings(self):
        """Fixed string matching with -F."""
        bash = Bash(files={"/test.txt": "a.b\na*b\na+b\n"})
        result = await bash.exec("grep -F 'a.b' /test.txt")
        assert result.exit_code == 0
        assert "a.b" in result.stdout
        # Regex chars should be treated literally
        assert result.stdout.count("\n") == 1


class TestGrepContext:
    """Test context line options (-A, -B, -C)."""

    @pytest.mark.asyncio
    async def test_context_after(self):
        """Show lines after match with -A."""
        bash = Bash(files={"/test.txt": "line1\nmatch\nline3\nline4\nline5\n"})
        result = await bash.exec("grep -A 2 match /test.txt")
        assert result.exit_code == 0
        assert "match" in result.stdout
        assert "line3" in result.stdout
        assert "line4" in result.stdout

    @pytest.mark.asyncio
    async def test_context_before(self):
        """Show lines before match with -B."""
        bash = Bash(files={"/test.txt": "line1\nline2\nmatch\nline4\n"})
        result = await bash.exec("grep -B 2 match /test.txt")
        assert result.exit_code == 0
        assert "line1" in result.stdout
        assert "line2" in result.stdout
        assert "match" in result.stdout

    @pytest.mark.asyncio
    async def test_context_both(self):
        """Show lines around match with -C."""
        bash = Bash(files={"/test.txt": "line1\nline2\nmatch\nline4\nline5\n"})
        result = await bash.exec("grep -C 1 match /test.txt")
        assert result.exit_code == 0
        assert "line2" in result.stdout
        assert "match" in result.stdout
        assert "line4" in result.stdout

    @pytest.mark.asyncio
    async def test_context_multiple_matches(self):
        """Context with multiple matches."""
        bash = Bash(files={"/test.txt": "a\nmatch1\nb\nc\nmatch2\nd\n"})
        result = await bash.exec("grep -A 1 match /test.txt")
        assert result.exit_code == 0
        assert "match1" in result.stdout
        assert "b" in result.stdout
        assert "match2" in result.stdout
        assert "d" in result.stdout


class TestGrepMaxCount:
    """Test max count option (-m)."""

    @pytest.mark.asyncio
    async def test_max_count(self):
        """Stop after N matches with -m."""
        bash = Bash(files={"/test.txt": "apple\napple\napple\napple\napple\n"})
        result = await bash.exec("grep -m 2 apple /test.txt")
        assert result.exit_code == 0
        assert result.stdout.count("apple") == 2


class TestGrepMultiplePatterns:
    """Test multiple pattern option (-e)."""

    @pytest.mark.asyncio
    async def test_multiple_patterns(self):
        """Match multiple patterns with -e."""
        bash = Bash(files={"/test.txt": "apple\nbanana\ncherry\n"})
        result = await bash.exec("grep -e apple -e cherry /test.txt")
        assert result.exit_code == 0
        assert "apple" in result.stdout
        assert "cherry" in result.stdout
        assert "banana" not in result.stdout


class TestGrepIncludeExclude:
    """Test include/exclude glob options."""

    @pytest.mark.asyncio
    async def test_include_glob(self):
        """Include only matching files with --include."""
        bash = Bash(files={
            "/dir/a.txt": "hello\n",
            "/dir/b.log": "hello\n",
            "/dir/c.txt": "hello\n",
        })
        result = await bash.exec("grep -r --include='*.txt' hello /dir")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "c.txt" in result.stdout
        assert "b.log" not in result.stdout

    @pytest.mark.asyncio
    async def test_exclude_glob(self):
        """Exclude matching files with --exclude."""
        bash = Bash(files={
            "/dir/a.txt": "hello\n",
            "/dir/b.log": "hello\n",
            "/dir/c.txt": "hello\n",
        })
        result = await bash.exec("grep -r --exclude='*.log' hello /dir")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "c.txt" in result.stdout
        assert "b.log" not in result.stdout


class TestGrepRecursive:
    """Test recursive search."""

    @pytest.mark.asyncio
    async def test_recursive_search(self):
        """Recursive directory search with -r."""
        bash = Bash(files={
            "/dir/a.txt": "hello\n",
            "/dir/sub/b.txt": "hello world\n",
        })
        result = await bash.exec("grep -r hello /dir")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout


class TestGrepFilename:
    """Test filename display options."""

    @pytest.mark.asyncio
    async def test_with_filename(self):
        """Show filename with -H."""
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("grep -H hello /test.txt")
        assert result.exit_code == 0
        assert "/test.txt:" in result.stdout

    @pytest.mark.asyncio
    async def test_no_filename(self):
        """Hide filename with -h."""
        bash = Bash(files={
            "/a.txt": "hello\n",
            "/b.txt": "hello\n",
        })
        result = await bash.exec("grep -h hello /a.txt /b.txt")
        assert result.exit_code == 0
        assert "a.txt" not in result.stdout
        assert "b.txt" not in result.stdout
        assert result.stdout.count("hello") == 2
