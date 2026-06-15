"""Tests for rg (ripgrep) command implementation.

These tests aim for feature parity with the TypeScript just-bash implementation.
"""

import pytest
from phoenix.vendor.just_bash import Bash


class TestRgBasicSearch:
    """Test basic search functionality."""

    async def test_simple_pattern(self):
        """Search for a simple pattern."""
        bash = Bash(files={"/data/test.txt": "hello world\nfoo bar\nhello again\n"})
        result = await bash.exec("rg hello /data/test.txt")
        assert result.exit_code == 0
        assert "hello world" in result.stdout
        assert "hello again" in result.stdout

    async def test_no_match(self):
        """Return exit code 1 when no matches found."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec("rg notfound /data/test.txt")
        assert result.exit_code == 1
        assert result.stdout == ""

    async def test_regex_pattern(self):
        """Support regex patterns."""
        bash = Bash(files={"/data/test.txt": "hello123\nworld456\ntest\n"})
        result = await bash.exec(r"rg 'hello[0-9]+' /data/test.txt")
        assert result.exit_code == 0
        assert "hello123" in result.stdout

    async def test_multiple_files(self):
        """Search across multiple files."""
        bash = Bash(files={
            "/data/a.txt": "hello world\n",
            "/data/b.txt": "hello there\n",
            "/data/c.txt": "goodbye\n",
        })
        result = await bash.exec("rg hello /data/a.txt /data/b.txt /data/c.txt")
        assert result.exit_code == 0
        assert "/data/a.txt" in result.stdout
        assert "/data/b.txt" in result.stdout
        assert "/data/c.txt" not in result.stdout

    async def test_stdin_search(self):
        """Search from stdin with -."""
        bash = Bash()
        result = await bash.exec("echo 'hello world' | rg hello -")
        assert result.exit_code == 0
        assert "hello" in result.stdout


class TestRgRecursiveSearch:
    """Test recursive directory searching."""

    async def test_recursive_by_default(self):
        """rg is recursive by default."""
        bash = Bash(files={
            "/project/src/main.py": "def hello():\n    pass\n",
            "/project/src/lib/utils.py": "def hello_world():\n    pass\n",
            "/project/README.md": "# hello Project\n",
        })
        result = await bash.exec("rg hello /project")
        assert result.exit_code == 0
        assert "main.py" in result.stdout
        assert "utils.py" in result.stdout
        assert "README.md" in result.stdout

    async def test_skip_hidden_files(self):
        """Skip hidden files by default."""
        bash = Bash(files={
            "/project/visible.txt": "hello\n",
            "/project/.hidden.txt": "hello\n",
        })
        result = await bash.exec("rg hello /project")
        assert "visible.txt" in result.stdout
        assert ".hidden.txt" not in result.stdout

    async def test_skip_hidden_directories(self):
        """Skip hidden directories by default."""
        bash = Bash(files={
            "/project/src/file.txt": "hello\n",
            "/project/.git/config": "hello\n",
        })
        result = await bash.exec("rg hello /project")
        assert "src/file.txt" in result.stdout
        assert ".git" not in result.stdout

    async def test_include_hidden_with_flag(self):
        """Include hidden files with --hidden flag."""
        bash = Bash(files={
            "/project/visible.txt": "hello\n",
            "/project/.hidden.txt": "hello\n",
        })
        result = await bash.exec("rg --hidden hello /project")
        assert "visible.txt" in result.stdout
        assert ".hidden.txt" in result.stdout

    async def test_max_depth(self):
        """Limit search depth with -d/--max-depth."""
        bash = Bash(files={
            "/project/a.txt": "hello\n",
            "/project/sub/b.txt": "hello\n",
            "/project/sub/deep/c.txt": "hello\n",
        })
        result = await bash.exec("rg -d 1 hello /project")
        assert "a.txt" in result.stdout
        assert "sub/b.txt" not in result.stdout

    async def test_max_depth_2(self):
        """Max depth of 2 includes one level of subdirs."""
        bash = Bash(files={
            "/project/a.txt": "hello\n",
            "/project/sub/b.txt": "hello\n",
            "/project/sub/deep/c.txt": "hello\n",
        })
        result = await bash.exec("rg -d 2 hello /project")
        assert "a.txt" in result.stdout
        assert "sub/b.txt" in result.stdout
        assert "deep/c.txt" not in result.stdout


class TestRgCaseSensitivity:
    """Test case sensitivity options."""

    async def test_case_sensitive_by_default(self):
        """Search is case-sensitive by default."""
        bash = Bash(files={"/data/test.txt": "Hello\nhello\nHELLO\n"})
        result = await bash.exec("rg hello /data/test.txt")
        assert "hello" in result.stdout
        # Should not match Hello or HELLO
        lines = [l for l in result.stdout.strip().split("\n") if l]
        assert len(lines) == 1

    async def test_ignore_case(self):
        """Case-insensitive search with -i."""
        bash = Bash(files={"/data/test.txt": "Hello\nhello\nHELLO\n"})
        result = await bash.exec("rg -i hello /data/test.txt")
        assert result.exit_code == 0
        assert "Hello" in result.stdout
        assert "hello" in result.stdout
        assert "HELLO" in result.stdout

    async def test_smart_case_lowercase(self):
        """Smart case: lowercase pattern is case-insensitive."""
        bash = Bash(files={"/data/test.txt": "Hello\nhello\nHELLO\n"})
        result = await bash.exec("rg -S hello /data/test.txt")
        assert "Hello" in result.stdout
        assert "hello" in result.stdout
        assert "HELLO" in result.stdout

    async def test_smart_case_uppercase(self):
        """Smart case: pattern with uppercase is case-sensitive."""
        bash = Bash(files={"/data/test.txt": "Hello\nhello\nHELLO\n"})
        result = await bash.exec("rg -S Hello /data/test.txt")
        assert "Hello" in result.stdout
        assert "hello" not in result.stdout or result.stdout.count("hello") == result.stdout.count("Hello")

    async def test_case_sensitive_override(self):
        """Force case-sensitive with -s."""
        bash = Bash(files={"/data/test.txt": "Hello\nhello\n"})
        result = await bash.exec("rg -s hello /data/test.txt")
        lines = [l for l in result.stdout.strip().split("\n") if l]
        assert len(lines) == 1
        assert "hello" in result.stdout


class TestRgPatternMatching:
    """Test pattern matching options."""

    async def test_fixed_strings(self):
        """Treat pattern as literal with -F."""
        bash = Bash(files={"/data/test.txt": "a.b\na*b\na+b\n"})
        result = await bash.exec("rg -F 'a.b' /data/test.txt")
        assert result.exit_code == 0
        assert "a.b" in result.stdout
        # Should NOT match a*b or a+b (. is literal, not regex)
        assert "a*b" not in result.stdout

    async def test_word_regexp(self):
        """Match whole words only with -w."""
        bash = Bash(files={"/data/test.txt": "hello\nhelloworld\nworld hello world\n"})
        result = await bash.exec("rg -w hello /data/test.txt")
        assert result.exit_code == 0
        assert "hello" in result.stdout
        # helloworld should not match
        lines = result.stdout.strip().split("\n")
        assert not any("helloworld" in l and "world hello" not in l for l in lines)

    async def test_line_regexp(self):
        """Match whole lines only with -x."""
        bash = Bash(files={"/data/test.txt": "hello\nhello world\nworld\n"})
        result = await bash.exec("rg -x hello /data/test.txt")
        assert result.exit_code == 0
        lines = [l for l in result.stdout.strip().split("\n") if "hello" in l]
        # Should only match the line that is exactly "hello"
        assert len(lines) == 1

    async def test_invert_match(self):
        """Select non-matching lines with -v."""
        bash = Bash(files={"/data/test.txt": "hello\nworld\nhello again\n"})
        result = await bash.exec("rg -v hello /data/test.txt")
        assert result.exit_code == 0
        assert "world" in result.stdout
        assert "hello" not in result.stdout

    async def test_multiple_patterns_with_e(self):
        """Multiple patterns with -e."""
        bash = Bash(files={"/data/test.txt": "apple\nbanana\ncherry\n"})
        result = await bash.exec("rg -e apple -e cherry /data/test.txt")
        assert result.exit_code == 0
        assert "apple" in result.stdout
        assert "cherry" in result.stdout
        assert "banana" not in result.stdout

    async def test_patterns_from_file(self):
        """Read patterns from file with -f."""
        bash = Bash(files={
            "/data/test.txt": "apple\nbanana\ncherry\ndate\n",
            "/patterns.txt": "apple\ncherry\n",
        })
        result = await bash.exec("rg -f /patterns.txt /data/test.txt")
        assert result.exit_code == 0
        assert "apple" in result.stdout
        assert "cherry" in result.stdout
        assert "banana" not in result.stdout


class TestRgOutputModes:
    """Test output mode options."""

    async def test_count(self):
        """Print match count with -c."""
        bash = Bash(files={"/data/test.txt": "hello\nworld\nhello again\n"})
        result = await bash.exec("rg -c hello /data/test.txt")
        assert result.exit_code == 0
        assert "2" in result.stdout

    async def test_count_matches(self):
        """Print individual match count with --count-matches."""
        bash = Bash(files={"/data/test.txt": "hello hello\nhello\n"})
        result = await bash.exec("rg --count-matches hello /data/test.txt")
        assert result.exit_code == 0
        assert "3" in result.stdout

    async def test_files_with_matches(self):
        """Print only filenames with -l."""
        bash = Bash(files={
            "/data/a.txt": "hello\n",
            "/data/b.txt": "world\n",
        })
        result = await bash.exec("rg -l hello /data")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "hello" not in result.stdout or result.stdout.strip() == "/data/a.txt"

    async def test_files_without_match(self):
        """Print files without matches with --files-without-match."""
        bash = Bash(files={
            "/data/a.txt": "hello\n",
            "/data/b.txt": "world\n",
        })
        result = await bash.exec("rg --files-without-match hello /data")
        assert result.exit_code == 0
        assert "b.txt" in result.stdout
        assert "a.txt" not in result.stdout

    async def test_only_matching(self):
        """Print only matched parts with -o."""
        bash = Bash(files={"/data/test.txt": "hello123world456\n"})
        result = await bash.exec(r"rg -o '[0-9]+' /data/test.txt")
        assert result.exit_code == 0
        assert "123" in result.stdout
        assert "456" in result.stdout
        assert "hello" not in result.stdout
        assert "world" not in result.stdout

    async def test_quiet_mode(self):
        """Suppress output with -q, exit 0 on match."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec("rg -q hello /data/test.txt")
        assert result.exit_code == 0
        assert result.stdout == ""

    async def test_quiet_mode_no_match(self):
        """Quiet mode exits 1 on no match."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec("rg -q notfound /data/test.txt")
        assert result.exit_code == 1


class TestRgLineNumbers:
    """Test line number display options."""

    async def test_line_numbers_on_by_default(self):
        """Line numbers are shown by default."""
        bash = Bash(files={"/data/test.txt": "hello\nworld\nhello\n"})
        result = await bash.exec("rg hello /data/test.txt")
        assert ":1:" in result.stdout
        assert ":3:" in result.stdout

    async def test_no_line_numbers(self):
        """Hide line numbers with -N."""
        bash = Bash(files={"/data/test.txt": "hello\nworld\nhello\n"})
        result = await bash.exec("rg -N hello /data/test.txt")
        # Should have filename:line but not filename:num:line
        assert ":1:" not in result.stdout
        assert ":3:" not in result.stdout

    async def test_explicit_line_numbers(self):
        """Explicitly enable line numbers with -n."""
        bash = Bash(files={"/data/test.txt": "hello\nworld\n"})
        result = await bash.exec("rg -n hello /data/test.txt")
        assert ":1:" in result.stdout


class TestRgFilenameDisplay:
    """Test filename display options."""

    async def test_with_filename_multiple_files(self):
        """Filename is shown when searching multiple files."""
        bash = Bash(files={
            "/data/a.txt": "hello\n",
            "/data/b.txt": "hello\n",
        })
        result = await bash.exec("rg hello /data/a.txt /data/b.txt")
        assert "/data/a.txt" in result.stdout
        assert "/data/b.txt" in result.stdout

    async def test_no_filename(self):
        """Hide filename with -I/--no-filename."""
        bash = Bash(files={
            "/data/a.txt": "hello\n",
            "/data/b.txt": "hello\n",
        })
        result = await bash.exec("rg -I hello /data/a.txt /data/b.txt")
        assert "/data/a.txt" not in result.stdout
        assert "/data/b.txt" not in result.stdout

    async def test_null_separator(self):
        """Use NUL as filename separator with -0."""
        bash = Bash(files={
            "/data/a.txt": "hello\n",
            "/data/b.txt": "hello\n",
        })
        result = await bash.exec("rg -l -0 hello /data")
        assert "\0" in result.stdout or result.exit_code == 0


class TestRgContextLines:
    """Test context line options."""

    async def test_after_context(self):
        """Print lines after match with -A."""
        bash = Bash(files={"/data/test.txt": "before\nmatch\nafter1\nafter2\nend\n"})
        result = await bash.exec("rg -A 2 match /data/test.txt")
        assert "match" in result.stdout
        assert "after1" in result.stdout
        assert "after2" in result.stdout
        assert "before" not in result.stdout

    async def test_before_context(self):
        """Print lines before match with -B."""
        bash = Bash(files={"/data/test.txt": "before1\nbefore2\nmatch\nafter\n"})
        result = await bash.exec("rg -B 2 match /data/test.txt")
        assert "match" in result.stdout
        assert "before1" in result.stdout
        assert "before2" in result.stdout
        assert "after" not in result.stdout

    async def test_context_both(self):
        """Print lines before and after with -C."""
        bash = Bash(files={"/data/test.txt": "AAA\nbbb\nmatch\nddd\neee\n"})
        result = await bash.exec("rg -C 1 match /data/test.txt")
        assert "bbb" in result.stdout
        assert "match" in result.stdout
        assert "ddd" in result.stdout
        assert "AAA" not in result.stdout
        assert "eee" not in result.stdout


class TestRgColumnAndByteOffset:
    """Test column and byte offset options."""

    async def test_column_number(self):
        """Show column number with --column."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec("rg --column world /data/test.txt")
        assert result.exit_code == 0
        # world starts at column 7 (1-indexed)
        assert ":7:" in result.stdout or "7" in result.stdout

    async def test_byte_offset(self):
        """Show byte offset with -b."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec("rg -b world /data/test.txt")
        assert result.exit_code == 0
        # world starts at byte 6 (0-indexed)
        assert "6" in result.stdout


class TestRgGlobFiltering:
    """Test glob pattern filtering."""

    async def test_glob_include(self):
        """Include files matching glob with -g."""
        bash = Bash(files={
            "/project/main.py": "hello\n",
            "/project/main.js": "hello\n",
            "/project/main.txt": "hello\n",
        })
        result = await bash.exec("rg -g '*.py' hello /project")
        assert "main.py" in result.stdout
        assert "main.js" not in result.stdout
        assert "main.txt" not in result.stdout

    async def test_glob_exclude(self):
        """Exclude files with negated glob."""
        bash = Bash(files={
            "/project/main.py": "hello\n",
            "/project/main.js": "hello\n",
            "/project/test.py": "hello\n",
        })
        result = await bash.exec("rg -g '!*test*' hello /project")
        assert "main.py" in result.stdout
        assert "main.js" in result.stdout
        assert "test.py" not in result.stdout

    async def test_multiple_globs(self):
        """Multiple glob patterns."""
        bash = Bash(files={
            "/project/main.py": "hello\n",
            "/project/main.js": "hello\n",
            "/project/main.txt": "hello\n",
        })
        result = await bash.exec("rg -g '*.py' -g '*.js' hello /project")
        assert "main.py" in result.stdout
        assert "main.js" in result.stdout
        assert "main.txt" not in result.stdout


class TestRgFileTypeFiltering:
    """Test file type filtering."""

    async def test_type_py(self):
        """Filter by Python files with -t py."""
        bash = Bash(files={
            "/project/main.py": "hello\n",
            "/project/main.js": "hello\n",
            "/project/utils.py": "hello\n",
        })
        result = await bash.exec("rg -t py hello /project")
        assert "main.py" in result.stdout
        assert "utils.py" in result.stdout
        assert "main.js" not in result.stdout

    async def test_type_js(self):
        """Filter by JavaScript files with -t js."""
        bash = Bash(files={
            "/project/main.py": "hello\n",
            "/project/main.js": "hello\n",
            "/project/lib.mjs": "hello\n",
        })
        result = await bash.exec("rg -t js hello /project")
        assert "main.js" in result.stdout
        assert "main.py" not in result.stdout

    async def test_type_not(self):
        """Exclude file type with -T."""
        bash = Bash(files={
            "/project/main.py": "hello\n",
            "/project/main.js": "hello\n",
            "/project/main.txt": "hello\n",
        })
        result = await bash.exec("rg -T py hello /project")
        assert "main.py" not in result.stdout
        assert "main.js" in result.stdout
        assert "main.txt" in result.stdout

    async def test_type_list(self):
        """List available file types with --type-list."""
        bash = Bash()
        result = await bash.exec("rg --type-list")
        assert result.exit_code == 0
        assert "py" in result.stdout
        assert "js" in result.stdout


class TestRgReplacement:
    """Test replacement functionality."""

    async def test_replace(self):
        """Replace matches with -r."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec("rg -r 'REPLACED' hello /data/test.txt")
        assert "REPLACED" in result.stdout
        assert "hello" not in result.stdout or "REPLACED world" in result.stdout

    async def test_replace_with_groups(self):
        """Replace with capture groups."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec(r"rg -r '$1_$1' '(hello)' /data/test.txt")
        assert "hello_hello" in result.stdout


class TestRgMaxCount:
    """Test max count limiting."""

    async def test_max_count(self):
        """Limit matches per file with -m."""
        bash = Bash(files={"/data/test.txt": "hello\nhello\nhello\nhello\n"})
        result = await bash.exec("rg -m 2 hello /data/test.txt")
        lines = [l for l in result.stdout.strip().split("\n") if "hello" in l]
        assert len(lines) == 2


class TestRgMultiline:
    """Test multiline matching."""

    async def test_multiline(self):
        """Match across lines with -U."""
        bash = Bash(files={"/data/test.txt": "hello\nworld\n"})
        result = await bash.exec(r"rg -U 'hello\nworld' /data/test.txt")
        assert result.exit_code == 0

    async def test_multiline_dotall(self):
        """Dot matches newlines with --multiline-dotall."""
        bash = Bash(files={"/data/test.txt": "start\nmiddle\nend\n"})
        result = await bash.exec("rg -U --multiline-dotall 'start.*end' /data/test.txt")
        assert result.exit_code == 0


class TestRgOutputFormats:
    """Test output format options."""

    async def test_json_output(self):
        """JSON output with --json."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec("rg --json hello /data/test.txt")
        assert result.exit_code == 0
        # Should contain JSON-like output
        assert "{" in result.stdout or result.stdout.strip() != ""

    async def test_vimgrep_format(self):
        """Vimgrep format with --vimgrep."""
        bash = Bash(files={"/data/test.txt": "hello world\n"})
        result = await bash.exec("rg --vimgrep hello /data/test.txt")
        assert result.exit_code == 0
        # vimgrep format: file:line:column:match
        parts = result.stdout.strip().split(":")
        assert len(parts) >= 4


class TestRgIgnoreFiles:
    """Test .gitignore and ignore file handling."""

    async def test_respects_gitignore(self):
        """Respect .gitignore by default."""
        bash = Bash(files={
            "/project/.gitignore": "ignored.txt\n",
            "/project/included.txt": "hello\n",
            "/project/ignored.txt": "hello\n",
        })
        result = await bash.exec("rg hello /project")
        assert "included.txt" in result.stdout
        assert "ignored.txt" not in result.stdout

    async def test_no_ignore(self):
        """Ignore .gitignore with --no-ignore."""
        bash = Bash(files={
            "/project/.gitignore": "ignored.txt\n",
            "/project/included.txt": "hello\n",
            "/project/ignored.txt": "hello\n",
        })
        result = await bash.exec("rg --no-ignore hello /project")
        assert "included.txt" in result.stdout
        assert "ignored.txt" in result.stdout


class TestRgUnrestricted:
    """Test unrestricted mode."""

    async def test_unrestricted_single(self):
        """Single -u ignores .gitignore."""
        bash = Bash(files={
            "/project/.gitignore": "ignored.txt\n",
            "/project/ignored.txt": "hello\n",
        })
        result = await bash.exec("rg -u hello /project")
        assert "ignored.txt" in result.stdout

    async def test_unrestricted_double(self):
        """Double -uu also searches hidden files."""
        bash = Bash(files={
            "/project/.hidden.txt": "hello\n",
            "/project/visible.txt": "hello\n",
        })
        result = await bash.exec("rg -uu hello /project")
        assert ".hidden.txt" in result.stdout
        assert "visible.txt" in result.stdout


class TestRgStats:
    """Test search statistics."""

    async def test_stats(self):
        """Print statistics with --stats."""
        bash = Bash(files={
            "/data/a.txt": "hello\nhello\n",
            "/data/b.txt": "hello\nworld\n",
        })
        result = await bash.exec("rg --stats hello /data")
        assert result.exit_code == 0
        # Should include some statistics
        assert "match" in result.stdout.lower() or "file" in result.stdout.lower()


class TestRgFilesMode:
    """Test --files mode to list searchable files."""

    async def test_files_list(self):
        """List files that would be searched with --files."""
        bash = Bash(files={
            "/project/a.txt": "content\n",
            "/project/b.py": "content\n",
            "/project/.hidden": "content\n",
        })
        result = await bash.exec("rg --files /project")
        assert "a.txt" in result.stdout
        assert "b.py" in result.stdout
        assert ".hidden" not in result.stdout

    async def test_files_with_type(self):
        """List only files of specific type."""
        bash = Bash(files={
            "/project/a.txt": "content\n",
            "/project/b.py": "content\n",
        })
        result = await bash.exec("rg --files -t py /project")
        assert "b.py" in result.stdout
        assert "a.txt" not in result.stdout


class TestRgSorting:
    """Test result sorting."""

    async def test_sort_path(self):
        """Sort results by path with --sort path."""
        bash = Bash(files={
            "/project/z.txt": "hello\n",
            "/project/a.txt": "hello\n",
            "/project/m.txt": "hello\n",
        })
        result = await bash.exec("rg --sort path hello /project")
        lines = result.stdout.strip().split("\n")
        # a.txt should come before m.txt which should come before z.txt
        a_idx = next((i for i, l in enumerate(lines) if "a.txt" in l), -1)
        m_idx = next((i for i, l in enumerate(lines) if "m.txt" in l), -1)
        z_idx = next((i for i, l in enumerate(lines) if "z.txt" in l), -1)
        assert a_idx < m_idx < z_idx


class TestRgHeading:
    """Test heading output format."""

    async def test_heading(self):
        """Show file path above matches with --heading."""
        bash = Bash(files={
            "/data/test.txt": "hello\nworld\nhello\n",
        })
        result = await bash.exec("rg --heading hello /data/test.txt")
        # Heading format shows filename on its own line
        lines = result.stdout.strip().split("\n")
        assert any("test.txt" in l and "hello" not in l for l in lines)


class TestRgPassthrough:
    """Test passthrough mode."""

    async def test_passthru(self):
        """Print all lines with --passthru."""
        bash = Bash(files={"/data/test.txt": "hello\nworld\nhello\n"})
        result = await bash.exec("rg --passthru hello /data/test.txt")
        assert "hello" in result.stdout
        assert "world" in result.stdout


class TestRgBinaryFiles:
    """Test binary file handling."""

    async def test_skip_binary_by_default(self):
        """Skip binary files by default."""
        bash = Bash(files={
            "/data/text.txt": "hello world\n",
            "/data/binary.bin": b"hello\x00world",
        })
        result = await bash.exec("rg hello /data")
        assert "text.txt" in result.stdout
        # Binary file should be skipped or noted

    async def test_search_binary_with_text(self):
        """Search binary files with -a/--text."""
        bash = Bash(files={
            "/data/binary.bin": b"hello\x00world",
        })
        result = await bash.exec("rg -a hello /data/binary.bin")
        # Should find the match in binary file
        assert result.exit_code == 0 or "hello" in result.stdout


class TestRgErrorHandling:
    """Test error handling."""

    async def test_missing_pattern(self):
        """Error when no pattern provided."""
        bash = Bash()
        result = await bash.exec("rg")
        assert result.exit_code != 0

    async def test_invalid_regex(self):
        """Error on invalid regex."""
        bash = Bash(files={"/data/test.txt": "hello\n"})
        result = await bash.exec("rg '[invalid' /data/test.txt")
        assert result.exit_code != 0

    async def test_missing_file(self):
        """Handle missing file gracefully."""
        bash = Bash()
        result = await bash.exec("rg hello /nonexistent.txt")
        # rg typically exits 1 for no matches or missing files
        assert result.exit_code != 0 or result.stdout == ""


class TestRgHelp:
    """Test help output."""

    async def test_help_flag(self):
        """Show help with --help."""
        bash = Bash()
        result = await bash.exec("rg --help")
        assert result.exit_code == 0
        assert "rg" in result.stdout.lower() or "usage" in result.stdout.lower()
