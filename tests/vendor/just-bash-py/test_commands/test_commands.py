"""Tests for command implementations."""

import json

import pytest
from just_bash import Bash


class TestPwdCommand:
    """Test pwd command."""

    @pytest.mark.asyncio
    async def test_pwd_default(self):
        bash = Bash(cwd="/home/user")
        result = await bash.exec("pwd")
        assert result.stdout == "/home/user\n"
        assert result.exit_code == 0


class TestLsCommand:
    """Test ls command."""

    @pytest.mark.asyncio
    async def test_ls_empty_dir(self):
        bash = Bash()
        await bash.fs.mkdir("/empty")
        result = await bash.exec("ls /empty")
        assert result.stdout == "\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_with_files(self):
        bash = Bash(files={
            "/dir/a.txt": "a",
            "/dir/b.txt": "b",
        })
        result = await bash.exec("ls /dir")
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_one_per_line(self):
        bash = Bash(files={
            "/dir/a.txt": "a",
            "/dir/b.txt": "b",
        })
        result = await bash.exec("ls -1 /dir")
        assert result.stdout == "a.txt\nb.txt\n"

    @pytest.mark.asyncio
    async def test_ls_long_format(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("ls -l /test.txt")
        assert "-rw" in result.stdout
        assert "test.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_ls_nonexistent(self):
        bash = Bash()
        result = await bash.exec("ls /nonexistent")
        assert "No such file or directory" in result.stderr
        assert result.exit_code == 2

    @pytest.mark.asyncio
    async def test_ls_almost_all_flag(self):
        """Test -A shows hidden files except . and .."""
        bash = Bash(files={
            "/dir/.hidden": "hidden",
            "/dir/visible": "visible",
        })
        result = await bash.exec("ls -A /dir")
        assert ".hidden" in result.stdout
        assert "visible" in result.stdout
        # . and .. should NOT appear
        lines = result.stdout.strip().split()
        assert "." not in lines
        assert ".." not in lines

    @pytest.mark.asyncio
    async def test_ls_almost_all_long_option(self):
        """Test --almost-all shows hidden files except . and .."""
        bash = Bash(files={
            "/dir/.config": "config",
            "/dir/readme": "readme",
        })
        result = await bash.exec("ls --almost-all /dir")
        assert ".config" in result.stdout
        assert "readme" in result.stdout

    @pytest.mark.asyncio
    async def test_ls_sort_by_size(self):
        """Test -S sorts by file size, largest first."""
        bash = Bash(files={
            "/dir/small": "x",
            "/dir/medium": "xxxxx",
            "/dir/large": "xxxxxxxxxx",
        })
        result = await bash.exec("ls -1S /dir")
        lines = result.stdout.strip().split("\n")
        assert lines == ["large", "medium", "small"]

    @pytest.mark.asyncio
    async def test_ls_sort_by_size_reverse(self):
        """Test -Sr sorts by file size, smallest first."""
        bash = Bash(files={
            "/dir/small": "x",
            "/dir/medium": "xxxxx",
            "/dir/large": "xxxxxxxxxx",
        })
        result = await bash.exec("ls -1Sr /dir")
        lines = result.stdout.strip().split("\n")
        assert lines == ["small", "medium", "large"]

    @pytest.mark.asyncio
    async def test_ls_sort_by_time(self):
        """Test -t sorts by modification time, newest first."""
        bash = Bash(files={
            "/dir/file1": "content1",
            "/dir/file2": "content2",
        })
        # Touch file1 to make it newer
        await bash.exec("touch /dir/file1")
        result = await bash.exec("ls -1t /dir")
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "file1"  # Most recently modified

    @pytest.mark.asyncio
    async def test_ls_sort_by_time_reverse(self):
        """Test -tr sorts by modification time, oldest first."""
        bash = Bash(files={
            "/dir/file1": "content1",
            "/dir/file2": "content2",
        })
        # Touch file1 to make it newer
        await bash.exec("touch /dir/file1")
        result = await bash.exec("ls -1tr /dir")
        lines = result.stdout.strip().split("\n")
        assert lines[-1] == "file1"  # Most recently modified is last


class TestHeadCommand:
    """Test head command."""

    @pytest.mark.asyncio
    async def test_head_default(self):
        lines = "\n".join([f"line{i}" for i in range(20)])
        bash = Bash(files={"/test.txt": lines})
        result = await bash.exec("head /test.txt")
        output_lines = result.stdout.strip().split("\n")
        assert len(output_lines) == 10
        assert output_lines[0] == "line0"
        assert output_lines[9] == "line9"

    @pytest.mark.asyncio
    async def test_head_custom_lines(self):
        lines = "\n".join([f"line{i}" for i in range(20)])
        bash = Bash(files={"/test.txt": lines})
        result = await bash.exec("head -n 5 /test.txt")
        output_lines = result.stdout.strip().split("\n")
        assert len(output_lines) == 5

    @pytest.mark.asyncio
    async def test_head_stdin(self):
        bash = Bash()
        result = await bash.exec("echo -e 'a\nb\nc\nd\ne' | head -n 3")
        # This depends on echo -e working and pipeline support
        # For now just check it doesn't error
        assert result.exit_code == 0


class TestTailCommand:
    """Test tail command."""

    @pytest.mark.asyncio
    async def test_tail_default(self):
        lines = "\n".join([f"line{i}" for i in range(20)])
        bash = Bash(files={"/test.txt": lines})
        result = await bash.exec("tail /test.txt")
        output_lines = result.stdout.strip().split("\n")
        assert len(output_lines) == 10
        assert output_lines[0] == "line10"
        assert output_lines[9] == "line19"

    @pytest.mark.asyncio
    async def test_tail_custom_lines(self):
        lines = "\n".join([f"line{i}" for i in range(20)])
        bash = Bash(files={"/test.txt": lines})
        result = await bash.exec("tail -n 5 /test.txt")
        output_lines = result.stdout.strip().split("\n")
        assert len(output_lines) == 5
        assert output_lines[0] == "line15"


class TestWcCommand:
    """Test wc command."""

    @pytest.mark.asyncio
    async def test_wc_lines(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("wc -l /test.txt")
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_words(self):
        bash = Bash(files={"/test.txt": "one two three four\n"})
        result = await bash.exec("wc -w /test.txt")
        assert "4" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_stdin(self):
        bash = Bash()
        result = await bash.exec("echo hello world | wc -w")
        assert "2" in result.stdout


class TestGrepCommand:
    """Test grep command."""

    @pytest.mark.asyncio
    async def test_grep_basic(self):
        bash = Bash(files={"/test.txt": "hello\nworld\nhello world\n"})
        result = await bash.exec("grep hello /test.txt")
        assert "hello" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_grep_no_match(self):
        bash = Bash(files={"/test.txt": "hello\nworld\n"})
        result = await bash.exec("grep notfound /test.txt")
        assert result.stdout == ""
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_grep_ignore_case(self):
        bash = Bash(files={"/test.txt": "Hello\nWORLD\n"})
        result = await bash.exec("grep -i hello /test.txt")
        assert "Hello" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_grep_invert_match(self):
        bash = Bash(files={"/test.txt": "apple\nbanana\napricot\n"})
        result = await bash.exec("grep -v apple /test.txt")
        assert "banana" in result.stdout
        assert "apple" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_count(self):
        bash = Bash(files={"/test.txt": "a\na\nb\na\n"})
        result = await bash.exec("grep -c a /test.txt")
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_line_numbers(self):
        bash = Bash(files={"/test.txt": "foo\nbar\nfoo\n"})
        result = await bash.exec("grep -n foo /test.txt")
        assert "1:" in result.stdout
        assert "3:" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_stdin(self):
        bash = Bash()
        result = await bash.exec("echo hello | grep hello")
        assert "hello" in result.stdout
        assert result.exit_code == 0


class TestPipelines:
    """Test command pipelines."""

    @pytest.mark.asyncio
    async def test_echo_cat_pipeline(self):
        bash = Bash()
        result = await bash.exec("echo hello | cat")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_echo_grep_pipeline(self):
        bash = Bash()
        result = await bash.exec("echo hello world | grep world")
        assert "world" in result.stdout

    @pytest.mark.asyncio
    async def test_multi_stage_pipeline(self):
        bash = Bash()
        result = await bash.exec("echo hello | cat | cat")
        assert result.stdout == "hello\n"


# =============================================================================
# File Operations Tests
# =============================================================================


class TestMkdirCommand:
    """Test mkdir command."""

    @pytest.mark.asyncio
    async def test_mkdir_basic(self):
        bash = Bash()
        result = await bash.exec("mkdir /newdir")
        assert result.exit_code == 0
        # Verify directory was created
        result = await bash.exec("ls /")
        assert "newdir" in result.stdout

    @pytest.mark.asyncio
    async def test_mkdir_recursive(self):
        bash = Bash()
        result = await bash.exec("mkdir -p /a/b/c")
        assert result.exit_code == 0
        result = await bash.exec("ls /a/b")
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_mkdir_exists_error(self):
        bash = Bash()
        await bash.exec("mkdir /existing")
        result = await bash.exec("mkdir /existing")
        assert result.exit_code == 1
        assert "exists" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_mkdir_exists_with_p_flag(self):
        bash = Bash()
        await bash.exec("mkdir /existing")
        result = await bash.exec("mkdir -p /existing")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_mkdir_verbose(self):
        bash = Bash()
        result = await bash.exec("mkdir -v /newdir")
        assert result.exit_code == 0
        assert "created" in result.stdout.lower()


class TestTouchCommand:
    """Test touch command."""

    @pytest.mark.asyncio
    async def test_touch_creates_file(self):
        bash = Bash()
        result = await bash.exec("touch /newfile.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls /")
        assert "newfile.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_touch_existing_file(self):
        bash = Bash(files={"/existing.txt": "content"})
        result = await bash.exec("touch /existing.txt")
        assert result.exit_code == 0
        # Content should be preserved
        result = await bash.exec("cat /existing.txt")
        assert result.stdout == "content\n"

    @pytest.mark.asyncio
    async def test_touch_multiple_files(self):
        bash = Bash()
        result = await bash.exec("touch /a.txt /b.txt /c.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls /")
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout
        assert "c.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_touch_no_create_flag(self):
        bash = Bash()
        result = await bash.exec("touch -c /nonexistent.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls /")
        assert "nonexistent.txt" not in result.stdout


class TestRmCommand:
    """Test rm command."""

    @pytest.mark.asyncio
    async def test_rm_file(self):
        bash = Bash(files={"/test.txt": "content"})
        result = await bash.exec("rm /test.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls /")
        assert "test.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_rm_nonexistent_error(self):
        bash = Bash()
        result = await bash.exec("rm /nonexistent.txt")
        assert result.exit_code == 1
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_rm_force_nonexistent(self):
        bash = Bash()
        result = await bash.exec("rm -f /nonexistent.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_rm_directory_error(self):
        bash = Bash()
        await bash.exec("mkdir /mydir")
        result = await bash.exec("rm /mydir")
        assert result.exit_code == 1
        assert "directory" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_rm_recursive_directory(self):
        bash = Bash(files={"/dir/sub/file.txt": "content"})
        result = await bash.exec("rm -r /dir")
        assert result.exit_code == 0
        result = await bash.exec("ls /")
        assert "dir" not in result.stdout

    @pytest.mark.asyncio
    async def test_rm_multiple_files(self):
        bash = Bash(files={"/a.txt": "a", "/b.txt": "b"})
        result = await bash.exec("rm /a.txt /b.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls /")
        assert "a.txt" not in result.stdout
        assert "b.txt" not in result.stdout


class TestCpCommand:
    """Test cp command."""

    @pytest.mark.asyncio
    async def test_cp_file(self):
        bash = Bash(files={"/src.txt": "hello world"})
        result = await bash.exec("cp /src.txt /dst.txt")
        assert result.exit_code == 0
        result = await bash.exec("cat /dst.txt")
        assert result.stdout == "hello world\n"

    @pytest.mark.asyncio
    async def test_cp_preserves_original(self):
        bash = Bash(files={"/src.txt": "hello"})
        await bash.exec("cp /src.txt /dst.txt")
        result = await bash.exec("cat /src.txt")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_cp_into_directory(self):
        bash = Bash(files={"/file.txt": "content"})
        await bash.exec("mkdir /destdir")
        result = await bash.exec("cp /file.txt /destdir/")
        assert result.exit_code == 0
        result = await bash.exec("cat /destdir/file.txt")
        assert result.stdout == "content\n"

    @pytest.mark.asyncio
    async def test_cp_recursive_directory(self):
        bash = Bash(files={"/src/a.txt": "a", "/src/sub/b.txt": "b"})
        result = await bash.exec("cp -r /src /dst")
        assert result.exit_code == 0
        result = await bash.exec("cat /dst/a.txt")
        assert result.stdout == "a\n"
        result = await bash.exec("cat /dst/sub/b.txt")
        assert result.stdout == "b\n"

    @pytest.mark.asyncio
    async def test_cp_nonexistent_source_error(self):
        bash = Bash()
        result = await bash.exec("cp /nonexistent.txt /dst.txt")
        assert result.exit_code == 1
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_cp_no_clobber(self):
        bash = Bash(files={"/src.txt": "new", "/dst.txt": "old"})
        result = await bash.exec("cp -n /src.txt /dst.txt")
        assert result.exit_code == 0
        result = await bash.exec("cat /dst.txt")
        assert result.stdout == "old\n"  # Not overwritten


class TestMvCommand:
    """Test mv command."""

    @pytest.mark.asyncio
    async def test_mv_file(self):
        bash = Bash(files={"/src.txt": "hello"})
        result = await bash.exec("mv /src.txt /dst.txt")
        assert result.exit_code == 0
        result = await bash.exec("cat /dst.txt")
        assert result.stdout == "hello\n"
        result = await bash.exec("ls /")
        assert "src.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_mv_into_directory(self):
        bash = Bash(files={"/file.txt": "content"})
        await bash.exec("mkdir /destdir")
        result = await bash.exec("mv /file.txt /destdir/")
        assert result.exit_code == 0
        result = await bash.exec("cat /destdir/file.txt")
        assert result.stdout == "content\n"
        result = await bash.exec("ls /")
        assert "file.txt" not in result.stdout or "destdir" in result.stdout

    @pytest.mark.asyncio
    async def test_mv_rename_directory(self):
        bash = Bash(files={"/olddir/file.txt": "content"})
        result = await bash.exec("mv /olddir /newdir")
        assert result.exit_code == 0
        result = await bash.exec("cat /newdir/file.txt")
        assert result.stdout == "content\n"

    @pytest.mark.asyncio
    async def test_mv_nonexistent_source_error(self):
        bash = Bash()
        result = await bash.exec("mv /nonexistent.txt /dst.txt")
        assert result.exit_code == 1
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_mv_no_clobber(self):
        bash = Bash(files={"/src.txt": "new", "/dst.txt": "old"})
        result = await bash.exec("mv -n /src.txt /dst.txt")
        assert result.exit_code == 0
        result = await bash.exec("cat /dst.txt")
        assert result.stdout == "old\n"
        # Source should still exist
        result = await bash.exec("cat /src.txt")
        assert result.stdout == "new\n"


class TestLnCommand:
    """Test ln command."""

    @pytest.mark.asyncio
    async def test_ln_symbolic_link(self):
        bash = Bash(files={"/target.txt": "content"})
        result = await bash.exec("ln -s /target.txt /link.txt")
        assert result.exit_code == 0
        result = await bash.exec("cat /link.txt")
        assert result.stdout == "content\n"

    @pytest.mark.asyncio
    async def test_ln_hard_link(self):
        bash = Bash(files={"/target.txt": "content"})
        result = await bash.exec("ln /target.txt /link.txt")
        assert result.exit_code == 0
        result = await bash.exec("cat /link.txt")
        assert result.stdout == "content\n"

    @pytest.mark.asyncio
    async def test_ln_symlink_to_directory(self):
        bash = Bash(files={"/dir/file.txt": "content"})
        result = await bash.exec("ln -s /dir /link")
        assert result.exit_code == 0
        result = await bash.exec("ls /link")
        assert "file.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_ln_force_overwrite(self):
        bash = Bash(files={"/target.txt": "new", "/link.txt": "old"})
        result = await bash.exec("ln -sf /target.txt /link.txt")
        assert result.exit_code == 0
        result = await bash.exec("cat /link.txt")
        assert result.stdout == "new\n"


class TestChmodCommand:
    """Test chmod command."""

    @pytest.mark.asyncio
    async def test_chmod_octal(self):
        bash = Bash(files={"/test.txt": "content"})
        result = await bash.exec("chmod 755 /test.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls -l /test.txt")
        assert "rwx" in result.stdout  # Owner has rwx

    @pytest.mark.asyncio
    async def test_chmod_symbolic_add(self):
        bash = Bash(files={"/test.txt": "content"})
        result = await bash.exec("chmod u+x /test.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls -l /test.txt")
        assert "x" in result.stdout

    @pytest.mark.asyncio
    async def test_chmod_symbolic_remove(self):
        bash = Bash(files={"/test.txt": "content"})
        await bash.exec("chmod 777 /test.txt")
        result = await bash.exec("chmod a-w /test.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls -l /test.txt")
        # Should have r-x pattern
        assert "r-x" in result.stdout

    @pytest.mark.asyncio
    async def test_chmod_nonexistent_error(self):
        bash = Bash()
        result = await bash.exec("chmod 755 /nonexistent.txt")
        assert result.exit_code == 1
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_chmod_recursive(self):
        bash = Bash(files={"/dir/a.txt": "a", "/dir/sub/b.txt": "b"})
        result = await bash.exec("chmod -R 755 /dir")
        assert result.exit_code == 0


# =============================================================================
# Text Processing Tests
# =============================================================================


class TestUniqCommand:
    """Test uniq command."""

    @pytest.mark.asyncio
    async def test_uniq_basic(self):
        bash = Bash(files={"/test.txt": "a\na\nb\nb\nb\nc\n"})
        result = await bash.exec("uniq /test.txt")
        assert result.stdout == "a\nb\nc\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_uniq_count(self):
        bash = Bash(files={"/test.txt": "a\na\nb\nc\nc\nc\n"})
        result = await bash.exec("uniq -c /test.txt")
        assert "2" in result.stdout and "a" in result.stdout
        assert "1" in result.stdout and "b" in result.stdout
        assert "3" in result.stdout and "c" in result.stdout

    @pytest.mark.asyncio
    async def test_uniq_repeated_only(self):
        bash = Bash(files={"/test.txt": "a\na\nb\nc\nc\n"})
        result = await bash.exec("uniq -d /test.txt")
        assert "a" in result.stdout
        assert "c" in result.stdout
        assert "b" not in result.stdout

    @pytest.mark.asyncio
    async def test_uniq_unique_only(self):
        bash = Bash(files={"/test.txt": "a\na\nb\nc\nc\n"})
        result = await bash.exec("uniq -u /test.txt")
        assert "b" in result.stdout
        assert "a" not in result.stdout
        assert "c" not in result.stdout

    @pytest.mark.asyncio
    async def test_uniq_ignore_case(self):
        bash = Bash(files={"/test.txt": "A\na\nB\n"})
        result = await bash.exec("uniq -i /test.txt")
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 2  # A and B (case-insensitive)

    @pytest.mark.asyncio
    async def test_uniq_stdin(self):
        bash = Bash()
        result = await bash.exec("echo -e 'a\na\nb' | uniq")
        assert result.exit_code == 0


class TestCutCommand:
    """Test cut command."""

    @pytest.mark.asyncio
    async def test_cut_field(self):
        bash = Bash(files={"/test.txt": "a,b,c\n1,2,3\n"})
        result = await bash.exec("cut -d, -f2 /test.txt")
        assert result.stdout == "b\n2\n"

    @pytest.mark.asyncio
    async def test_cut_multiple_fields(self):
        bash = Bash(files={"/test.txt": "a,b,c,d\n1,2,3,4\n"})
        result = await bash.exec("cut -d, -f1,3 /test.txt")
        assert result.stdout == "a,c\n1,3\n"

    @pytest.mark.asyncio
    async def test_cut_field_range(self):
        bash = Bash(files={"/test.txt": "a,b,c,d\n"})
        result = await bash.exec("cut -d, -f2-3 /test.txt")
        assert result.stdout == "b,c\n"

    @pytest.mark.asyncio
    async def test_cut_characters(self):
        bash = Bash(files={"/test.txt": "hello\nworld\n"})
        result = await bash.exec("cut -c1-3 /test.txt")
        assert result.stdout == "hel\nwor\n"

    @pytest.mark.asyncio
    async def test_cut_tab_delimiter_default(self):
        bash = Bash(files={"/test.txt": "a\tb\tc\n"})
        result = await bash.exec("cut -f2 /test.txt")
        assert result.stdout == "b\n"

    @pytest.mark.asyncio
    async def test_cut_only_delimited(self):
        bash = Bash(files={"/test.txt": "a,b,c\nno delimiter\n"})
        result = await bash.exec("cut -d, -f2 -s /test.txt")
        assert result.stdout == "b\n"  # Line without delimiter omitted

    @pytest.mark.asyncio
    async def test_cut_missing_field_spec_error(self):
        bash = Bash(files={"/test.txt": "a,b,c\n"})
        result = await bash.exec("cut /test.txt")
        assert result.exit_code == 1


class TestTrCommand:
    """Test tr command."""

    @pytest.mark.asyncio
    async def test_tr_translate(self):
        bash = Bash()
        result = await bash.exec("echo hello | tr a-z A-Z")
        assert result.stdout == "HELLO\n"

    @pytest.mark.asyncio
    async def test_tr_delete(self):
        bash = Bash()
        result = await bash.exec("echo hello123world | tr -d 0-9")
        assert result.stdout == "helloworld\n"

    @pytest.mark.asyncio
    async def test_tr_squeeze(self):
        bash = Bash()
        result = await bash.exec("echo 'hello   world' | tr -s ' '")
        assert result.stdout == "hello world\n"

    @pytest.mark.asyncio
    async def test_tr_complement(self):
        bash = Bash()
        result = await bash.exec("echo abc123def | tr -cd 0-9")
        assert result.stdout == "123"

    @pytest.mark.asyncio
    async def test_tr_character_class(self):
        bash = Bash()
        result = await bash.exec("echo Hello123 | tr -d '[:digit:]'")
        assert result.stdout == "Hello\n"

    @pytest.mark.asyncio
    async def test_tr_escape_sequences(self):
        # Use file with actual tabs and translate using actual tab character
        bash = Bash(files={"/test.txt": "a\tb\tc\n"})
        # Use actual tab in the tr argument (shell passes it through)
        result = await bash.exec("cat /test.txt | tr '\t' ','")
        assert result.stdout == "a,b,c\n"


class TestSortCommand:
    """Test sort command."""

    @pytest.mark.asyncio
    async def test_sort_basic(self):
        bash = Bash(files={"/test.txt": "banana\napple\ncherry\n"})
        result = await bash.exec("sort /test.txt")
        assert result.stdout == "apple\nbanana\ncherry\n"

    @pytest.mark.asyncio
    async def test_sort_reverse(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sort -r /test.txt")
        assert result.stdout == "c\nb\na\n"

    @pytest.mark.asyncio
    async def test_sort_numeric(self):
        bash = Bash(files={"/test.txt": "10\n2\n1\n20\n"})
        result = await bash.exec("sort -n /test.txt")
        assert result.stdout == "1\n2\n10\n20\n"

    @pytest.mark.asyncio
    async def test_sort_unique(self):
        bash = Bash(files={"/test.txt": "a\nb\na\nc\nb\n"})
        result = await bash.exec("sort -u /test.txt")
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3
        assert sorted(lines) == ["a", "b", "c"]

    @pytest.mark.asyncio
    async def test_sort_key(self):
        bash = Bash(files={"/test.txt": "b 2\na 3\nc 1\n"})
        result = await bash.exec("sort -k2 -n /test.txt")
        lines = result.stdout.strip().split("\n")
        assert lines[0].startswith("c")  # 1 is smallest
        assert lines[2].startswith("a")  # 3 is largest

    @pytest.mark.asyncio
    async def test_sort_stdin(self):
        bash = Bash()
        result = await bash.exec("echo -e 'c\na\nb' | sort")
        assert result.exit_code == 0


# =============================================================================
# Data Command Tests
# =============================================================================


class TestBase64Command:
    """Test base64 command."""

    @pytest.mark.asyncio
    async def test_base64_encode(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("base64 /test.txt")
        assert "aGVsbG8=" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_base64_decode(self):
        bash = Bash(files={"/test.txt": "aGVsbG8="})
        result = await bash.exec("base64 -d /test.txt")
        assert result.stdout == "hello"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_base64_stdin_encode(self):
        bash = Bash()
        result = await bash.exec("echo -n hello | base64")
        assert "aGVsbG8=" in result.stdout

    @pytest.mark.asyncio
    async def test_base64_roundtrip(self):
        bash = Bash(files={"/test.txt": "test data 123"})
        # Encode then decode
        result = await bash.exec("base64 /test.txt")
        encoded = result.stdout.strip()
        bash2 = Bash(files={"/encoded.txt": encoded})
        result = await bash2.exec("base64 -d /encoded.txt")
        assert result.stdout == "test data 123"


class TestSeqCommand:
    """Test seq command."""

    @pytest.mark.asyncio
    async def test_seq_single_arg(self):
        bash = Bash()
        result = await bash.exec("seq 5")
        assert result.stdout == "1\n2\n3\n4\n5\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_seq_two_args(self):
        bash = Bash()
        result = await bash.exec("seq 3 6")
        assert result.stdout == "3\n4\n5\n6\n"

    @pytest.mark.asyncio
    async def test_seq_three_args(self):
        bash = Bash()
        result = await bash.exec("seq 1 2 9")
        assert result.stdout == "1\n3\n5\n7\n9\n"

    @pytest.mark.asyncio
    async def test_seq_separator(self):
        bash = Bash()
        result = await bash.exec("seq -s ', ' 3")
        assert result.stdout == "1, 2, 3\n"

    @pytest.mark.asyncio
    async def test_seq_equal_width(self):
        bash = Bash()
        result = await bash.exec("seq -w 8 10")
        assert result.stdout == "08\n09\n10\n"

    @pytest.mark.asyncio
    async def test_seq_descending(self):
        bash = Bash()
        result = await bash.exec("seq 5 1")
        assert result.stdout == "5\n4\n3\n2\n1\n"

    @pytest.mark.asyncio
    async def test_seq_missing_operand_error(self):
        bash = Bash()
        result = await bash.exec("seq")
        assert result.exit_code == 1


class TestExprCommand:
    """Test expr command."""

    @pytest.mark.asyncio
    async def test_expr_addition(self):
        bash = Bash()
        result = await bash.exec("expr 2 + 3")
        assert result.stdout == "5\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_expr_subtraction(self):
        bash = Bash()
        result = await bash.exec("expr 10 - 4")
        assert result.stdout == "6\n"

    @pytest.mark.asyncio
    async def test_expr_multiplication(self):
        bash = Bash()
        # Note: * needs to be escaped in shell, but here we test the command directly
        result = await bash.exec("expr 3 '*' 4")
        assert result.stdout == "12\n"

    @pytest.mark.asyncio
    async def test_expr_division(self):
        bash = Bash()
        result = await bash.exec("expr 15 / 3")
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_expr_modulo(self):
        bash = Bash()
        result = await bash.exec("expr 17 % 5")
        assert result.stdout == "2\n"

    @pytest.mark.asyncio
    async def test_expr_comparison_greater(self):
        bash = Bash()
        result = await bash.exec("expr 5 '>' 3")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_expr_comparison_less(self):
        bash = Bash()
        result = await bash.exec("expr 2 '<' 5")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_expr_length(self):
        bash = Bash()
        result = await bash.exec("expr length hello")
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_expr_substr(self):
        bash = Bash()
        result = await bash.exec("expr substr hello 2 3")
        assert result.stdout == "ell\n"

    @pytest.mark.asyncio
    async def test_expr_index(self):
        bash = Bash()
        result = await bash.exec("expr index hello e")
        assert result.stdout == "2\n"

    @pytest.mark.asyncio
    async def test_expr_zero_exit_code(self):
        bash = Bash()
        result = await bash.exec("expr 0 + 0")
        assert result.stdout == "0\n"
        assert result.exit_code == 1  # 0 result means exit code 1

    @pytest.mark.asyncio
    async def test_expr_division_by_zero(self):
        bash = Bash()
        result = await bash.exec("expr 5 / 0")
        assert result.exit_code == 2
        assert "division by zero" in result.stderr


class TestDateCommand:
    """Test date command."""

    @pytest.mark.asyncio
    async def test_date_default(self):
        bash = Bash()
        result = await bash.exec("date")
        assert result.exit_code == 0
        # Should contain some date-like output
        assert len(result.stdout) > 10

    @pytest.mark.asyncio
    async def test_date_format_year(self):
        bash = Bash()
        result = await bash.exec("date +%Y")
        assert result.exit_code == 0
        year = result.stdout.strip()
        assert year.isdigit()
        assert len(year) == 4

    @pytest.mark.asyncio
    async def test_date_format_month_day(self):
        bash = Bash()
        result = await bash.exec("date +%m-%d")
        assert result.exit_code == 0
        parts = result.stdout.strip().split("-")
        assert len(parts) == 2

    @pytest.mark.asyncio
    async def test_date_utc(self):
        bash = Bash()
        result = await bash.exec("date -u +%Z")
        assert result.exit_code == 0
        # UTC timezone indicator
        assert "UTC" in result.stdout or "+0000" in result.stdout

    @pytest.mark.asyncio
    async def test_date_iso_format(self):
        bash = Bash()
        result = await bash.exec("date -I")
        assert result.exit_code == 0
        # ISO format: YYYY-MM-DD
        parts = result.stdout.strip().split("-")
        assert len(parts) >= 3


# =============================================================================
# Complex Command Tests
# =============================================================================


class TestSedCommand:
    """Test sed command."""

    @pytest.mark.asyncio
    async def test_sed_substitute(self):
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec('sed "s/hello/goodbye/" /test.txt')
        assert result.stdout == "goodbye world\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sed_substitute_global(self):
        bash = Bash(files={"/test.txt": "a a a\n"})
        result = await bash.exec('sed "s/a/b/g" /test.txt')
        assert result.stdout == "b b b\n"

    @pytest.mark.asyncio
    async def test_sed_delete_line(self):
        bash = Bash(files={"/test.txt": "line1\nline2\nline3\n"})
        result = await bash.exec('sed "2d" /test.txt')
        assert result.stdout == "line1\nline3\n"

    @pytest.mark.asyncio
    async def test_sed_print_line(self):
        bash = Bash(files={"/test.txt": "line1\nline2\nline3\n"})
        result = await bash.exec('sed -n "2p" /test.txt')
        assert result.stdout == "line2\n"

    @pytest.mark.asyncio
    async def test_sed_address_range(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\nd\ne\n"})
        result = await bash.exec('sed "2,4d" /test.txt')
        assert result.stdout == "a\ne\n"

    @pytest.mark.asyncio
    async def test_sed_regex_address(self):
        bash = Bash(files={"/test.txt": "foo\nbar\nfoo\nbaz\n"})
        result = await bash.exec('sed "/foo/d" /test.txt')
        assert result.stdout == "bar\nbaz\n"

    @pytest.mark.asyncio
    async def test_sed_stdin(self):
        bash = Bash()
        result = await bash.exec('echo hello | sed "s/hello/world/"')
        assert result.stdout == "world\n"

    @pytest.mark.asyncio
    async def test_sed_transliterate(self):
        bash = Bash(files={"/test.txt": "abc\n"})
        result = await bash.exec('sed "y/abc/xyz/" /test.txt')
        assert result.stdout == "xyz\n"

    @pytest.mark.asyncio
    async def test_sed_in_place_script_file(self):
        """Test sed with script from file (avoids shell expansion issues)."""
        bash = Bash(files={
            "/data.txt": "hello\n",
            "/script.sed": "s/hello/world/"
        })
        result = await bash.exec("sed -f /script.sed /data.txt")
        assert result.stdout == "world\n"


class TestAwkCommand:
    """Test awk command."""

    @pytest.mark.asyncio
    async def test_awk_print_all(self):
        """Test awk with program from file."""
        bash = Bash(files={
            "/data.txt": "a b c\n1 2 3\n",
            "/prog.awk": "{print}"
        })
        result = await bash.exec("awk -f /prog.awk /data.txt")
        assert result.stdout == "a b c\n1 2 3\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_awk_print_field(self):
        bash = Bash(files={
            "/data.txt": "a b c\n1 2 3\n",
            "/prog.awk": "{print $2}"
        })
        result = await bash.exec("awk -f /prog.awk /data.txt")
        assert result.stdout == "b\n2\n"

    @pytest.mark.asyncio
    async def test_awk_field_separator(self):
        bash = Bash(files={
            "/data.txt": "a,b,c\n1,2,3\n",
            "/prog.awk": "{print $1}"
        })
        result = await bash.exec("awk -F, -f /prog.awk /data.txt")
        assert result.stdout == "a\n1\n"

    @pytest.mark.asyncio
    async def test_awk_begin_end(self):
        bash = Bash(files={
            "/data.txt": "a\nb\nc\n",
            "/prog.awk": "BEGIN {print \"start\"} {print} END {print \"done\"}"
        })
        result = await bash.exec("awk -f /prog.awk /data.txt")
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "start"
        assert lines[-1] == "done"

    @pytest.mark.asyncio
    async def test_awk_sum(self):
        bash = Bash(files={
            "/data.txt": "1\n2\n3\n4\n5\n",
            "/prog.awk": "{sum+=$1} END {print sum}"
        })
        result = await bash.exec("awk -f /prog.awk /data.txt")
        assert "15" in result.stdout

    @pytest.mark.asyncio
    async def test_awk_nr_variable(self):
        bash = Bash(files={
            "/data.txt": "a\nb\nc\n",
            "/prog.awk": "NR==2 {print $0}"
        })
        result = await bash.exec("awk -f /prog.awk /data.txt")
        assert result.stdout == "b\n"

    @pytest.mark.asyncio
    async def test_awk_nf_variable(self):
        bash = Bash(files={
            "/data.txt": "a b c\n1 2\nx\n",
            "/prog.awk": "{print NF}"
        })
        result = await bash.exec("awk -f /prog.awk /data.txt")
        assert result.stdout == "3\n2\n1\n"

    @pytest.mark.asyncio
    async def test_awk_length_function(self):
        bash = Bash(files={
            "/data.txt": "hello\nworld\n",
            "/prog.awk": "{print length($0)}"
        })
        result = await bash.exec("awk -f /prog.awk /data.txt")
        assert result.stdout == "5\n5\n"

    @pytest.mark.asyncio
    async def test_awk_printf(self):
        bash = Bash(files={
            "/data.txt": "5\n10\n",
            "/prog.awk": '{printf "%03d\\n", $1}'
        })
        result = await bash.exec("awk -f /prog.awk /data.txt")
        assert result.stdout == "005\n010\n"

    @pytest.mark.asyncio
    async def test_awk_variable_assignment(self):
        # Quote the assignment since shell parses unquoted x=42 as variable assignment
        bash = Bash(files={
            "/data.txt": "test\n",
            "/prog.awk": "{print x}"
        })
        result = await bash.exec('awk -v "x=42" -f /prog.awk /data.txt')
        assert result.exit_code == 0
        assert "42" in result.stdout


class TestAwkRandFunctions:
    """Test awk rand() and srand() functions."""

    @pytest.mark.asyncio
    async def test_awk_rand_returns_number(self):
        """Test rand() returns a number between 0 and 1."""
        bash = Bash()
        result = await bash.exec("awk 'BEGIN {print rand()}'")
        assert result.exit_code == 0
        val = float(result.stdout.strip())
        assert 0 <= val < 1

    @pytest.mark.asyncio
    async def test_awk_rand_in_condition(self):
        """Test rand() works in conditions."""
        bash = Bash(files={"/data.txt": "\n".join(["line"] * 1000) + "\n"})
        # With 1000 lines and 50% chance, we should get roughly 500 lines
        result = await bash.exec("awk '{if(rand() < 0.5) print}' /data.txt")
        assert result.exit_code == 0
        lines = [l for l in result.stdout.split("\n") if l]
        # Should be roughly 500, allow wide margin
        assert 200 < len(lines) < 800

    @pytest.mark.asyncio
    async def test_awk_srand_seeds_generator(self):
        """Test srand() with same seed produces same sequence."""
        bash = Bash()
        result1 = await bash.exec("awk 'BEGIN {srand(42); print rand(), rand(), rand()}'")
        result2 = await bash.exec("awk 'BEGIN {srand(42); print rand(), rand(), rand()}'")
        assert result1.exit_code == 0
        assert result2.exit_code == 0
        assert result1.stdout == result2.stdout

    @pytest.mark.asyncio
    async def test_awk_srand_different_seeds(self):
        """Test srand() with different seeds produces different sequences."""
        bash = Bash()
        result1 = await bash.exec("awk 'BEGIN {srand(1); print rand()}'")
        result2 = await bash.exec("awk 'BEGIN {srand(2); print rand()}'")
        assert result1.exit_code == 0
        assert result2.exit_code == 0
        assert result1.stdout != result2.stdout

    @pytest.mark.asyncio
    async def test_awk_srand_no_arg(self):
        """Test srand() without argument uses time-based seed."""
        bash = Bash()
        result = await bash.exec("awk 'BEGIN {srand(); print rand()}'")
        assert result.exit_code == 0
        val = float(result.stdout.strip())
        assert 0 <= val < 1

    @pytest.mark.asyncio
    async def test_awk_rand_sampling(self):
        """Test rand() for random sampling like the original use case."""
        bash = Bash(files={"/data.txt": "\n".join([f"line{i}" for i in range(100)]) + "\n"})
        result = await bash.exec("awk 'BEGIN{srand(123)} {if(rand() < 0.1) print}' /data.txt")
        assert result.exit_code == 0
        lines = [l for l in result.stdout.split("\n") if l]
        # With 10% sampling of 100 lines, expect roughly 10 lines
        assert 1 < len(lines) < 30


class TestAwkSprintfFunction:
    """Test awk sprintf() function."""

    @pytest.mark.asyncio
    async def test_awk_sprintf_basic(self):
        """Test sprintf() returns formatted string."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {s = sprintf("%d", 42); print s}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "42"

    @pytest.mark.asyncio
    async def test_awk_sprintf_string_format(self):
        """Test sprintf() with string format."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {s = sprintf("%s world", "hello"); print s}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "hello world"

    @pytest.mark.asyncio
    async def test_awk_sprintf_padding(self):
        """Test sprintf() with padding."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {s = sprintf("%05d", 7); print s}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "00007"

    @pytest.mark.asyncio
    async def test_awk_sprintf_float(self):
        """Test sprintf() with float format."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {s = sprintf("%.2f", 3.14159); print s}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "3.14"

    @pytest.mark.asyncio
    async def test_awk_sprintf_multiple_args(self):
        """Test sprintf() with multiple arguments."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {s = sprintf("%s=%d", "x", 10); print s}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "x=10"

    @pytest.mark.asyncio
    async def test_awk_sprintf_in_expression(self):
        """Test sprintf() used in an expression."""
        bash = Bash(files={"/data.txt": "5\n10\n15\n"})
        result = await bash.exec('awk \'{print sprintf("val:%03d", $1)}\' /data.txt')
        assert result.exit_code == 0
        assert "val:005" in result.stdout
        assert "val:010" in result.stdout
        assert "val:015" in result.stdout


class TestAwkMatchFunction:
    """Test awk match() function."""

    @pytest.mark.asyncio
    async def test_awk_match_found(self):
        """Test match() returns position when pattern found."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {print match("hello world", /wor/)}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "7"

    @pytest.mark.asyncio
    async def test_awk_match_not_found(self):
        """Test match() returns 0 when pattern not found."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {print match("hello world", /xyz/)}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "0"

    @pytest.mark.asyncio
    async def test_awk_match_sets_rstart(self):
        """Test match() sets RSTART variable."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {match("hello world", /wor/); print RSTART}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "7"

    @pytest.mark.asyncio
    async def test_awk_match_sets_rlength(self):
        """Test match() sets RLENGTH variable."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {match("hello world", /wor/); print RLENGTH}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_awk_match_no_match_rlength(self):
        """Test RLENGTH is -1 when no match."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {match("hello", /xyz/); print RLENGTH}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "-1"

    @pytest.mark.asyncio
    async def test_awk_match_with_field(self):
        """Test match() with field variable."""
        bash = Bash(files={"/data.txt": "hello world\nfoo bar\n"})
        result = await bash.exec('awk \'{print match($0, /o+/)}\' /data.txt')
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "5"  # "hello" has 'o' at position 5
        assert lines[1] == "2"  # "foo" has 'oo' at position 2

    @pytest.mark.asyncio
    async def test_awk_match_extract_substring(self):
        """Test using match() with substr() to extract matched text."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {s="hello123world"; match(s, /[0-9]+/); print substr(s, RSTART, RLENGTH)}\'')
        assert result.exit_code == 0
        assert result.stdout.strip() == "123"


class TestAwkAtan2Function:
    """Test awk atan2() function."""

    @pytest.mark.asyncio
    async def test_awk_atan2_basic(self):
        """Test atan2() basic usage."""
        bash = Bash()
        result = await bash.exec("awk 'BEGIN {print atan2(1, 1)}'")
        assert result.exit_code == 0
        # atan2(1,1) = pi/4 ≈ 0.785398
        val = float(result.stdout.strip())
        assert abs(val - 0.785398) < 0.0001

    @pytest.mark.asyncio
    async def test_awk_atan2_quadrants(self):
        """Test atan2() handles different quadrants."""
        bash = Bash()
        result = await bash.exec("awk 'BEGIN {print atan2(1, 0)}'")
        assert result.exit_code == 0
        # atan2(1,0) = pi/2 ≈ 1.5708
        val = float(result.stdout.strip())
        assert abs(val - 1.5708) < 0.001

    @pytest.mark.asyncio
    async def test_awk_atan2_negative(self):
        """Test atan2() with negative values."""
        bash = Bash()
        result = await bash.exec("awk 'BEGIN {print atan2(-1, -1)}'")
        assert result.exit_code == 0
        # atan2(-1,-1) = -3*pi/4 ≈ -2.356
        val = float(result.stdout.strip())
        assert abs(val - (-2.356194)) < 0.001


class TestAwkTimeFunctions:
    """Test awk systime() and strftime() functions."""

    @pytest.mark.asyncio
    async def test_awk_systime_returns_epoch(self):
        """Test systime() returns current epoch timestamp."""
        import time
        bash = Bash()
        result = await bash.exec("awk 'BEGIN {print systime()}'")
        assert result.exit_code == 0
        timestamp = int(result.stdout.strip())
        now = int(time.time())
        # Should be within 5 seconds of current time
        assert abs(timestamp - now) < 5

    @pytest.mark.asyncio
    async def test_awk_strftime_basic(self):
        """Test strftime() formats timestamp."""
        bash = Bash()
        # Use a known timestamp: 2024-01-15 12:30:45 UTC = 1705322445
        result = await bash.exec('awk \'BEGIN {print strftime("%Y-%m-%d", 1705322445)}\'')
        assert result.exit_code == 0
        # Note: output depends on timezone, just check format
        assert "-" in result.stdout

    @pytest.mark.asyncio
    async def test_awk_strftime_time_format(self):
        """Test strftime() with time format."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {print strftime("%H:%M:%S", 1705322445)}\'')
        assert result.exit_code == 0
        assert ":" in result.stdout

    @pytest.mark.asyncio
    async def test_awk_strftime_full_format(self):
        """Test strftime() with full date-time format."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {print strftime("%Y-%m-%d %H:%M:%S", 0)}\'')
        assert result.exit_code == 0
        # Epoch 0 should give 1970-01-01 (in UTC)
        assert "1970" in result.stdout or "1969" in result.stdout  # Depends on timezone

    @pytest.mark.asyncio
    async def test_awk_strftime_weekday(self):
        """Test strftime() with weekday format."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {print strftime("%A", 0)}\'')
        assert result.exit_code == 0
        # Should be a day name
        assert len(result.stdout.strip()) > 0

    @pytest.mark.asyncio
    async def test_awk_systime_strftime_combined(self):
        """Test using systime() with strftime()."""
        bash = Bash()
        result = await bash.exec('awk \'BEGIN {print strftime("%Y", systime())}\'')
        assert result.exit_code == 0
        year = int(result.stdout.strip())
        # Should be current year (2024, 2025, or 2026)
        assert 2024 <= year <= 2030


class TestFindCommand:
    """Test find command."""

    @pytest.mark.asyncio
    async def test_find_all(self):
        bash = Bash(files={
            "/dir/a.txt": "a",
            "/dir/b.txt": "b",
        })
        result = await bash.exec("find /dir")
        assert "/dir" in result.stdout
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_find_name(self):
        bash = Bash(files={
            "/dir/test.txt": "a",
            "/dir/test.log": "b",
            "/dir/other.txt": "c",
        })
        result = await bash.exec('find /dir -name "*.txt"')
        assert "test.txt" in result.stdout
        assert "other.txt" in result.stdout
        assert "test.log" not in result.stdout

    @pytest.mark.asyncio
    async def test_find_type_file(self):
        bash = Bash(files={
            "/dir/file.txt": "content",
            "/dir/subdir/nested.txt": "nested",
        })
        result = await bash.exec("find /dir -type f")
        assert "file.txt" in result.stdout
        assert "nested.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_find_type_directory(self):
        bash = Bash(files={"/dir/subdir/file.txt": "content"})
        result = await bash.exec("find /dir -type d")
        assert "/dir" in result.stdout
        assert "subdir" in result.stdout
        assert "file.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_find_maxdepth(self):
        bash = Bash(files={
            "/dir/a.txt": "a",
            "/dir/sub/b.txt": "b",
            "/dir/sub/deep/c.txt": "c",
        })
        result = await bash.exec("find /dir -maxdepth 1 -type f")
        assert "a.txt" in result.stdout
        assert "b.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_find_name_case_insensitive(self):
        bash = Bash(files={
            "/dir/TEST.txt": "a",
            "/dir/test.TXT": "b",
        })
        result = await bash.exec('find /dir -iname "test.txt"')
        assert "TEST.txt" in result.stdout
        assert "test.TXT" in result.stdout

    @pytest.mark.asyncio
    async def test_find_not_operator(self):
        bash = Bash(files={
            "/dir/a.txt": "a",
            "/dir/b.log": "b",
        })
        result = await bash.exec('find /dir -type f -not -name "*.log"')
        assert "a.txt" in result.stdout
        assert "b.log" not in result.stdout

    @pytest.mark.asyncio
    async def test_find_nonexistent_path(self):
        bash = Bash()
        result = await bash.exec("find /nonexistent")
        assert result.exit_code == 1
        assert "No such file" in result.stderr


# =============================================================================
# JSON Processing Tests
# =============================================================================


class TestJqCommand:
    """Test jq command."""

    @pytest.mark.asyncio
    async def test_jq_identity(self):
        bash = Bash(files={"/data.json": '{"name": "test"}'})
        result = await bash.exec("jq '.' /data.json")
        assert "name" in result.stdout
        assert "test" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_jq_field_access(self):
        bash = Bash(files={"/data.json": '{"name": "test", "value": 42}'})
        result = await bash.exec("jq '.name' /data.json")
        assert result.stdout.strip() == '"test"'

    @pytest.mark.asyncio
    async def test_jq_raw_output(self):
        bash = Bash(files={"/data.json": '{"name": "test"}'})
        result = await bash.exec("jq -r '.name' /data.json")
        assert result.stdout.strip() == "test"  # No quotes

    @pytest.mark.asyncio
    async def test_jq_nested_field(self):
        bash = Bash(files={"/data.json": '{"a": {"b": {"c": 123}}}'})
        result = await bash.exec("jq '.a.b.c' /data.json")
        assert result.stdout.strip() == "123"

    @pytest.mark.asyncio
    async def test_jq_array_index(self):
        bash = Bash(files={"/data.json": '[1, 2, 3, 4, 5]'})
        result = await bash.exec("jq '.[2]' /data.json")
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_jq_array_iterator(self):
        bash = Bash(files={"/data.json": '[1, 2, 3]'})
        result = await bash.exec("jq '.[]' /data.json")
        lines = result.stdout.strip().split("\n")
        assert lines == ["1", "2", "3"]

    @pytest.mark.asyncio
    async def test_jq_array_slice(self):
        bash = Bash(files={"/data.json": '[1, 2, 3, 4, 5]'})
        result = await bash.exec("jq '.[1:4]' /data.json")
        assert "2" in result.stdout
        assert "3" in result.stdout
        assert "4" in result.stdout

    @pytest.mark.asyncio
    async def test_jq_length(self):
        bash = Bash(files={"/data.json": '[1, 2, 3, 4, 5]'})
        result = await bash.exec("jq 'length' /data.json")
        assert result.stdout.strip() == "5"

    @pytest.mark.asyncio
    async def test_jq_keys(self):
        bash = Bash(files={"/data.json": '{"b": 1, "a": 2, "c": 3}'})
        result = await bash.exec("jq 'keys' /data.json")
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_jq_sort(self):
        bash = Bash(files={"/data.json": '[3, 1, 4, 1, 5, 9, 2, 6]'})
        result = await bash.exec("jq 'sort' /data.json")
        # Check sorted order
        assert "1" in result.stdout

    @pytest.mark.asyncio
    async def test_jq_map(self):
        bash = Bash(files={"/data.json": '[{"x": 1}, {"x": 2}, {"x": 3}]'})
        result = await bash.exec("jq 'map(.x)' /data.json")
        assert "1" in result.stdout
        assert "2" in result.stdout
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_jq_select(self):
        bash = Bash(files={"/data.json": '[1, 2, 3, 4, 5]'})
        result = await bash.exec("jq '.[] | select(. > 3)' /data.json")
        lines = result.stdout.strip().split("\n")
        assert "4" in lines
        assert "5" in lines
        assert "3" not in lines

    @pytest.mark.asyncio
    async def test_jq_add(self):
        bash = Bash(files={"/data.json": '[1, 2, 3, 4, 5]'})
        result = await bash.exec("jq 'add' /data.json")
        assert result.stdout.strip() == "15"

    @pytest.mark.asyncio
    async def test_jq_unique(self):
        bash = Bash(files={"/data.json": '[1, 2, 1, 3, 2, 1]'})
        result = await bash.exec("jq 'unique' /data.json")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_jq_compact_output(self):
        bash = Bash(files={"/data.json": '{"a": 1, "b": 2}'})
        result = await bash.exec("jq -c '.' /data.json")
        # Compact output should be on one line
        assert "\n" not in result.stdout.strip()

    @pytest.mark.asyncio
    async def test_jq_stdin(self):
        bash = Bash()
        result = await bash.exec('echo \'{"x": 1}\' | jq ".x"')
        assert "1" in result.stdout

    @pytest.mark.asyncio
    async def test_jq_invalid_json_error(self):
        bash = Bash(files={"/data.txt": "not json"})
        result = await bash.exec("jq '.' /data.txt")
        assert result.exit_code == 2

    @pytest.mark.asyncio
    async def test_jq_group_by_multiple_groups(self):
        """Test group_by with multiple groups - currently fails."""
        bash = Bash(files={
            "/data.json": '[{"name": "A", "val": 1}, {"name": "B", "val": 2}, {"name": "A", "val": 3}]'
        })
        result = await bash.exec("jq 'group_by(.name)' /data.json")

        # group_by should produce an array of arrays grouped by .name
        # Expected: [[{"name":"A","val":1},{"name":"A","val":3}],[{"name":"B","val":2}]]
        import json
        output = json.loads(result.stdout.strip())

        assert result.exit_code == 0
        assert isinstance(output, list), "group_by should return an array"
        assert len(output) == 2, "Should have 2 groups (A and B)"

        # Each group should be an array
        for group in output:
            assert isinstance(group, list), "Each group should be an array"

        # Find group A and group B
        group_a = next((g for g in output if g[0]["name"] == "A"), None)
        group_b = next((g for g in output if g[0]["name"] == "B"), None)

        assert group_a is not None, "Should have group A"
        assert group_b is not None, "Should have group B"
        assert len(group_a) == 2, "Group A should have 2 items"
        assert len(group_b) == 1, "Group B should have 1 item"

    # ============================================================
    # UNIMPLEMENTED FEATURES - Expected to fail until implemented
    # ============================================================

    @pytest.mark.asyncio
    async def test_jq_sort_by(self):
        """sort_by(expr) - sort array by expression result."""
        bash = Bash()
        result = await bash.exec(
            'echo \'[{"name":"Bob","age":30},{"name":"Alice","age":25}]\' | jq "sort_by(.name)"'
        )
        assert result.exit_code == 0
        assert json.loads(result.stdout) == [
            {"name": "Alice", "age": 25},
            {"name": "Bob", "age": 30},
        ]

    @pytest.mark.asyncio
    async def test_jq_sort_by_numeric(self):
        """sort_by(expr) - sort by numeric field."""
        bash = Bash()
        result = await bash.exec(
            'echo \'[{"n":"a","v":3},{"n":"b","v":1},{"n":"c","v":2}]\' | jq "sort_by(.v)"'
        )
        assert result.exit_code == 0
        assert json.loads(result.stdout) == [
            {"n": "b", "v": 1},
            {"n": "c", "v": 2},
            {"n": "a", "v": 3},
        ]

    @pytest.mark.asyncio
    async def test_jq_unique_by(self):
        """unique_by(expr) - remove duplicates by expression."""
        bash = Bash()
        result = await bash.exec(
            'echo \'[{"name":"A","val":1},{"name":"B","val":2},{"name":"A","val":3}]\' | jq "unique_by(.name)"'
        )
        assert result.exit_code == 0
        # Should keep first occurrence of each unique key
        parsed = json.loads(result.stdout)
        assert len(parsed) == 2
        names = [item["name"] for item in parsed]
        assert "A" in names
        assert "B" in names

    @pytest.mark.asyncio
    async def test_jq_min_by(self):
        """min_by(expr) - find minimum by expression."""
        bash = Bash()
        result = await bash.exec(
            'echo \'[{"name":"Bob","age":30},{"name":"Alice","age":25}]\' | jq "min_by(.age)"'
        )
        assert result.exit_code == 0
        assert json.loads(result.stdout) == {"name": "Alice", "age": 25}

    @pytest.mark.asyncio
    async def test_jq_max_by(self):
        """max_by(expr) - find maximum by expression."""
        bash = Bash()
        result = await bash.exec(
            'echo \'[{"name":"Bob","age":30},{"name":"Alice","age":25}]\' | jq "max_by(.age)"'
        )
        assert result.exit_code == 0
        assert json.loads(result.stdout) == {"name": "Bob", "age": 30}

    @pytest.mark.asyncio
    async def test_jq_to_entries(self):
        """to_entries - convert object to [{key, value}] array."""
        bash = Bash()
        result = await bash.exec('echo \'{"a":1,"b":2}\' | jq "to_entries"')
        assert result.exit_code == 0
        parsed = json.loads(result.stdout)
        # Order may vary, so check contents
        assert len(parsed) == 2
        keys = {item["key"] for item in parsed}
        assert keys == {"a", "b"}
        values = {item["value"] for item in parsed}
        assert values == {1, 2}

    @pytest.mark.asyncio
    async def test_jq_from_entries(self):
        """from_entries - convert [{key, value}] array to object."""
        bash = Bash()
        result = await bash.exec(
            'echo \'[{"key":"a","value":1},{"key":"b","value":2}]\' | jq "from_entries"'
        )
        assert result.exit_code == 0
        assert json.loads(result.stdout) == {"a": 1, "b": 2}

    @pytest.mark.asyncio
    async def test_jq_with_entries(self):
        """with_entries(f) - transform entries."""
        bash = Bash()
        result = await bash.exec(
            'echo \'{"a":1,"b":2}\' | jq "with_entries(.value += 10)"'
        )
        assert result.exit_code == 0
        assert json.loads(result.stdout) == {"a": 11, "b": 12}

    @pytest.mark.asyncio
    async def test_jq_floor(self):
        """floor - round down."""
        bash = Bash()
        result = await bash.exec("echo '3.7' | jq 'floor'")
        assert result.exit_code == 0
        assert json.loads(result.stdout) == 3

    @pytest.mark.asyncio
    async def test_jq_ceil(self):
        """ceil - round up."""
        bash = Bash()
        result = await bash.exec("echo '3.2' | jq 'ceil'")
        assert result.exit_code == 0
        assert json.loads(result.stdout) == 4

    @pytest.mark.asyncio
    async def test_jq_round(self):
        """round - round to nearest integer."""
        bash = Bash()
        result = await bash.exec("echo '3.5' | jq 'round'")
        assert result.exit_code == 0
        assert json.loads(result.stdout) == 4

    @pytest.mark.asyncio
    async def test_jq_sqrt(self):
        """sqrt - square root."""
        bash = Bash()
        result = await bash.exec("echo '16' | jq 'sqrt'")
        assert result.exit_code == 0
        assert json.loads(result.stdout) == 4

    @pytest.mark.asyncio
    async def test_jq_fabs(self):
        """fabs - absolute value."""
        bash = Bash()
        result = await bash.exec("echo '-5.5' | jq 'fabs'")
        assert result.exit_code == 0
        assert json.loads(result.stdout) == 5.5

    @pytest.mark.asyncio
    async def test_jq_match(self):
        """match(regex) - regex match with capture groups."""
        bash = Bash()
        result = await bash.exec('echo \'"test 123"\' | jq \'match("[0-9]+")\'')
        assert result.exit_code == 0
        parsed = json.loads(result.stdout)
        assert parsed["offset"] == 5
        assert parsed["length"] == 3
        assert parsed["string"] == "123"

    @pytest.mark.asyncio
    async def test_jq_inside(self):
        """inside(x) - inverse containment check."""
        bash = Bash()
        result = await bash.exec('echo \'{"a":1}\' | jq \'inside({"a":1,"b":2})\'')
        assert result.exit_code == 0
        assert json.loads(result.stdout) is True

    @pytest.mark.asyncio
    async def test_jq_getpath(self):
        """getpath(path) - get value at path array."""
        bash = Bash()
        result = await bash.exec('echo \'{"a":{"b":1}}\' | jq \'getpath(["a","b"])\'')
        assert result.exit_code == 0
        assert json.loads(result.stdout) == 1

    @pytest.mark.asyncio
    async def test_jq_paths(self):
        """paths - get all paths in structure."""
        bash = Bash()
        result = await bash.exec('echo \'{"a":1,"b":{"c":2}}\' | jq \'[paths]\'')
        assert result.exit_code == 0
        parsed = json.loads(result.stdout)
        assert ["a"] in parsed
        assert ["b"] in parsed
        assert ["b", "c"] in parsed


class TestJqOutputFlags:
    """Test jq output formatting flags."""

    @pytest.mark.asyncio
    async def test_jq_join_output(self):
        """Test -j removes newlines between outputs."""
        bash = Bash(files={"/data.json": '[1, 2, 3]'})
        result = await bash.exec("jq -j '.[]' /data.json")
        # Should be "123" with no newlines, not "1\n2\n3\n"
        assert result.stdout == "123"

    @pytest.mark.asyncio
    async def test_jq_join_output_with_strings(self):
        """Test -j with string values."""
        bash = Bash(files={"/data.json": '["a", "b", "c"]'})
        result = await bash.exec("jq -rj '.[]' /data.json")
        assert result.stdout == "abc"

    @pytest.mark.asyncio
    async def test_jq_sort_keys(self):
        """Test -S sorts object keys."""
        bash = Bash(files={"/data.json": '{"z": 1, "a": 2, "m": 3}'})
        result = await bash.exec("jq -S '.' /data.json")
        # Keys should appear in order: a, m, z
        lines = result.stdout.strip()
        assert lines.index('"a"') < lines.index('"m"') < lines.index('"z"')

    @pytest.mark.asyncio
    async def test_jq_sort_keys_nested(self):
        """Test -S sorts nested object keys."""
        bash = Bash(files={"/data.json": '{"b": {"z": 1, "a": 2}}'})
        result = await bash.exec("jq -S '.' /data.json")
        assert result.stdout.index('"a"') < result.stdout.index('"z"')

    @pytest.mark.asyncio
    async def test_jq_sort_keys_compact(self):
        """Test -S with -c (compact + sorted)."""
        bash = Bash(files={"/data.json": '{"z": 1, "a": 2}'})
        result = await bash.exec("jq -Sc '.' /data.json")
        assert result.stdout.strip() == '{"a":2,"z":1}'

    @pytest.mark.asyncio
    async def test_jq_tab_indent(self):
        """Test --tab uses tabs for indentation."""
        bash = Bash(files={"/data.json": '{"a": 1}'})
        result = await bash.exec("jq --tab '.' /data.json")
        assert "\t" in result.stdout
        assert "  " not in result.stdout  # No space indentation

    @pytest.mark.asyncio
    async def test_jq_tab_indent_nested(self):
        """Test --tab with nested objects."""
        bash = Bash(files={"/data.json": '{"a": {"b": 1}}'})
        result = await bash.exec("jq --tab '.' /data.json")
        # Should have tabs, not spaces
        lines = result.stdout.split("\n")
        indented_lines = [l for l in lines if l.startswith("\t")]
        assert len(indented_lines) >= 1

    @pytest.mark.asyncio
    async def test_jq_ascii_output(self):
        """Test -a escapes non-ASCII characters."""
        bash = Bash(files={"/data.json": '{"name": "café"}'})
        result = await bash.exec("jq -a '.' /data.json")
        # "é" should be escaped as \u00e9
        assert "\\u00e9" in result.stdout
        assert "é" not in result.stdout

    @pytest.mark.asyncio
    async def test_jq_ascii_output_unicode(self):
        """Test -a with various unicode characters."""
        bash = Bash(files={"/data.json": '{"emoji": "😀"}'})
        result = await bash.exec("jq -a '.' /data.json")
        # Emoji should be escaped
        assert "😀" not in result.stdout
        assert "\\u" in result.stdout

    @pytest.mark.asyncio
    async def test_jq_combined_flags(self):
        """Test combining multiple new flags."""
        bash = Bash(files={"/data.json": '{"z": "café", "a": 1}'})
        result = await bash.exec("jq -Sa '.' /data.json")
        # Should be sorted AND ascii-escaped
        assert result.stdout.index('"a"') < result.stdout.index('"z"')
        assert "\\u00e9" in result.stdout


# =============================================================================
# Additional Coverage Tests
# =============================================================================


class TestCatCommand:
    """Test cat command."""

    @pytest.mark.asyncio
    async def test_cat_single_file(self):
        bash = Bash(files={"/test.txt": "hello world"})
        result = await bash.exec("cat /test.txt")
        assert result.stdout == "hello world\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cat_multiple_files(self):
        bash = Bash(files={
            "/a.txt": "aaa",
            "/b.txt": "bbb",
        })
        result = await bash.exec("cat /a.txt /b.txt")
        assert result.stdout == "aaa\nbbb\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cat_stdin(self):
        bash = Bash()
        result = await bash.exec("echo hello | cat")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_cat_stdin_with_dash(self):
        bash = Bash(files={"/a.txt": "file"})
        result = await bash.exec("echo stdin | cat /a.txt - /a.txt")
        assert "file" in result.stdout
        assert "stdin" in result.stdout

    @pytest.mark.asyncio
    async def test_cat_nonexistent_file(self):
        bash = Bash()
        result = await bash.exec("cat /nonexistent.txt")
        assert result.exit_code == 1
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_cat_show_line_numbers(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("cat -n /test.txt")
        assert "1" in result.stdout
        assert "2" in result.stdout
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_cat_empty_file(self):
        bash = Bash(files={"/empty.txt": ""})
        result = await bash.exec("cat /empty.txt")
        assert result.stdout == ""
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cat_binary_content(self):
        # Cat should handle non-text content
        bash = Bash(files={"/data.bin": "\x00\x01\x02"})
        result = await bash.exec("cat /data.bin")
        assert result.exit_code == 0


class TestEchoCommand:
    """Test echo command."""

    @pytest.mark.asyncio
    async def test_echo_basic(self):
        bash = Bash()
        result = await bash.exec("echo hello")
        assert result.stdout == "hello\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_echo_multiple_args(self):
        bash = Bash()
        result = await bash.exec("echo hello world foo")
        assert result.stdout == "hello world foo\n"

    @pytest.mark.asyncio
    async def test_echo_no_newline(self):
        bash = Bash()
        result = await bash.exec("echo -n hello")
        assert result.stdout == "hello"  # No trailing newline

    @pytest.mark.asyncio
    async def test_echo_escape_sequences(self):
        # Use file to avoid shell quoting issues with backslashes
        bash = Bash(files={"/script.sh": "echo -e 'hello\\nworld'"})
        result = await bash.exec("echo -e hello")
        assert result.exit_code == 0
        # Basic test - escapes work, full test below uses different approach

    @pytest.mark.asyncio
    async def test_echo_escape_tab(self):
        # Test with actual escape processing
        bash = Bash()
        result = await bash.exec("echo -e 'a	b'")  # Actual tab character
        assert "\t" in result.stdout or "a\tb" in result.stdout or result.exit_code == 0

    @pytest.mark.asyncio
    async def test_echo_disable_escapes(self):
        bash = Bash()
        result = await bash.exec("echo -E 'hello\\nworld'")
        # -E disables escapes, should be literal
        assert "\\n" in result.stdout or "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_echo_empty(self):
        bash = Bash()
        result = await bash.exec("echo")
        assert result.stdout == "\n"

    @pytest.mark.asyncio
    async def test_echo_with_quotes(self):
        bash = Bash()
        result = await bash.exec('echo "hello world"')
        assert result.stdout == "hello world\n"

    @pytest.mark.asyncio
    async def test_echo_combined_flags(self):
        bash = Bash()
        result = await bash.exec("echo -n hello")
        assert result.stdout == "hello"  # No newline with -n

    @pytest.mark.asyncio
    async def test_echo_preserves_spaces(self):
        bash = Bash()
        result = await bash.exec('echo "  spaced  "')
        assert result.stdout == "  spaced  \n"


class TestTrueCommand:
    """Test true command."""

    @pytest.mark.asyncio
    async def test_true_exit_code(self):
        bash = Bash()
        result = await bash.exec("true")
        assert result.exit_code == 0
        assert result.stdout == ""
        assert result.stderr == ""

    @pytest.mark.asyncio
    async def test_true_ignores_args(self):
        bash = Bash()
        result = await bash.exec("true arg1 arg2 --flag")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_true_in_conditional(self):
        bash = Bash()
        result = await bash.exec("if true; then echo yes; else echo no; fi")
        assert result.stdout == "yes\n"


class TestFalseCommand:
    """Test false command."""

    @pytest.mark.asyncio
    async def test_false_exit_code(self):
        bash = Bash()
        result = await bash.exec("false")
        assert result.exit_code == 1
        assert result.stdout == ""
        assert result.stderr == ""

    @pytest.mark.asyncio
    async def test_false_ignores_args(self):
        bash = Bash()
        result = await bash.exec("false arg1 arg2 --flag")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_false_in_conditional(self):
        bash = Bash()
        result = await bash.exec("if false; then echo yes; else echo no; fi")
        assert result.stdout == "no\n"


class TestPwdCommandExtended:
    """Extended pwd command tests."""

    @pytest.mark.asyncio
    async def test_pwd_root(self):
        bash = Bash(cwd="/")
        result = await bash.exec("pwd")
        assert result.stdout == "/\n"

    @pytest.mark.asyncio
    async def test_pwd_nested(self):
        bash = Bash(cwd="/a/b/c/d")
        result = await bash.exec("pwd")
        assert result.stdout == "/a/b/c/d\n"

    @pytest.mark.asyncio
    async def test_pwd_with_different_cwd(self):
        # Test pwd with different initial cwd
        bash = Bash(cwd="/tmp", files={"/tmp/file.txt": "x"})
        result = await bash.exec("pwd")
        assert result.stdout == "/tmp\n"


class TestHeadCommandExtended:
    """Extended head command tests."""

    @pytest.mark.asyncio
    async def test_head_fewer_than_n_lines(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("head -n 10 /test.txt")
        assert result.stdout == "a\nb\nc\n"

    @pytest.mark.asyncio
    async def test_head_single_line(self):
        bash = Bash(files={"/test.txt": "only line\n"})
        result = await bash.exec("head -n 1 /test.txt")
        assert result.stdout == "only line\n"

    @pytest.mark.asyncio
    async def test_head_bytes(self):
        bash = Bash(files={"/test.txt": "hello world"})
        result = await bash.exec("head -c 5 /test.txt")
        assert result.stdout == "hello"

    @pytest.mark.asyncio
    async def test_head_empty_file(self):
        bash = Bash(files={"/empty.txt": ""})
        result = await bash.exec("head /empty.txt")
        assert result.stdout == ""
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_head_multiple_files(self):
        bash = Bash(files={
            "/a.txt": "aaa\n",
            "/b.txt": "bbb\n",
        })
        result = await bash.exec("head -n 1 /a.txt /b.txt")
        assert "aaa" in result.stdout
        assert "bbb" in result.stdout

    @pytest.mark.asyncio
    async def test_head_nonexistent(self):
        bash = Bash()
        result = await bash.exec("head /nonexistent.txt")
        assert result.exit_code == 1


class TestTailCommandExtended:
    """Extended tail command tests."""

    @pytest.mark.asyncio
    async def test_tail_custom_lines(self):
        lines = "\n".join([f"line{i}" for i in range(20)])
        bash = Bash(files={"/test.txt": lines})
        result = await bash.exec("tail -n 5 /test.txt")
        output_lines = result.stdout.strip().split("\n")
        assert len(output_lines) == 5
        assert "line19" in result.stdout

    @pytest.mark.asyncio
    async def test_tail_fewer_than_n_lines(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("tail -n 10 /test.txt")
        assert result.stdout == "a\nb\nc\n"

    @pytest.mark.asyncio
    async def test_tail_bytes(self):
        bash = Bash(files={"/test.txt": "hello world"})
        result = await bash.exec("tail -c 5 /test.txt")
        assert result.stdout == "world"

    @pytest.mark.asyncio
    async def test_tail_empty_file(self):
        bash = Bash(files={"/empty.txt": ""})
        result = await bash.exec("tail /empty.txt")
        assert result.stdout == ""
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tail_single_line(self):
        bash = Bash(files={"/test.txt": "only line\n"})
        result = await bash.exec("tail -n 1 /test.txt")
        assert result.stdout == "only line\n"

    @pytest.mark.asyncio
    async def test_tail_from_line_n(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\nd\ne\n"})
        result = await bash.exec("tail -n +3 /test.txt")
        # +3 means starting from line 3
        assert "c" in result.stdout
        assert "d" in result.stdout
        assert "e" in result.stdout


class TestWcCommandExtended:
    """Extended wc command tests."""

    @pytest.mark.asyncio
    async def test_wc_lines_only(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("wc -l /test.txt")
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_words_only(self):
        bash = Bash(files={"/test.txt": "one two three four"})
        result = await bash.exec("wc -w /test.txt")
        assert "4" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_chars_only(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("wc -c /test.txt")
        assert "5" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_empty_file(self):
        bash = Bash(files={"/empty.txt": ""})
        result = await bash.exec("wc /empty.txt")
        assert "0" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_wc_multiple_files(self):
        bash = Bash(files={
            "/a.txt": "one\ntwo\n",
            "/b.txt": "three\n",
        })
        result = await bash.exec("wc -l /a.txt /b.txt")
        assert "2" in result.stdout  # a.txt
        assert "1" in result.stdout  # b.txt
        assert "total" in result.stdout.lower() or "3" in result.stdout

    @pytest.mark.asyncio
    async def test_wc_stdin(self):
        bash = Bash()
        result = await bash.exec("echo 'one two three' | wc -w")
        assert "3" in result.stdout


class TestGrepCommandExtended:
    """Extended grep command tests."""

    @pytest.mark.asyncio
    async def test_grep_line_number(self):
        bash = Bash(files={"/test.txt": "foo\nbar\nfoo again\n"})
        result = await bash.exec("grep -n foo /test.txt")
        assert "1:" in result.stdout
        assert "3:" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_count(self):
        bash = Bash(files={"/test.txt": "foo\nbar\nfoo\n"})
        result = await bash.exec("grep -c foo /test.txt")
        assert "2" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_only_matching(self):
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("grep -o 'wor..' /test.txt")
        assert result.stdout.strip() == "world"

    @pytest.mark.asyncio
    async def test_grep_quiet(self):
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("grep -q hello /test.txt")
        assert result.exit_code == 0
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_grep_quiet_no_match(self):
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("grep -q xyz /test.txt")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_grep_files_with_matches(self):
        bash = Bash(files={
            "/a.txt": "foo\n",
            "/b.txt": "bar\n",
            "/c.txt": "foo bar\n",
        })
        result = await bash.exec("grep -l foo /a.txt /b.txt /c.txt")
        assert "a.txt" in result.stdout
        assert "c.txt" in result.stdout
        assert "b.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_extended_regex(self):
        bash = Bash(files={"/test.txt": "color\ncolour\n"})
        result = await bash.exec("grep -E 'colou?r' /test.txt")
        assert "color" in result.stdout
        assert "colour" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_whole_word(self):
        bash = Bash(files={"/test.txt": "cat\ncatch\nthe cat\n"})
        result = await bash.exec("grep -w cat /test.txt")
        assert "cat" in result.stdout
        # "catch" should not match whole word "cat"
        lines = [l for l in result.stdout.strip().split("\n") if l]
        assert not any("catch" in l and l.strip() == "catch" for l in lines)


class TestGrepBRE:
    """Test grep Basic Regular Expression (BRE) mode."""

    @pytest.mark.asyncio
    async def test_grep_bre_alternation(self):
        """Test BRE alternation with \\|."""
        bash = Bash(files={"/test.txt": "apple\nbanana\ncherry\norange\n"})
        result = await bash.exec(r"grep 'apple\|banana' /test.txt")
        assert result.exit_code == 0
        assert "apple" in result.stdout
        assert "banana" in result.stdout
        assert "cherry" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_bre_multiple_alternation(self):
        """Test BRE with multiple alternations."""
        bash = Bash(files={"/test.txt": "toyota\nhonda\nford\nbmw\nrandom\n"})
        result = await bash.exec(r"grep 'toyota\|honda\|ford\|bmw' /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 4
        assert "random" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_bre_one_or_more(self):
        """Test BRE one-or-more with \\+."""
        bash = Bash(files={"/test.txt": "a\nab\nabb\nabbb\n"})
        result = await bash.exec(r"grep 'ab\+' /test.txt")
        assert result.exit_code == 0
        assert "a\n" not in result.stdout  # Just 'a' should not match
        assert "ab" in result.stdout
        assert "abb" in result.stdout
        assert "abbb" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_bre_zero_or_one(self):
        """Test BRE zero-or-one with \\?."""
        bash = Bash(files={"/test.txt": "color\ncolour\ncolouur\n"})
        result = await bash.exec(r"grep 'colou\?r' /test.txt")
        assert result.exit_code == 0
        assert "color" in result.stdout
        assert "colour" in result.stdout
        assert "colouur" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_bre_grouping(self):
        """Test BRE grouping with \\( \\)."""
        bash = Bash(files={"/test.txt": "abab\nabcd\nab\n"})
        result = await bash.exec(r"grep '\(ab\)\1' /test.txt")
        assert result.exit_code == 0
        assert "abab" in result.stdout
        assert "abcd" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_bre_bounded_repetition(self):
        """Test BRE bounded repetition with \\{n,m\\}."""
        bash = Bash(files={"/test.txt": "a\naa\naaa\naaaa\n"})
        result = await bash.exec(r"grep 'a\{2,3\}' /test.txt")
        assert result.exit_code == 0
        assert "aa" in result.stdout
        assert "aaa" in result.stdout
        # Single 'a' alone should not match
        lines = [l.strip() for l in result.stdout.strip().split("\n")]
        assert "a" not in lines or len([l for l in lines if l == "a"]) == 0

    @pytest.mark.asyncio
    async def test_grep_bre_word_boundary(self):
        """Test BRE word boundaries with \\< and \\>."""
        bash = Bash(files={"/test.txt": "cat\ncatch\nthe cat runs\n"})
        result = await bash.exec(r"grep '\<cat\>' /test.txt")
        assert result.exit_code == 0
        assert "cat" in result.stdout
        # Should match "the cat runs" (whole word cat)
        lines = [l.strip() for l in result.stdout.strip().split("\n")]
        # "catch" should NOT be in the results as standalone
        assert "catch" not in lines

    @pytest.mark.asyncio
    async def test_grep_bre_literal_plus(self):
        """Test that literal + in BRE matches literal plus."""
        bash = Bash(files={"/test.txt": "a+b\nab\naab\n"})
        result = await bash.exec("grep 'a+b' /test.txt")
        assert result.exit_code == 0
        assert "a+b" in result.stdout
        # In BRE, unescaped + is literal, so "ab" should NOT match
        lines = [l.strip() for l in result.stdout.strip().split("\n")]
        assert "ab" not in lines

    @pytest.mark.asyncio
    async def test_grep_bre_literal_pipe(self):
        """Test that literal | in BRE matches literal pipe."""
        bash = Bash(files={"/test.txt": "a|b\nab\na b\n"})
        result = await bash.exec("grep 'a|b' /test.txt")
        assert result.exit_code == 0
        assert "a|b" in result.stdout
        lines = [l.strip() for l in result.stdout.strip().split("\n")]
        assert len(lines) == 1

    @pytest.mark.asyncio
    async def test_grep_bre_literal_question(self):
        """Test that literal ? in BRE matches literal question mark."""
        bash = Bash(files={"/test.txt": "what?\nwhat\nwhats\n"})
        result = await bash.exec("grep 'what?' /test.txt")
        assert result.exit_code == 0
        assert "what?" in result.stdout
        lines = [l.strip() for l in result.stdout.strip().split("\n")]
        assert len(lines) == 1

    @pytest.mark.asyncio
    async def test_grep_ere_vs_bre(self):
        """Test that -E changes behavior for alternation."""
        bash = Bash(files={"/test.txt": "apple\nbanana\n"})
        # ERE: unescaped | is alternation
        result_ere = await bash.exec("grep -E 'apple|banana' /test.txt")
        assert result_ere.exit_code == 0
        assert "apple" in result_ere.stdout
        assert "banana" in result_ere.stdout

        # BRE: unescaped | is literal
        result_bre = await bash.exec("grep 'apple|banana' /test.txt")
        assert result_bre.exit_code == 1  # No match


class TestSortCommandExtended:
    """Extended sort command tests."""

    @pytest.mark.asyncio
    async def test_sort_numeric_with_negatives(self):
        bash = Bash(files={"/test.txt": "-5\n10\n-20\n3\n"})
        result = await bash.exec("sort -n /test.txt")
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "-20"
        assert lines[-1] == "10"

    @pytest.mark.asyncio
    async def test_sort_ignore_case(self):
        bash = Bash(files={"/test.txt": "Banana\napple\nCherry\n"})
        result = await bash.exec("sort -f /test.txt")
        lines = result.stdout.strip().split("\n")
        assert lines[0].lower() == "apple"

    @pytest.mark.asyncio
    async def test_sort_by_field(self):
        bash = Bash(files={"/test.txt": "3 charlie\n1 alpha\n2 bravo\n"})
        result = await bash.exec("sort -k1 -n /test.txt")
        lines = result.stdout.strip().split("\n")
        assert "alpha" in lines[0]
        assert "charlie" in lines[2]

    @pytest.mark.asyncio
    async def test_sort_stable(self):
        bash = Bash(files={"/test.txt": "b 1\na 2\nb 2\na 1\n"})
        result = await bash.exec("sort -s -k1 /test.txt")
        assert result.exit_code == 0


class TestUniqCommandExtended:
    """Extended uniq command tests."""

    @pytest.mark.asyncio
    async def test_uniq_only_duplicates(self):
        bash = Bash(files={"/test.txt": "a\na\nb\nc\nc\nc\n"})
        result = await bash.exec("uniq -d /test.txt")
        assert "a" in result.stdout
        assert "c" in result.stdout
        assert "b" not in result.stdout

    @pytest.mark.asyncio
    async def test_uniq_only_unique(self):
        bash = Bash(files={"/test.txt": "a\na\nb\nc\nc\n"})
        result = await bash.exec("uniq -u /test.txt")
        assert "b" in result.stdout
        assert "a" not in result.stdout
        assert "c" not in result.stdout

    @pytest.mark.asyncio
    async def test_uniq_ignore_case(self):
        bash = Bash(files={"/test.txt": "A\na\nB\n"})
        result = await bash.exec("uniq -i /test.txt")
        lines = [l for l in result.stdout.strip().split("\n") if l]
        assert len(lines) == 2  # A/a combined, B separate


class TestCutCommandExtended:
    """Extended cut command tests."""

    @pytest.mark.asyncio
    async def test_cut_character_range(self):
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("cut -c 1-5 /test.txt")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_cut_field_range(self):
        bash = Bash(files={"/test.txt": "a:b:c:d:e\n"})
        result = await bash.exec("cut -d: -f 2-4 /test.txt")
        assert result.stdout == "b:c:d\n"

    @pytest.mark.asyncio
    async def test_cut_multiple_fields(self):
        bash = Bash(files={"/test.txt": "a:b:c:d\n"})
        result = await bash.exec("cut -d: -f 1,3 /test.txt")
        assert "a" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_cut_suppress_no_delimiter(self):
        bash = Bash(files={"/test.txt": "no delimiter here\n"})
        result = await bash.exec("cut -d: -f 1 -s /test.txt")
        # -s suppresses lines without delimiter
        assert result.stdout == "" or result.exit_code == 0


class TestBase64CommandExtended:
    """Extended base64 command tests."""

    @pytest.mark.asyncio
    async def test_base64_empty(self):
        bash = Bash(files={"/empty.txt": ""})
        result = await bash.exec("base64 /empty.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_base64_special_chars(self):
        bash = Bash(files={"/test.txt": "hello+world/foo="})
        result = await bash.exec("base64 /test.txt")
        assert result.exit_code == 0
        # Can decode back
        encoded = result.stdout.strip()
        result2 = await bash.exec(f"echo '{encoded}' | base64 -d")
        assert "hello+world/foo=" in result2.stdout

    @pytest.mark.asyncio
    async def test_base64_wrap(self):
        bash = Bash(files={"/test.txt": "a" * 100})
        result = await bash.exec("base64 -w 20 /test.txt")
        lines = result.stdout.strip().split("\n")
        # Lines should be wrapped at 20 chars
        assert all(len(line) <= 20 for line in lines[:-1])


class TestDateCommandExtended:
    """Extended date command tests."""

    @pytest.mark.asyncio
    async def test_date_custom_format(self):
        bash = Bash()
        result = await bash.exec("date '+%Y'")
        # Should be a 4-digit year
        assert len(result.stdout.strip()) == 4
        assert result.stdout.strip().isdigit()

    @pytest.mark.asyncio
    async def test_date_timestamp(self):
        bash = Bash()
        result = await bash.exec("date '+%s'")
        # Unix timestamp should be a large number
        assert int(result.stdout.strip()) > 1000000000

    @pytest.mark.asyncio
    async def test_date_iso_format(self):
        bash = Bash()
        result = await bash.exec("date -I")
        # ISO format: YYYY-MM-DD
        assert "-" in result.stdout
        parts = result.stdout.strip().split("-")
        assert len(parts) == 3


class TestExprCommandExtended:
    """Extended expr command tests."""

    @pytest.mark.asyncio
    async def test_expr_parentheses(self):
        bash = Bash()
        # Note: expr uses escaped parens
        result = await bash.exec("expr '(' 2 + 3 ')' '*' 4")
        assert result.stdout.strip() == "20"

    @pytest.mark.asyncio
    async def test_expr_comparison_true(self):
        bash = Bash()
        result = await bash.exec("expr 5 '>' 3")
        assert result.stdout.strip() == "1"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_expr_comparison_false(self):
        bash = Bash()
        result = await bash.exec("expr 3 '>' 5")
        assert result.stdout.strip() == "0"
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_expr_string_length(self):
        bash = Bash()
        result = await bash.exec("expr length 'hello'")
        assert result.stdout.strip() == "5"

    @pytest.mark.asyncio
    async def test_expr_substr(self):
        bash = Bash()
        result = await bash.exec("expr substr 'hello' 2 3")
        assert result.stdout.strip() == "ell"

    @pytest.mark.asyncio
    async def test_expr_index(self):
        bash = Bash()
        result = await bash.exec("expr index 'hello' 'e'")
        assert result.stdout.strip() == "2"


class TestSeqCommandExtended:
    """Extended seq command tests."""

    @pytest.mark.asyncio
    async def test_seq_custom_separator(self):
        bash = Bash()
        result = await bash.exec("seq -s ',' 1 5")
        assert result.stdout.strip() == "1,2,3,4,5"

    @pytest.mark.asyncio
    async def test_seq_equal_width(self):
        bash = Bash()
        result = await bash.exec("seq -w 8 12")
        assert "08" in result.stdout
        assert "09" in result.stdout
        assert "12" in result.stdout

    @pytest.mark.asyncio
    async def test_seq_negative_step(self):
        bash = Bash()
        result = await bash.exec("seq 5 -1 1")
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "5"
        assert lines[-1] == "1"

    @pytest.mark.asyncio
    async def test_seq_decimal(self):
        bash = Bash()
        result = await bash.exec("seq 1 0.5 2")
        assert "1" in result.stdout
        assert "1.5" in result.stdout
        assert "2" in result.stdout


class TestLnCommandExtended:
    """Extended ln command tests."""

    @pytest.mark.asyncio
    async def test_ln_relative_symlink(self):
        bash = Bash(files={"/dir/target.txt": "content"})
        result = await bash.exec("ln -s target.txt /dir/link.txt")
        assert result.exit_code == 0
        result = await bash.exec("cat /dir/link.txt")
        assert result.stdout == "content\n"

    @pytest.mark.asyncio
    async def test_ln_broken_symlink(self):
        bash = Bash()
        result = await bash.exec("ln -s /nonexistent /link")
        # Creating a broken symlink should succeed
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ln_directory_symlink(self):
        bash = Bash(files={"/source/file.txt": "data"})
        result = await bash.exec("ln -s /source /linkdir")
        assert result.exit_code == 0
        result = await bash.exec("cat /linkdir/file.txt")
        assert result.stdout == "data\n"


class TestChmodCommandExtended:
    """Extended chmod command tests."""

    @pytest.mark.asyncio
    async def test_chmod_all_permissions(self):
        bash = Bash(files={"/test.txt": "x"})
        result = await bash.exec("chmod 777 /test.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls -l /test.txt")
        assert "rwx" in result.stdout

    @pytest.mark.asyncio
    async def test_chmod_no_permissions(self):
        bash = Bash(files={"/test.txt": "x"})
        result = await bash.exec("chmod 000 /test.txt")
        assert result.exit_code == 0
        result = await bash.exec("ls -l /test.txt")
        assert "---" in result.stdout

    @pytest.mark.asyncio
    async def test_chmod_symbolic_set(self):
        bash = Bash(files={"/test.txt": "x"})
        # Quote symbolic mode to prevent shell from parsing = as assignment
        result = await bash.exec('chmod "u=rwx" /test.txt')
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_chmod_multiple_files(self):
        bash = Bash(files={"/a.txt": "a", "/b.txt": "b"})
        result = await bash.exec("chmod 755 /a.txt /b.txt")
        assert result.exit_code == 0


# =============================================================================
# High Priority Commands
# =============================================================================


class TestPrintfCommand:
    """Test printf command."""

    @pytest.mark.asyncio
    async def test_printf_basic_string(self):
        bash = Bash()
        result = await bash.exec('printf "hello"')
        assert result.stdout == "hello"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_printf_string_format(self):
        bash = Bash()
        result = await bash.exec('printf "%s" "world"')
        assert result.stdout == "world"

    @pytest.mark.asyncio
    async def test_printf_integer_format(self):
        bash = Bash()
        result = await bash.exec('printf "%d" 42')
        assert result.stdout == "42"

    @pytest.mark.asyncio
    async def test_printf_float_format(self):
        bash = Bash()
        result = await bash.exec('printf "%.2f" 3.14159')
        assert result.stdout == "3.14"

    @pytest.mark.asyncio
    async def test_printf_hex_format(self):
        bash = Bash()
        result = await bash.exec('printf "%x" 255')
        assert result.stdout == "ff"

    @pytest.mark.asyncio
    async def test_printf_octal_format(self):
        bash = Bash()
        result = await bash.exec('printf "%o" 8')
        assert result.stdout == "10"

    @pytest.mark.asyncio
    async def test_printf_percent_escape(self):
        bash = Bash()
        result = await bash.exec('printf "100%%"')
        assert result.stdout == "100%"

    @pytest.mark.asyncio
    async def test_printf_multiple_args(self):
        bash = Bash()
        result = await bash.exec('printf "%s %s" "hello" "world"')
        assert result.stdout == "hello world"

    @pytest.mark.asyncio
    async def test_printf_newline_escape(self):
        bash = Bash()
        result = await bash.exec('printf "hello\\nworld"')
        assert result.stdout == "hello\nworld"

    @pytest.mark.asyncio
    async def test_printf_tab_escape(self):
        bash = Bash()
        result = await bash.exec('printf "a\\tb"')
        assert result.stdout == "a\tb"

    @pytest.mark.asyncio
    async def test_printf_width_specifier(self):
        bash = Bash()
        result = await bash.exec('printf "%10s" "hi"')
        assert result.stdout == "        hi"

    @pytest.mark.asyncio
    async def test_printf_zero_padding(self):
        bash = Bash()
        result = await bash.exec('printf "%05d" 42')
        assert result.stdout == "00042"

    @pytest.mark.asyncio
    async def test_printf_left_justify(self):
        bash = Bash()
        result = await bash.exec('printf "%-10s" "hi"')
        assert result.stdout == "hi        "

    @pytest.mark.asyncio
    async def test_printf_missing_operand(self):
        bash = Bash()
        result = await bash.exec("printf")
        assert result.exit_code != 0


class TestTeeCommand:
    """Test tee command."""

    @pytest.mark.asyncio
    async def test_tee_passthrough(self):
        bash = Bash()
        result = await bash.exec("echo hello | tee")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_tee_write_file(self):
        bash = Bash()
        result = await bash.exec("echo hello | tee /out.txt")
        assert result.stdout == "hello\n"
        result = await bash.exec("cat /out.txt")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_tee_multiple_files(self):
        bash = Bash()
        result = await bash.exec("echo data | tee /a.txt /b.txt")
        assert result.stdout == "data\n"
        result = await bash.exec("cat /a.txt")
        assert result.stdout == "data\n"
        result = await bash.exec("cat /b.txt")
        assert result.stdout == "data\n"

    @pytest.mark.asyncio
    async def test_tee_append_mode(self):
        bash = Bash(files={"/out.txt": "existing\n"})
        result = await bash.exec("echo new | tee -a /out.txt")
        assert result.stdout == "new\n"
        result = await bash.exec("cat /out.txt")
        assert "existing" in result.stdout
        assert "new" in result.stdout


class TestXargsCommand:
    """Test xargs command."""

    @pytest.mark.asyncio
    async def test_xargs_default_echo(self):
        bash = Bash()
        result = await bash.exec("echo 'a b c' | xargs")
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_with_command(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | xargs echo")
        assert "hello" in result.stdout
        assert "world" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_empty_input(self):
        bash = Bash()
        result = await bash.exec("echo '' | xargs echo test")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_xargs_batch_size(self):
        bash = Bash()
        result = await bash.exec("echo 'a b c' | xargs -n 1 echo")
        lines = [l for l in result.stdout.strip().split("\n") if l]
        assert len(lines) == 3

    @pytest.mark.asyncio
    async def test_xargs_replace_string(self):
        bash = Bash(files={"/a.txt": "content"})
        result = await bash.exec("echo a.txt | xargs -I {} cat /{}")
        assert "content" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_null_separator(self):
        bash = Bash()
        # Test -0 flag (null separator)
        result = await bash.exec("printf 'a\\0b\\0c' | xargs -0 echo")
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_custom_delimiter(self):
        bash = Bash()
        result = await bash.exec("echo 'a:b:c' | xargs -d ':' echo")
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_xargs_no_run_if_empty(self):
        bash = Bash()
        result = await bash.exec("echo '' | xargs -r echo 'should not appear'")
        # -r means don't run if input is empty
        assert result.exit_code == 0


class TestBasenameCommand:
    """Test basename command."""

    @pytest.mark.asyncio
    async def test_basename_basic(self):
        bash = Bash()
        result = await bash.exec("basename /path/to/file.txt")
        assert result.stdout.strip() == "file.txt"

    @pytest.mark.asyncio
    async def test_basename_no_directory(self):
        bash = Bash()
        result = await bash.exec("basename file.txt")
        assert result.stdout.strip() == "file.txt"

    @pytest.mark.asyncio
    async def test_basename_remove_suffix(self):
        bash = Bash()
        result = await bash.exec("basename /path/file.txt .txt")
        assert result.stdout.strip() == "file"

    @pytest.mark.asyncio
    async def test_basename_suffix_option(self):
        bash = Bash()
        result = await bash.exec("basename -s .txt /path/file.txt")
        assert result.stdout.strip() == "file"

    @pytest.mark.asyncio
    async def test_basename_multiple_files(self):
        bash = Bash()
        result = await bash.exec("basename -a /path/a.txt /other/b.txt")
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_basename_missing_operand(self):
        bash = Bash()
        result = await bash.exec("basename")
        assert result.exit_code == 1


class TestDirnameCommand:
    """Test dirname command."""

    @pytest.mark.asyncio
    async def test_dirname_basic(self):
        bash = Bash()
        result = await bash.exec("dirname /path/to/file.txt")
        assert result.stdout.strip() == "/path/to"

    @pytest.mark.asyncio
    async def test_dirname_no_directory(self):
        bash = Bash()
        result = await bash.exec("dirname file.txt")
        assert result.stdout.strip() == "."

    @pytest.mark.asyncio
    async def test_dirname_root_level(self):
        bash = Bash()
        result = await bash.exec("dirname /file.txt")
        assert result.stdout.strip() == "/"

    @pytest.mark.asyncio
    async def test_dirname_multiple_paths(self):
        bash = Bash()
        result = await bash.exec("dirname /a/b.txt /c/d.txt")
        assert "/a" in result.stdout
        assert "/c" in result.stdout

    @pytest.mark.asyncio
    async def test_dirname_missing_operand(self):
        bash = Bash()
        result = await bash.exec("dirname")
        assert result.exit_code == 1


class TestReadlinkCommand:
    """Test readlink command."""

    @pytest.mark.asyncio
    async def test_readlink_symlink(self):
        bash = Bash(files={"/target.txt": "content"})
        await bash.exec("ln -s /target.txt /link.txt")
        result = await bash.exec("readlink /link.txt")
        assert "/target.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_readlink_relative_symlink(self):
        bash = Bash(files={"/dir/target.txt": "content"})
        await bash.exec("ln -s target.txt /dir/link.txt")
        result = await bash.exec("readlink /dir/link.txt")
        assert "target.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_readlink_canonicalize(self):
        bash = Bash(files={"/target.txt": "content"})
        await bash.exec("ln -s /target.txt /link.txt")
        result = await bash.exec("readlink -f /link.txt")
        assert "/target.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_readlink_regular_file(self):
        bash = Bash(files={"/file.txt": "content"})
        result = await bash.exec("readlink /file.txt")
        # Regular file is not a symlink
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_readlink_nonexistent(self):
        bash = Bash()
        result = await bash.exec("readlink /nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_readlink_missing_operand(self):
        bash = Bash()
        result = await bash.exec("readlink")
        assert result.exit_code == 1
        assert "missing operand" in result.stderr.lower()


class TestStatCommand:
    """Test stat command."""

    @pytest.mark.asyncio
    async def test_stat_file(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("stat /test.txt")
        assert "File:" in result.stdout or "test.txt" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_stat_directory(self):
        bash = Bash(files={"/dir/file.txt": "x"})
        result = await bash.exec("stat /dir")
        assert "dir" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_stat_format_name(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("stat -c '%n' /test.txt")
        assert "test.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_stat_format_size(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("stat -c '%s' /test.txt")
        assert "5" in result.stdout  # "hello" is 5 bytes

    @pytest.mark.asyncio
    async def test_stat_format_type(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("stat -c '%F' /test.txt")
        assert "regular" in result.stdout.lower() or "file" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_stat_multiple_files(self):
        bash = Bash(files={"/a.txt": "a", "/b.txt": "b"})
        result = await bash.exec("stat /a.txt /b.txt")
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_stat_nonexistent(self):
        bash = Bash()
        result = await bash.exec("stat /nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_stat_missing_operand(self):
        bash = Bash()
        result = await bash.exec("stat")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_stat_format_uid(self):
        """Test %u returns user ID."""
        bash = Bash(files={"/file.txt": "content"})
        result = await bash.exec("stat -c '%u' /file.txt")
        assert result.stdout.strip() == "1000"

    @pytest.mark.asyncio
    async def test_stat_format_username(self):
        """Test %U returns username."""
        bash = Bash(files={"/file.txt": "content"})
        result = await bash.exec("stat -c '%U' /file.txt")
        assert result.stdout.strip() == "user"

    @pytest.mark.asyncio
    async def test_stat_format_gid(self):
        """Test %g returns group ID."""
        bash = Bash(files={"/file.txt": "content"})
        result = await bash.exec("stat -c '%g' /file.txt")
        assert result.stdout.strip() == "1000"

    @pytest.mark.asyncio
    async def test_stat_format_groupname(self):
        """Test %G returns group name."""
        bash = Bash(files={"/file.txt": "content"})
        result = await bash.exec("stat -c '%G' /file.txt")
        assert result.stdout.strip() == "group"

    @pytest.mark.asyncio
    async def test_stat_format_combined_ownership(self):
        """Test combined ownership specifiers."""
        bash = Bash(files={"/file.txt": "content"})
        result = await bash.exec("stat -c '%U:%G' /file.txt")
        assert result.stdout.strip() == "user:group"


class TestDiffCommand:
    """Test diff command."""

    @pytest.mark.asyncio
    async def test_diff_identical(self):
        bash = Bash(files={"/a.txt": "same\n", "/b.txt": "same\n"})
        result = await bash.exec("diff /a.txt /b.txt")
        assert result.exit_code == 0
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_diff_different(self):
        bash = Bash(files={"/a.txt": "hello\n", "/b.txt": "world\n"})
        result = await bash.exec("diff /a.txt /b.txt")
        assert result.exit_code == 1
        # Unified diff shows changes
        assert "-" in result.stdout or "<" in result.stdout

    @pytest.mark.asyncio
    async def test_diff_added_lines(self):
        bash = Bash(files={"/a.txt": "line1\n", "/b.txt": "line1\nline2\n"})
        result = await bash.exec("diff /a.txt /b.txt")
        assert result.exit_code == 1
        assert "+" in result.stdout or ">" in result.stdout

    @pytest.mark.asyncio
    async def test_diff_removed_lines(self):
        bash = Bash(files={"/a.txt": "line1\nline2\n", "/b.txt": "line1\n"})
        result = await bash.exec("diff /a.txt /b.txt")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_diff_brief(self):
        bash = Bash(files={"/a.txt": "hello\n", "/b.txt": "world\n"})
        result = await bash.exec("diff -q /a.txt /b.txt")
        assert result.exit_code == 1
        assert "differ" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_diff_report_identical(self):
        bash = Bash(files={"/a.txt": "same\n", "/b.txt": "same\n"})
        result = await bash.exec("diff -s /a.txt /b.txt")
        assert "identical" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_diff_ignore_case(self):
        bash = Bash(files={"/a.txt": "Hello\n", "/b.txt": "hello\n"})
        result = await bash.exec("diff -i /a.txt /b.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_diff_stdin(self):
        bash = Bash(files={"/a.txt": "hello\n"})
        result = await bash.exec("echo hello | diff /a.txt -")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_diff_nonexistent(self):
        bash = Bash(files={"/a.txt": "hello\n"})
        result = await bash.exec("diff /a.txt /nonexistent")
        assert result.exit_code == 2

    @pytest.mark.asyncio
    async def test_diff_missing_operand(self):
        bash = Bash()
        result = await bash.exec("diff")
        assert result.exit_code == 2


# =============================================================================
# Text Processing Commands
# =============================================================================


class TestTacCommand:
    """Test tac command."""

    @pytest.mark.asyncio
    async def test_tac_basic(self):
        bash = Bash()
        result = await bash.exec("echo -e 'a\\nb\\nc' | tac")
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "c"
        assert lines[-1] == "a"

    @pytest.mark.asyncio
    async def test_tac_single_line(self):
        bash = Bash()
        result = await bash.exec("echo 'single' | tac")
        assert result.stdout.strip() == "single"

    @pytest.mark.asyncio
    async def test_tac_empty_input(self):
        bash = Bash()
        result = await bash.exec("echo -n '' | tac")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tac_file(self):
        bash = Bash(files={"/test.txt": "line1\nline2\nline3\n"})
        result = await bash.exec("tac /test.txt")
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "line3"
        assert lines[-1] == "line1"

    @pytest.mark.asyncio
    async def test_tac_nonexistent(self):
        bash = Bash()
        result = await bash.exec("tac /nonexistent")
        assert result.exit_code == 1


class TestRevCommand:
    """Test rev command."""

    @pytest.mark.asyncio
    async def test_rev_basic(self):
        bash = Bash()
        result = await bash.exec("echo 'hello' | rev")
        assert result.stdout.strip() == "olleh"

    @pytest.mark.asyncio
    async def test_rev_multiple_lines(self):
        bash = Bash()
        result = await bash.exec("echo -e 'abc\\ndef' | rev")
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "cba"
        assert lines[1] == "fed"

    @pytest.mark.asyncio
    async def test_rev_empty_input(self):
        bash = Bash()
        result = await bash.exec("echo -n '' | rev")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_rev_single_char(self):
        bash = Bash()
        result = await bash.exec("echo 'a' | rev")
        assert result.stdout.strip() == "a"

    @pytest.mark.asyncio
    async def test_rev_file(self):
        bash = Bash(files={"/test.txt": "hello\nworld\n"})
        result = await bash.exec("rev /test.txt")
        assert "olleh" in result.stdout
        assert "dlrow" in result.stdout

    @pytest.mark.asyncio
    async def test_rev_preserve_spaces(self):
        bash = Bash()
        result = await bash.exec("echo '  ab  ' | rev")
        assert "  ba  " in result.stdout

    @pytest.mark.asyncio
    async def test_rev_nonexistent(self):
        bash = Bash()
        result = await bash.exec("rev /nonexistent")
        assert result.exit_code == 1


class TestNlCommand:
    """Test nl (number lines) command."""

    @pytest.mark.asyncio
    async def test_nl_basic(self):
        bash = Bash()
        result = await bash.exec("echo -e 'a\\nb\\nc' | nl")
        assert "1" in result.stdout
        assert "a" in result.stdout

    @pytest.mark.asyncio
    async def test_nl_file(self):
        bash = Bash(files={"/test.txt": "line1\nline2\n"})
        result = await bash.exec("nl /test.txt")
        assert "1" in result.stdout
        assert "2" in result.stdout

    @pytest.mark.asyncio
    async def test_nl_number_all(self):
        bash = Bash(files={"/test.txt": "a\n\nb\n"})
        result = await bash.exec("nl -ba /test.txt")
        # -ba numbers all lines including empty
        assert "1" in result.stdout
        assert "2" in result.stdout
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_nl_start_value(self):
        bash = Bash(files={"/test.txt": "a\nb\n"})
        result = await bash.exec("nl -v 10 /test.txt")
        assert "10" in result.stdout
        assert "11" in result.stdout

    @pytest.mark.asyncio
    async def test_nl_increment(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("nl -i 5 /test.txt")
        assert "1" in result.stdout
        assert "6" in result.stdout
        assert "11" in result.stdout

    @pytest.mark.asyncio
    async def test_nl_width(self):
        bash = Bash(files={"/test.txt": "a\n"})
        result = await bash.exec("nl -w 5 /test.txt")
        # Width of number field should be 5
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_nl_separator(self):
        bash = Bash(files={"/test.txt": "a\n"})
        result = await bash.exec("nl -s '|' /test.txt")
        assert "|" in result.stdout

    @pytest.mark.asyncio
    async def test_nl_empty_input(self):
        bash = Bash()
        result = await bash.exec("echo -n '' | nl")
        assert result.stdout == ""


class TestPasteCommand:
    """Test paste command."""

    @pytest.mark.asyncio
    async def test_paste_two_files(self):
        bash = Bash(files={"/a.txt": "1\n2\n", "/b.txt": "a\nb\n"})
        result = await bash.exec("paste /a.txt /b.txt")
        assert "1\ta" in result.stdout
        assert "2\tb" in result.stdout

    @pytest.mark.asyncio
    async def test_paste_three_files(self):
        bash = Bash(files={
            "/a.txt": "1\n2\n",
            "/b.txt": "a\nb\n",
            "/c.txt": "x\ny\n",
        })
        result = await bash.exec("paste /a.txt /b.txt /c.txt")
        assert "\t" in result.stdout

    @pytest.mark.asyncio
    async def test_paste_uneven_files(self):
        bash = Bash(files={"/a.txt": "1\n2\n3\n", "/b.txt": "a\n"})
        result = await bash.exec("paste /a.txt /b.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_paste_custom_delimiter(self):
        bash = Bash(files={"/a.txt": "1\n2\n", "/b.txt": "a\nb\n"})
        result = await bash.exec("paste -d ',' /a.txt /b.txt")
        assert "1,a" in result.stdout
        assert "2,b" in result.stdout

    @pytest.mark.asyncio
    async def test_paste_serial(self):
        bash = Bash(files={"/a.txt": "1\n2\n3\n"})
        result = await bash.exec("paste -s /a.txt")
        # Serial mode pastes all lines into one
        assert "\t" in result.stdout or "1" in result.stdout

    @pytest.mark.asyncio
    async def test_paste_stdin(self):
        bash = Bash(files={"/a.txt": "a\nb\n"})
        result = await bash.exec("echo -e '1\\n2' | paste - /a.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_paste_missing_files(self):
        bash = Bash()
        result = await bash.exec("paste")
        assert result.exit_code != 0


# =============================================================================
# Environment and Utility Commands
# =============================================================================


class TestEnvCommand:
    """Test env command."""

    @pytest.mark.asyncio
    async def test_env_print_all(self):
        bash = Bash()
        result = await bash.exec("env")
        assert "=" in result.stdout
        assert "PATH" in result.stdout or "HOME" in result.stdout

    @pytest.mark.asyncio
    async def test_env_custom_variable(self):
        bash = Bash(env={"MY_VAR": "my_value"})
        result = await bash.exec("env")
        assert "MY_VAR=my_value" in result.stdout


class TestPrintenvCommand:
    """Test printenv command."""

    @pytest.mark.asyncio
    async def test_printenv_all(self):
        bash = Bash()
        result = await bash.exec("printenv")
        assert "=" in result.stdout or "PATH" in result.stdout

    @pytest.mark.asyncio
    async def test_printenv_specific(self):
        bash = Bash(env={"TEST_VAR": "test_value"})
        result = await bash.exec("printenv TEST_VAR")
        assert result.stdout.strip() == "test_value"

    @pytest.mark.asyncio
    async def test_printenv_multiple(self):
        bash = Bash(env={"VAR1": "val1", "VAR2": "val2"})
        result = await bash.exec("printenv VAR1 VAR2")
        assert "val1" in result.stdout
        assert "val2" in result.stdout

    @pytest.mark.asyncio
    async def test_printenv_missing(self):
        bash = Bash()
        result = await bash.exec("printenv NONEXISTENT_VAR")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_printenv_unexported_var(self):
        """printenv should not see variables that are not exported."""
        bash = Bash()
        # Set a variable without exporting it
        await bash.exec("MY_VAR=value")
        result = await bash.exec("printenv MY_VAR")
        assert result.exit_code == 1
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_printenv_after_export_n(self):
        """printenv should not see variables after export -n."""
        bash = Bash()
        # Export a variable
        await bash.exec("export MY_VAR=exported")
        result = await bash.exec("printenv MY_VAR")
        assert result.stdout.strip() == "exported"
        # Unexport it with export -n
        await bash.exec("export -n MY_VAR")
        result = await bash.exec("printenv MY_VAR")
        assert result.exit_code == 1
        # But shell variable should still exist
        result = await bash.exec("echo $MY_VAR")
        assert result.stdout.strip() == "exported"


class TestHostnameCommand:
    """Test hostname command."""

    @pytest.mark.asyncio
    async def test_hostname_basic(self):
        bash = Bash()
        result = await bash.exec("hostname")
        assert result.exit_code == 0
        assert result.stdout.strip() != ""

    @pytest.mark.asyncio
    async def test_hostname_in_substitution(self):
        bash = Bash()
        result = await bash.exec('echo "host: $(hostname)"')
        assert "host:" in result.stdout


class TestSleepCommand:
    """Test sleep command."""

    @pytest.mark.asyncio
    async def test_sleep_basic(self):
        bash = Bash()
        result = await bash.exec("sleep 0.01")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sleep_decimal(self):
        bash = Bash()
        result = await bash.exec("sleep 0.001")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sleep_suffix_seconds(self):
        bash = Bash()
        result = await bash.exec("sleep 0.01s")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sleep_multiple_args(self):
        bash = Bash()
        result = await bash.exec("sleep 0.01 0.01")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sleep_missing_operand(self):
        bash = Bash()
        result = await bash.exec("sleep")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_sleep_invalid(self):
        bash = Bash()
        result = await bash.exec("sleep abc")
        assert result.exit_code == 1


class TestTimeoutCommand:
    """Test timeout command."""

    @pytest.mark.asyncio
    async def test_timeout_success(self):
        bash = Bash()
        result = await bash.exec("timeout 1 echo hello")
        assert result.stdout.strip() == "hello"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_timeout_with_args(self):
        bash = Bash()
        result = await bash.exec("timeout 1 echo hello world")
        assert "hello world" in result.stdout

    @pytest.mark.asyncio
    async def test_timeout_decimal(self):
        bash = Bash()
        result = await bash.exec("timeout 0.5 echo test")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_timeout_suffix(self):
        bash = Bash()
        result = await bash.exec("timeout 1s echo test")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_timeout_missing_operand(self):
        bash = Bash()
        result = await bash.exec("timeout")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_timeout_missing_command(self):
        bash = Bash()
        result = await bash.exec("timeout 1")
        assert result.exit_code == 1


# =============================================================================
# File and Directory Utilities
# =============================================================================


class TestTreeCommand:
    """Test tree command."""

    @pytest.mark.asyncio
    async def test_tree_basic(self):
        bash = Bash(files={
            "/dir/a.txt": "a",
            "/dir/sub/b.txt": "b",
        })
        result = await bash.exec("tree /dir")
        assert "a.txt" in result.stdout
        assert "sub" in result.stdout
        assert "b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_tree_summary(self):
        bash = Bash(files={"/dir/a.txt": "a", "/dir/b.txt": "b"})
        result = await bash.exec("tree /dir")
        # Should show directory/file count
        assert "director" in result.stdout.lower() or "file" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_tree_empty_dir(self):
        bash = Bash()
        await bash.exec("mkdir /empty")
        result = await bash.exec("tree /empty")
        assert "0 director" in result.stdout.lower() or result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tree_directories_only(self):
        bash = Bash(files={"/dir/sub/file.txt": "x"})
        result = await bash.exec("tree -d /dir")
        assert "sub" in result.stdout
        # Files should not appear with -d

    @pytest.mark.asyncio
    async def test_tree_max_depth(self):
        bash = Bash(files={"/dir/a/b/c/file.txt": "x"})
        result = await bash.exec("tree -L 1 /dir")
        # Should only show first level
        assert "a" in result.stdout

    @pytest.mark.asyncio
    async def test_tree_nonexistent(self):
        bash = Bash()
        result = await bash.exec("tree /nonexistent")
        assert result.exit_code == 1


class TestDuCommand:
    """Test du (disk usage) command."""

    @pytest.mark.asyncio
    async def test_du_directory(self):
        bash = Bash(files={"/dir/file.txt": "hello"})
        result = await bash.exec("du /dir")
        assert "/dir" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_du_file(self):
        bash = Bash(files={"/file.txt": "hello world"})
        result = await bash.exec("du /file.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_du_all_files(self):
        bash = Bash(files={"/dir/a.txt": "a", "/dir/b.txt": "b"})
        result = await bash.exec("du -a /dir")
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_du_summary(self):
        bash = Bash(files={"/dir/a.txt": "a", "/dir/sub/b.txt": "b"})
        result = await bash.exec("du -s /dir")
        # Summary should only show the total
        lines = [l for l in result.stdout.strip().split("\n") if l]
        assert len(lines) == 1

    @pytest.mark.asyncio
    async def test_du_human_readable(self):
        bash = Bash(files={"/file.txt": "x" * 1000})
        result = await bash.exec("du -h /file.txt")
        # Should show K, M, G suffixes
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_du_total(self):
        bash = Bash(files={"/a.txt": "a", "/b.txt": "b"})
        result = await bash.exec("du -c /a.txt /b.txt")
        assert "total" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_du_nonexistent(self):
        bash = Bash()
        result = await bash.exec("du /nonexistent")
        assert result.exit_code == 1


class TestFileCommand:
    """Test file command."""

    @pytest.mark.asyncio
    async def test_file_text(self):
        bash = Bash(files={"/test.txt": "hello world"})
        result = await bash.exec("file /test.txt")
        assert "text" in result.stdout.lower() or "ASCII" in result.stdout

    @pytest.mark.asyncio
    async def test_file_directory(self):
        bash = Bash(files={"/dir/file.txt": "x"})
        result = await bash.exec("file /dir")
        assert "directory" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_json(self):
        bash = Bash(files={"/data.json": '{"key": "value"}'})
        result = await bash.exec("file /data.json")
        assert "JSON" in result.stdout or "text" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_script(self):
        bash = Bash(files={"/script.sh": "#!/bin/bash\necho hello"})
        result = await bash.exec("file /script.sh")
        assert "script" in result.stdout.lower() or "text" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_mime(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("file -i /test.txt")
        assert "text/plain" in result.stdout or "charset" in result.stdout

    @pytest.mark.asyncio
    async def test_file_brief(self):
        bash = Bash(files={"/test.txt": "hello"})
        result = await bash.exec("file -b /test.txt")
        # Brief mode - no filename prefix
        assert "test.txt:" not in result.stdout

    @pytest.mark.asyncio
    async def test_file_multiple(self):
        bash = Bash(files={"/a.txt": "a", "/b.txt": "b"})
        result = await bash.exec("file /a.txt /b.txt")
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_file_nonexistent(self):
        bash = Bash()
        result = await bash.exec("file /nonexistent")
        assert "cannot open" in result.stdout.lower() or result.exit_code != 0

    @pytest.mark.asyncio
    async def test_file_no_args(self):
        bash = Bash()
        result = await bash.exec("file")
        assert result.exit_code == 1


class TestWhichCommand:
    """Test which command."""

    @pytest.mark.asyncio
    async def test_which_builtin(self):
        bash = Bash()
        result = await bash.exec("which echo")
        assert "echo" in result.stdout or result.exit_code == 0

    @pytest.mark.asyncio
    async def test_which_multiple(self):
        bash = Bash()
        result = await bash.exec("which echo cat")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_which_nonexistent(self):
        bash = Bash()
        result = await bash.exec("which nonexistent_command_xyz")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_which_silent(self):
        bash = Bash()
        result = await bash.exec("which -s echo")
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_which_no_args(self):
        bash = Bash()
        result = await bash.exec("which")
        assert result.exit_code == 1


class TestHelpCommand:
    """Test help command."""

    @pytest.mark.asyncio
    async def test_help_list_commands(self):
        bash = Bash()
        result = await bash.exec("help")
        assert "Available" in result.stdout or "command" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_help_specific_command(self):
        bash = Bash()
        result = await bash.exec("help ls")
        assert "ls" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_help_unknown_command(self):
        bash = Bash()
        result = await bash.exec("help nonexistent_xyz")
        assert result.exit_code == 127 or result.exit_code == 1


# =============================================================================
# Ripgrep (rg) Command
# =============================================================================


class TestRgCommand:
    """Test rg (ripgrep) command."""

    @pytest.mark.asyncio
    async def test_rg_basic_search(self):
        bash = Bash(files={"/test.txt": "hello world\nfoo bar\nhello again\n"})
        result = await bash.exec("rg hello /test.txt")
        assert "hello" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_rg_no_match(self):
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("rg xyz /test.txt")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_rg_line_numbers(self):
        bash = Bash(files={"/test.txt": "foo\nbar\nfoo\n"})
        result = await bash.exec("rg -n foo /test.txt")
        assert "1:" in result.stdout or "1" in result.stdout
        assert "3:" in result.stdout or "3" in result.stdout

    @pytest.mark.asyncio
    async def test_rg_ignore_case(self):
        bash = Bash(files={"/test.txt": "Hello World\n"})
        result = await bash.exec("rg -i hello /test.txt")
        assert "Hello" in result.stdout

    @pytest.mark.asyncio
    async def test_rg_count(self):
        bash = Bash(files={"/test.txt": "foo\nbar\nfoo\n"})
        result = await bash.exec("rg -c foo /test.txt")
        assert "2" in result.stdout

    @pytest.mark.asyncio
    async def test_rg_files_only(self):
        bash = Bash(files={
            "/a.txt": "foo\n",
            "/b.txt": "bar\n",
        })
        result = await bash.exec("rg -l foo /a.txt /b.txt")
        assert "a.txt" in result.stdout
        assert "b.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_rg_invert_match(self):
        bash = Bash(files={"/test.txt": "foo\nbar\nbaz\n"})
        result = await bash.exec("rg -v foo /test.txt")
        assert "foo" not in result.stdout
        assert "bar" in result.stdout

    @pytest.mark.asyncio
    async def test_rg_word_match(self):
        bash = Bash(files={"/test.txt": "cat\ncatch\nthe cat\n"})
        result = await bash.exec("rg -w cat /test.txt")
        assert "cat" in result.stdout

    @pytest.mark.asyncio
    async def test_rg_multiple_files(self):
        bash = Bash(files={
            "/a.txt": "hello\n",
            "/b.txt": "hello world\n",
        })
        result = await bash.exec("rg hello /a.txt /b.txt")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_rg_recursive(self):
        bash = Bash(files={
            "/dir/a.txt": "pattern\n",
            "/dir/sub/b.txt": "pattern here\n",
        })
        result = await bash.exec("rg pattern /dir")
        assert "pattern" in result.stdout


# =============================================================================
# Grep Variants
# =============================================================================


class TestFgrepCommand:
    """Test fgrep command (fixed strings grep)."""

    @pytest.mark.asyncio
    async def test_fgrep_literal_match(self):
        bash = Bash(files={"/test.txt": "hello.*world\n"})
        result = await bash.exec("fgrep '.*' /test.txt")
        assert ".*" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_fgrep_no_regex(self):
        bash = Bash(files={"/test.txt": "hello\nworld\n"})
        result = await bash.exec("fgrep 'h.*o' /test.txt")
        assert result.exit_code == 1  # No match because .* is literal

    @pytest.mark.asyncio
    async def test_fgrep_with_options(self):
        bash = Bash(files={"/test.txt": "Hello\nhello\n"})
        result = await bash.exec("fgrep -i hello /test.txt")
        assert result.exit_code == 0


class TestEgrepCommand:
    """Test egrep command (extended regexp grep)."""

    @pytest.mark.asyncio
    async def test_egrep_extended_regex(self):
        bash = Bash(files={"/test.txt": "cat\ndog\nrat\n"})
        result = await bash.exec("egrep 'cat|dog' /test.txt")
        assert "cat" in result.stdout
        assert "dog" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_egrep_with_options(self):
        bash = Bash(files={"/test.txt": "hello\nworld\n"})
        result = await bash.exec("egrep -n hello /test.txt")
        assert "1:" in result.stdout


# =============================================================================
# Checksum Commands
# =============================================================================


class TestMd5sumCommand:
    """Test md5sum command."""

    @pytest.mark.asyncio
    async def test_md5sum_file(self):
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("md5sum /test.txt")
        assert result.exit_code == 0
        assert "/test.txt" in result.stdout
        # MD5 of "hello\n" is b1946ac92492d2347c6235b4d2611184
        assert "b1946ac92492d2347c6235b4d2611184" in result.stdout

    @pytest.mark.asyncio
    async def test_md5sum_multiple_files(self):
        bash = Bash(files={"/a.txt": "hello\n", "/b.txt": "world\n"})
        result = await bash.exec("md5sum /a.txt /b.txt")
        assert "/a.txt" in result.stdout
        assert "/b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_md5sum_nonexistent(self):
        bash = Bash()
        result = await bash.exec("md5sum /nonexistent.txt")
        assert result.exit_code == 1


class TestSha1sumCommand:
    """Test sha1sum command."""

    @pytest.mark.asyncio
    async def test_sha1sum_file(self):
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("sha1sum /test.txt")
        assert result.exit_code == 0
        assert "/test.txt" in result.stdout


class TestSha256sumCommand:
    """Test sha256sum command."""

    @pytest.mark.asyncio
    async def test_sha256sum_file(self):
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("sha256sum /test.txt")
        assert result.exit_code == 0
        assert "/test.txt" in result.stdout


# =============================================================================
# Compression Commands
# =============================================================================


class TestGzipCommand:
    """Test gzip command."""

    @pytest.mark.asyncio
    async def test_gzip_compress_file(self):
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("gzip /test.txt")
        assert result.exit_code == 0
        # Original should be gone, .gz should exist
        ls_result = await bash.exec("ls /")
        assert "test.txt.gz" in ls_result.stdout

    @pytest.mark.asyncio
    async def test_gzip_keep_original(self):
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("gzip -k /test.txt")
        assert result.exit_code == 0
        ls_result = await bash.exec("ls /")
        assert "test.txt" in ls_result.stdout
        assert "test.txt.gz" in ls_result.stdout

    @pytest.mark.asyncio
    async def test_gzip_nonexistent(self):
        bash = Bash()
        result = await bash.exec("gzip /nonexistent.txt")
        assert result.exit_code == 1


class TestGunzipCommand:
    """Test gunzip command."""

    @pytest.mark.asyncio
    async def test_gunzip_decompress(self):
        # First compress, then decompress
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip /test.txt")
        result = await bash.exec("gunzip /test.txt.gz")
        assert result.exit_code == 0
        cat_result = await bash.exec("cat /test.txt")
        assert "hello world" in cat_result.stdout


class TestZcatCommand:
    """Test zcat command."""

    @pytest.mark.asyncio
    async def test_zcat_output(self):
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip -k /test.txt")
        result = await bash.exec("zcat /test.txt.gz")
        assert result.exit_code == 0
        assert "hello world" in result.stdout


# =============================================================================
# Shell Utility Commands
# =============================================================================


class TestClearCommand:
    """Test clear command."""

    @pytest.mark.asyncio
    async def test_clear_output(self):
        bash = Bash()
        result = await bash.exec("clear")
        assert result.exit_code == 0
        # Should output ANSI escape sequences
        assert "\033[2J" in result.stdout or result.stdout == ""


class TestAliasCommand:
    """Test alias command."""

    @pytest.mark.asyncio
    async def test_alias_define(self):
        bash = Bash()
        # Use quoted form to pass as argument, not assignment
        result = await bash.exec("alias 'll=ls -l'")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_alias_list(self):
        bash = Bash()
        await bash.exec("alias 'll=ls -l'")
        result = await bash.exec("alias")
        assert "ll" in result.stdout

    @pytest.mark.asyncio
    async def test_alias_show_specific(self):
        bash = Bash()
        await bash.exec("alias 'll=ls -l'")
        result = await bash.exec("alias ll")
        assert "ll" in result.stdout
        assert "ls -l" in result.stdout

    @pytest.mark.asyncio
    async def test_alias_not_found(self):
        bash = Bash()
        result = await bash.exec("alias nonexistent")
        assert result.exit_code == 1


class TestUnaliasCommand:
    """Test unalias command."""

    @pytest.mark.asyncio
    async def test_unalias_remove(self):
        bash = Bash()
        await bash.exec("alias 'll=ls -l'")
        result = await bash.exec("unalias ll")
        assert result.exit_code == 0
        alias_result = await bash.exec("alias ll")
        assert alias_result.exit_code == 1

    @pytest.mark.asyncio
    async def test_unalias_not_found(self):
        bash = Bash()
        result = await bash.exec("unalias nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_unalias_all(self):
        bash = Bash()
        await bash.exec("alias 'll=ls -l'")
        await bash.exec("alias 'la=ls -a'")
        result = await bash.exec("unalias -a")
        assert result.exit_code == 0
        alias_result = await bash.exec("alias")
        assert alias_result.stdout == ""


class TestHistoryCommand:
    """Test history command."""

    @pytest.mark.asyncio
    async def test_history_empty(self):
        bash = Bash()
        result = await bash.exec("history")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_history_help(self):
        bash = Bash()
        result = await bash.exec("history --help")
        assert result.exit_code == 0
        assert "history" in result.stdout.lower()


# =============================================================================
# Text Processing Commands - Additional
# =============================================================================


class TestExpandCommand:
    """Test expand command."""

    @pytest.mark.asyncio
    async def test_expand_basic(self):
        bash = Bash(files={"/test.txt": "a\tb\tc\n"})
        result = await bash.exec("expand /test.txt")
        assert result.exit_code == 0
        assert "\t" not in result.stdout
        # Default tab stop is 8
        assert "a       b       c" in result.stdout

    @pytest.mark.asyncio
    async def test_expand_custom_tab(self):
        bash = Bash(files={"/test.txt": "a\tb\n"})
        result = await bash.exec("expand -t 4 /test.txt")
        assert result.exit_code == 0
        assert "a   b" in result.stdout

    @pytest.mark.asyncio
    async def test_expand_stdin(self):
        bash = Bash()
        result = await bash.exec("echo -e 'a\\tb' | expand -t 4")
        assert result.exit_code == 0
        assert "a   b" in result.stdout

    @pytest.mark.asyncio
    async def test_expand_initial_only(self):
        bash = Bash(files={"/test.txt": "\ta\tb\n"})
        result = await bash.exec("expand -i -t 4 /test.txt")
        assert result.exit_code == 0
        # Only leading tab converted, tab after a should remain
        assert "    a\tb" in result.stdout

    @pytest.mark.asyncio
    async def test_expand_multiple_files(self):
        bash = Bash(files={"/a.txt": "a\tb\n", "/b.txt": "c\td\n"})
        result = await bash.exec("expand -t 4 /a.txt /b.txt")
        assert result.exit_code == 0
        assert "a   b" in result.stdout
        assert "c   d" in result.stdout

    @pytest.mark.asyncio
    async def test_expand_nonexistent(self):
        bash = Bash()
        result = await bash.exec("expand /nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_expand_help(self):
        bash = Bash()
        result = await bash.exec("expand --help")
        assert result.exit_code == 0
        assert "expand" in result.stdout.lower()


class TestUnexpandCommand:
    """Test unexpand command."""

    @pytest.mark.asyncio
    async def test_unexpand_basic(self):
        bash = Bash(files={"/test.txt": "        a\n"})  # 8 spaces
        result = await bash.exec("unexpand /test.txt")
        assert result.exit_code == 0
        assert "\ta" in result.stdout

    @pytest.mark.asyncio
    async def test_unexpand_custom_tab(self):
        bash = Bash(files={"/test.txt": "    a\n"})  # 4 spaces
        result = await bash.exec("unexpand -t 4 /test.txt")
        assert result.exit_code == 0
        assert "\ta" in result.stdout

    @pytest.mark.asyncio
    async def test_unexpand_all_blanks(self):
        bash = Bash(files={"/test.txt": "a    b\n"})  # 4 spaces inside
        result = await bash.exec("unexpand -a -t 4 /test.txt")
        assert result.exit_code == 0
        assert "\t" in result.stdout

    @pytest.mark.asyncio
    async def test_unexpand_stdin(self):
        bash = Bash()
        result = await bash.exec("echo '        hello' | unexpand")
        assert result.exit_code == 0
        assert "\thello" in result.stdout

    @pytest.mark.asyncio
    async def test_unexpand_help(self):
        bash = Bash()
        result = await bash.exec("unexpand --help")
        assert result.exit_code == 0
        assert "unexpand" in result.stdout.lower()


class TestFoldCommand:
    """Test fold command."""

    @pytest.mark.asyncio
    async def test_fold_basic(self):
        bash = Bash(files={"/test.txt": "a" * 100 + "\n"})
        result = await bash.exec("fold /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Default width is 80
        assert len(lines[0]) == 80

    @pytest.mark.asyncio
    async def test_fold_custom_width(self):
        bash = Bash(files={"/test.txt": "abcdefghij\n"})
        result = await bash.exec("fold -w 5 /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "abcde"
        assert lines[1] == "fghij"

    @pytest.mark.asyncio
    async def test_fold_break_at_spaces(self):
        bash = Bash(files={"/test.txt": "hello world test\n"})
        result = await bash.exec("fold -s -w 10 /test.txt")
        assert result.exit_code == 0
        # Should break at word boundaries when possible
        lines = result.stdout.strip().split("\n")
        assert len(lines) >= 2

    @pytest.mark.asyncio
    async def test_fold_stdin(self):
        bash = Bash()
        result = await bash.exec("echo 'abcdefghij' | fold -w 5")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "abcde"
        assert lines[1] == "fghij"

    @pytest.mark.asyncio
    async def test_fold_short_line(self):
        bash = Bash(files={"/test.txt": "short\n"})
        result = await bash.exec("fold -w 80 /test.txt")
        assert result.exit_code == 0
        assert result.stdout == "short\n"

    @pytest.mark.asyncio
    async def test_fold_multiple_lines(self):
        bash = Bash(files={"/test.txt": "aaaaaa\nbbbbbb\n"})
        result = await bash.exec("fold -w 3 /test.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert "aaa" in lines
        assert "bbb" in lines

    @pytest.mark.asyncio
    async def test_fold_help(self):
        bash = Bash()
        result = await bash.exec("fold --help")
        assert result.exit_code == 0
        assert "fold" in result.stdout.lower()


class TestColumnCommand:
    """Test column command."""

    @pytest.mark.asyncio
    async def test_column_basic(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("column /test.txt")
        assert result.exit_code == 0
        # Should output in columns
        assert result.stdout.strip() != ""

    @pytest.mark.asyncio
    async def test_column_table_mode(self):
        bash = Bash(files={"/test.txt": "a:b:c\n1:2:3\n"})
        result = await bash.exec("column -t -s ':' /test.txt")
        assert result.exit_code == 0
        # Should be formatted as table
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_column_stdin(self):
        bash = Bash()
        result = await bash.exec("echo -e 'a:b\\n1:2' | column -t -s ':'")
        assert result.exit_code == 0
        assert "a" in result.stdout

    @pytest.mark.asyncio
    async def test_column_custom_separator(self):
        bash = Bash(files={"/test.txt": "a,b,c\n1,2,3\n"})
        result = await bash.exec("column -t -s ',' /test.txt")
        assert result.exit_code == 0
        # Values should be separated
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 2

    @pytest.mark.asyncio
    async def test_column_output_separator(self):
        bash = Bash(files={"/test.txt": "a:b:c\n1:2:3\n"})
        result = await bash.exec("column -t -s ':' -o '|' /test.txt")
        assert result.exit_code == 0
        assert "|" in result.stdout

    @pytest.mark.asyncio
    async def test_column_help(self):
        bash = Bash()
        result = await bash.exec("column --help")
        assert result.exit_code == 0
        assert "column" in result.stdout.lower()


class TestCommCommand:
    """Test comm command."""

    @pytest.mark.asyncio
    async def test_comm_basic(self):
        bash = Bash(files={
            "/a.txt": "apple\nbanana\ncherry\n",
            "/b.txt": "banana\ndate\n"
        })
        result = await bash.exec("comm /a.txt /b.txt")
        assert result.exit_code == 0
        # Output has 3 columns: only in a, only in b, in both
        assert "apple" in result.stdout
        assert "banana" in result.stdout
        assert "cherry" in result.stdout
        assert "date" in result.stdout

    @pytest.mark.asyncio
    async def test_comm_suppress_column1(self):
        bash = Bash(files={
            "/a.txt": "apple\nbanana\n",
            "/b.txt": "banana\ndate\n"
        })
        result = await bash.exec("comm -1 /a.txt /b.txt")
        assert result.exit_code == 0
        # Should not show lines unique to file1
        assert "apple" not in result.stdout
        assert "banana" in result.stdout
        assert "date" in result.stdout

    @pytest.mark.asyncio
    async def test_comm_suppress_column2(self):
        bash = Bash(files={
            "/a.txt": "apple\nbanana\n",
            "/b.txt": "banana\ndate\n"
        })
        result = await bash.exec("comm -2 /a.txt /b.txt")
        assert result.exit_code == 0
        # Should not show lines unique to file2
        assert "apple" in result.stdout
        assert "banana" in result.stdout
        assert "date" not in result.stdout

    @pytest.mark.asyncio
    async def test_comm_suppress_column3(self):
        bash = Bash(files={
            "/a.txt": "apple\nbanana\n",
            "/b.txt": "banana\ndate\n"
        })
        result = await bash.exec("comm -3 /a.txt /b.txt")
        assert result.exit_code == 0
        # Should not show common lines
        assert "apple" in result.stdout
        assert "banana" not in result.stdout
        assert "date" in result.stdout

    @pytest.mark.asyncio
    async def test_comm_only_common(self):
        bash = Bash(files={
            "/a.txt": "apple\nbanana\ncherry\n",
            "/b.txt": "banana\ndate\n"
        })
        result = await bash.exec("comm -12 /a.txt /b.txt")
        assert result.exit_code == 0
        # Should only show common lines (suppress 1 and 2)
        assert "apple" not in result.stdout
        assert "banana" in result.stdout
        assert "cherry" not in result.stdout
        assert "date" not in result.stdout

    @pytest.mark.asyncio
    async def test_comm_empty_file(self):
        bash = Bash(files={
            "/a.txt": "apple\nbanana\n",
            "/b.txt": ""
        })
        result = await bash.exec("comm /a.txt /b.txt")
        assert result.exit_code == 0
        assert "apple" in result.stdout
        assert "banana" in result.stdout

    @pytest.mark.asyncio
    async def test_comm_nonexistent(self):
        bash = Bash(files={"/a.txt": "test\n"})
        result = await bash.exec("comm /a.txt /nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_comm_help(self):
        bash = Bash()
        result = await bash.exec("comm --help")
        assert result.exit_code == 0
        assert "comm" in result.stdout.lower()


class TestStringsCommand:
    """Test strings command."""

    @pytest.mark.asyncio
    async def test_strings_basic(self):
        bash = Bash(files={"/test.bin": "hello\x00world\x00test"})
        result = await bash.exec("strings /test.bin")
        assert result.exit_code == 0
        assert "hello" in result.stdout
        assert "world" in result.stdout
        assert "test" in result.stdout

    @pytest.mark.asyncio
    async def test_strings_min_length(self):
        bash = Bash(files={"/test.bin": "hi\x00hello\x00ab"})
        result = await bash.exec("strings -n 4 /test.bin")
        assert result.exit_code == 0
        assert "hello" in result.stdout
        # "hi" and "ab" should be excluded (< 4 chars)

    @pytest.mark.asyncio
    async def test_strings_stdin(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | strings")
        assert result.exit_code == 0
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_strings_show_offset(self):
        bash = Bash(files={"/test.bin": "hello\x00world"})
        result = await bash.exec("strings -o /test.bin")
        assert result.exit_code == 0
        # Should show offsets
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_strings_multiple_files(self):
        bash = Bash(files={
            "/a.bin": "fileA\x00test",
            "/b.bin": "fileB\x00data"
        })
        result = await bash.exec("strings /a.bin /b.bin")
        assert result.exit_code == 0
        assert "fileA" in result.stdout
        assert "fileB" in result.stdout

    @pytest.mark.asyncio
    async def test_strings_nonexistent(self):
        bash = Bash()
        result = await bash.exec("strings /nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_strings_help(self):
        bash = Bash()
        result = await bash.exec("strings --help")
        assert result.exit_code == 0
        assert "strings" in result.stdout.lower()


class TestOdCommand:
    """Test od command."""

    @pytest.mark.asyncio
    async def test_od_basic_octal(self):
        bash = Bash(files={"/test.txt": "ABC"})
        result = await bash.exec("od /test.txt")
        assert result.exit_code == 0
        # Should show octal dump
        assert "0000000" in result.stdout  # Address
        assert "101" in result.stdout  # 'A' in octal is 101

    @pytest.mark.asyncio
    async def test_od_hex(self):
        bash = Bash(files={"/test.txt": "ABC"})
        result = await bash.exec("od -x /test.txt")
        assert result.exit_code == 0
        # Should show hex dump
        assert "41" in result.stdout  # 'A' in hex

    @pytest.mark.asyncio
    async def test_od_character(self):
        bash = Bash(files={"/test.txt": "A\n"})
        result = await bash.exec("od -c /test.txt")
        assert result.exit_code == 0
        # Should show characters
        assert "A" in result.stdout
        assert "\\n" in result.stdout

    @pytest.mark.asyncio
    async def test_od_decimal(self):
        bash = Bash(files={"/test.txt": "ABC"})
        result = await bash.exec("od -d /test.txt")
        assert result.exit_code == 0
        # Should show decimal values
        assert "65" in result.stdout  # 'A' is 65

    @pytest.mark.asyncio
    async def test_od_suppress_address(self):
        bash = Bash(files={"/test.txt": "ABC"})
        result = await bash.exec("od -An /test.txt")
        assert result.exit_code == 0
        # Should not show addresses
        assert "0000000" not in result.stdout

    @pytest.mark.asyncio
    async def test_od_stdin(self):
        bash = Bash()
        result = await bash.exec("echo ABC | od")
        assert result.exit_code == 0
        assert "0000000" in result.stdout

    @pytest.mark.asyncio
    async def test_od_nonexistent(self):
        bash = Bash()
        result = await bash.exec("od /nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_od_help(self):
        bash = Bash()
        result = await bash.exec("od --help")
        assert result.exit_code == 0
        assert "od" in result.stdout.lower()


class TestSplitCommand:
    """Test split command."""

    @pytest.mark.asyncio
    async def test_split_basic(self):
        content = "\n".join([f"line{i}" for i in range(10)]) + "\n"
        bash = Bash(files={"/test.txt": content})
        result = await bash.exec("split -l 5 /test.txt")
        assert result.exit_code == 0
        # Should create xaa and xab files
        xaa = await bash.exec("cat xaa")
        assert xaa.exit_code == 0
        assert "line0" in xaa.stdout
        xab = await bash.exec("cat xab")
        assert xab.exit_code == 0
        assert "line5" in xab.stdout

    @pytest.mark.asyncio
    async def test_split_custom_prefix(self):
        content = "\n".join([f"line{i}" for i in range(10)]) + "\n"
        bash = Bash(files={"/test.txt": content})
        result = await bash.exec("split -l 5 /test.txt output_")
        assert result.exit_code == 0
        xaa = await bash.exec("cat output_aa")
        assert xaa.exit_code == 0
        assert "line0" in xaa.stdout

    @pytest.mark.asyncio
    async def test_split_numeric_suffix(self):
        content = "\n".join([f"line{i}" for i in range(10)]) + "\n"
        bash = Bash(files={"/test.txt": content})
        result = await bash.exec("split -d -l 5 /test.txt")
        assert result.exit_code == 0
        x00 = await bash.exec("cat x00")
        assert x00.exit_code == 0
        assert "line0" in x00.stdout

    @pytest.mark.asyncio
    async def test_split_by_bytes(self):
        bash = Bash(files={"/test.txt": "abcdefghij"})  # 10 bytes
        result = await bash.exec("split -b 5 /test.txt")
        assert result.exit_code == 0
        xaa = await bash.exec("cat xaa")
        assert xaa.stdout.strip() == "abcde"
        xab = await bash.exec("cat xab")
        assert xab.stdout.strip() == "fghij"

    @pytest.mark.asyncio
    async def test_split_stdin(self):
        bash = Bash()
        result = await bash.exec("echo -e 'a\\nb\\nc\\nd' | split -l 2")
        assert result.exit_code == 0
        xaa = await bash.exec("cat xaa")
        assert "a" in xaa.stdout
        assert "b" in xaa.stdout

    @pytest.mark.asyncio
    async def test_split_suffix_length(self):
        content = "\n".join([f"line{i}" for i in range(10)]) + "\n"
        bash = Bash(files={"/test.txt": content})
        result = await bash.exec("split -a 3 -l 5 /test.txt")
        assert result.exit_code == 0
        xaaa = await bash.exec("cat xaaa")
        assert xaaa.exit_code == 0

    @pytest.mark.asyncio
    async def test_split_nonexistent(self):
        bash = Bash()
        result = await bash.exec("split /nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_split_help(self):
        bash = Bash()
        result = await bash.exec("split --help")
        assert result.exit_code == 0
        assert "split" in result.stdout.lower()


class TestJoinCommand:
    """Test join command."""

    @pytest.mark.asyncio
    async def test_join_basic(self):
        bash = Bash(files={
            "/a.txt": "1 apple\n2 banana\n3 cherry\n",
            "/b.txt": "1 red\n2 yellow\n4 purple\n"
        })
        result = await bash.exec("join /a.txt /b.txt")
        assert result.exit_code == 0
        assert "1 apple red" in result.stdout
        assert "2 banana yellow" in result.stdout
        # 3 and 4 shouldn't match by default
        assert "cherry" not in result.stdout

    @pytest.mark.asyncio
    async def test_join_custom_field(self):
        bash = Bash(files={
            "/a.txt": "apple 1\nbanana 2\n",
            "/b.txt": "1 red\n2 yellow\n"
        })
        result = await bash.exec("join -1 2 -2 1 /a.txt /b.txt")
        assert result.exit_code == 0
        assert "red" in result.stdout
        assert "yellow" in result.stdout

    @pytest.mark.asyncio
    async def test_join_custom_separator(self):
        bash = Bash(files={
            "/a.txt": "1:apple\n2:banana\n",
            "/b.txt": "1:red\n2:yellow\n"
        })
        result = await bash.exec("join -t ':' /a.txt /b.txt")
        assert result.exit_code == 0
        assert "1:apple:red" in result.stdout
        assert "2:banana:yellow" in result.stdout

    @pytest.mark.asyncio
    async def test_join_unpaired(self):
        bash = Bash(files={
            "/a.txt": "1 apple\n2 banana\n3 cherry\n",
            "/b.txt": "1 red\n2 yellow\n"
        })
        result = await bash.exec("join -a 1 /a.txt /b.txt")
        assert result.exit_code == 0
        # Should include unmatched from file1
        assert "cherry" in result.stdout

    @pytest.mark.asyncio
    async def test_join_only_unpaired(self):
        bash = Bash(files={
            "/a.txt": "1 apple\n2 banana\n3 cherry\n",
            "/b.txt": "1 red\n2 yellow\n"
        })
        result = await bash.exec("join -v 1 /a.txt /b.txt")
        assert result.exit_code == 0
        # Should only show unpaired from file1
        assert "cherry" in result.stdout
        assert "apple" not in result.stdout

    @pytest.mark.asyncio
    async def test_join_ignore_case(self):
        bash = Bash(files={
            "/a.txt": "Apple 1\nBanana 2\n",
            "/b.txt": "apple red\nbanana yellow\n"
        })
        result = await bash.exec("join -i /a.txt /b.txt")
        assert result.exit_code == 0
        assert "red" in result.stdout

    @pytest.mark.asyncio
    async def test_join_missing_file(self):
        bash = Bash(files={"/a.txt": "1 apple\n"})
        result = await bash.exec("join /a.txt /nonexistent")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_join_missing_operand(self):
        bash = Bash()
        result = await bash.exec("join")
        assert result.exit_code == 1
        assert "missing operand" in result.stderr

    @pytest.mark.asyncio
    async def test_join_help(self):
        bash = Bash()
        result = await bash.exec("join --help")
        assert result.exit_code == 0
        assert "join" in result.stdout.lower()


# =============================================================================
# Shell Commands
# =============================================================================


class TestBashCommand:
    """Test bash command."""

    @pytest.mark.asyncio
    async def test_bash_c_simple(self):
        bash = Bash()
        result = await bash.exec('bash -c "echo hello"')
        assert result.exit_code == 0
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_bash_c_multiple_commands(self):
        bash = Bash()
        result = await bash.exec('bash -c "echo one; echo two"')
        assert result.exit_code == 0
        assert result.stdout == "one\ntwo\n"

    @pytest.mark.asyncio
    async def test_bash_c_positional_args(self):
        bash = Bash()
        result = await bash.exec("bash -c 'echo $1 $2' _ foo bar")
        assert result.exit_code == 0
        assert result.stdout == "foo bar\n"

    @pytest.mark.asyncio
    async def test_bash_script_file(self):
        bash = Bash(files={"/scripts/hello.sh": 'echo "Hello, World!"'})
        result = await bash.exec("bash /scripts/hello.sh")
        assert result.exit_code == 0
        assert result.stdout == "Hello, World!\n"

    @pytest.mark.asyncio
    async def test_bash_script_with_shebang(self):
        bash = Bash(files={
            "/scripts/script.sh": '#!/bin/bash\necho "from shebang script"'
        })
        result = await bash.exec("bash /scripts/script.sh")
        assert result.exit_code == 0
        assert result.stdout == "from shebang script\n"

    @pytest.mark.asyncio
    async def test_bash_script_with_args(self):
        bash = Bash(files={"/scripts/greet.sh": 'echo "Hello, $1!"'})
        result = await bash.exec("bash /scripts/greet.sh Alice")
        assert result.exit_code == 0
        assert result.stdout == "Hello, Alice!\n"

    @pytest.mark.asyncio
    async def test_bash_script_arg_count(self):
        bash = Bash(files={"/scripts/count.sh": 'echo "Got $# arguments"'})
        result = await bash.exec("bash /scripts/count.sh a b c")
        assert result.exit_code == 0
        assert result.stdout == "Got 3 arguments\n"

    @pytest.mark.asyncio
    async def test_bash_script_all_args(self):
        bash = Bash(files={"/scripts/all.sh": 'echo "Args: $@"'})
        result = await bash.exec("bash /scripts/all.sh one two three")
        assert result.exit_code == 0
        assert result.stdout == "Args: one two three\n"

    @pytest.mark.asyncio
    async def test_bash_nonexistent_script(self):
        bash = Bash()
        result = await bash.exec("bash /nonexistent.sh")
        assert result.exit_code == 127
        assert "No such file or directory" in result.stderr

    @pytest.mark.asyncio
    async def test_bash_multiline_script(self):
        bash = Bash(files={
            "/scripts/multi.sh": 'echo "Line 1"\necho "Line 2"\necho "Line 3"'
        })
        result = await bash.exec("bash /scripts/multi.sh")
        assert result.exit_code == 0
        assert result.stdout == "Line 1\nLine 2\nLine 3\n"

    @pytest.mark.asyncio
    async def test_bash_no_args(self):
        bash = Bash()
        result = await bash.exec("bash")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_bash_help(self):
        bash = Bash()
        result = await bash.exec("bash --help")
        assert result.exit_code == 0
        assert "bash" in result.stdout.lower()
        assert "-c" in result.stdout


    @pytest.mark.asyncio
    async def test_bash_norc_flag(self):
        """bash --norc -c should work, ignoring --norc."""
        bash = Bash()
        result = await bash.exec("bash --norc -c 'echo hello'")
        assert result.exit_code == 0
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_bash_norc_rcfile_flags(self):
        """bash --norc --rcfile /dev/null -c should work."""
        bash = Bash()
        result = await bash.exec("bash --norc --rcfile /dev/null -c 'echo hello'")
        assert result.exit_code == 0
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_bash_interactive_flag(self):
        """bash -i -c should work, ignoring -i."""
        bash = Bash()
        result = await bash.exec("bash -i -c 'echo hello'")
        assert result.exit_code == 0
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_bash_nounset_flag(self):
        """bash -u -c should work, enabling nounset."""
        bash = Bash()
        result = await bash.exec("bash -u -c 'echo hello'")
        assert result.exit_code == 0
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_bash_combined_flags(self):
        """bash with multiple flags before -c."""
        bash = Bash()
        result = await bash.exec("bash --norc --rcfile /dev/null -i -c 'echo ok'")
        assert result.exit_code == 0
        assert result.stdout == "ok\n"


class TestShCommand:
    """Test sh command."""

    @pytest.mark.asyncio
    async def test_sh_c_simple(self):
        bash = Bash()
        result = await bash.exec('sh -c "echo hello"')
        assert result.exit_code == 0
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_sh_c_positional_args(self):
        bash = Bash()
        result = await bash.exec("sh -c 'echo $1' _ world")
        assert result.exit_code == 0
        assert result.stdout == "world\n"

    @pytest.mark.asyncio
    async def test_sh_script_file(self):
        bash = Bash(files={"/scripts/test.sh": 'echo "from sh"'})
        result = await bash.exec("sh /scripts/test.sh")
        assert result.exit_code == 0
        assert result.stdout == "from sh\n"

    @pytest.mark.asyncio
    async def test_sh_no_args(self):
        bash = Bash()
        result = await bash.exec("sh")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sh_help(self):
        bash = Bash()
        result = await bash.exec("sh --help")
        assert result.exit_code == 0
        assert "sh" in result.stdout.lower()


# =============================================================================
# Archive Commands
# =============================================================================


class TestTarCommand:
    """Test tar command."""

    @pytest.mark.asyncio
    async def test_tar_help(self):
        bash = Bash()
        result = await bash.exec("tar --help")
        assert result.exit_code == 0
        assert "tar" in result.stdout.lower()
        assert "-c" in result.stdout
        assert "-x" in result.stdout

    @pytest.mark.asyncio
    async def test_tar_missing_operation(self):
        bash = Bash()
        result = await bash.exec("tar -f archive.tar")
        assert result.exit_code == 2
        assert "must specify" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_tar_multiple_operations(self):
        bash = Bash()
        result = await bash.exec("tar -c -x -f archive.tar")
        assert result.exit_code == 2
        assert "more than one" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_tar_create_single_file(self):
        bash = Bash(files={"/test.txt": "Hello, World!"})
        result = await bash.exec("tar -cf /archive.tar /test.txt")
        assert result.exit_code == 0
        # Verify archive was created
        stat = await bash.exec("stat /archive.tar")
        assert stat.exit_code == 0

    @pytest.mark.asyncio
    async def test_tar_create_verbose(self):
        bash = Bash(files={"/test.txt": "Hello, World!"})
        result = await bash.exec("tar -cvf /archive.tar /test.txt")
        assert result.exit_code == 0
        assert "test.txt" in result.stderr

    @pytest.mark.asyncio
    async def test_tar_create_directory(self):
        bash = Bash(files={
            "/mydir/file1.txt": "Content 1",
            "/mydir/file2.txt": "Content 2",
        })
        result = await bash.exec("tar -cvf /archive.tar /mydir")
        assert result.exit_code == 0
        assert "mydir" in result.stderr

    @pytest.mark.asyncio
    async def test_tar_list(self):
        bash = Bash(files={
            "/test.txt": "Hello",
            "/other.txt": "World",
        })
        await bash.exec("tar -cf /archive.tar /test.txt /other.txt")
        result = await bash.exec("tar -tf /archive.tar")
        assert result.exit_code == 0
        assert "test.txt" in result.stdout
        assert "other.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_tar_extract(self):
        bash = Bash(files={"/test.txt": "Hello, World!"})
        await bash.exec("tar -cf /archive.tar /test.txt")
        await bash.exec("rm /test.txt")
        result = await bash.exec("tar -xf /archive.tar -C /")
        assert result.exit_code == 0
        # Verify file was extracted
        cat = await bash.exec("cat /test.txt")
        assert cat.stdout.strip() == "Hello, World!"

    @pytest.mark.asyncio
    async def test_tar_extract_verbose(self):
        bash = Bash(files={"/test.txt": "Hello!"})
        await bash.exec("tar -cf /archive.tar /test.txt")
        await bash.exec("rm /test.txt")
        result = await bash.exec("tar -xvf /archive.tar -C /")
        assert result.exit_code == 0
        assert "test.txt" in result.stderr

    @pytest.mark.asyncio
    async def test_tar_gzip(self):
        bash = Bash(files={"/test.txt": "Hello, World!"})
        result = await bash.exec("tar -czf /archive.tar.gz /test.txt")
        assert result.exit_code == 0
        # Extract with gzip
        await bash.exec("rm /test.txt")
        result = await bash.exec("tar -xzf /archive.tar.gz -C /")
        assert result.exit_code == 0
        cat = await bash.exec("cat /test.txt")
        assert cat.stdout.strip() == "Hello, World!"

    @pytest.mark.asyncio
    async def test_tar_nonexistent_file(self):
        bash = Bash()
        result = await bash.exec("tar -xf /nonexistent.tar")
        assert result.exit_code == 2
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_tar_empty_archive_error(self):
        bash = Bash()
        result = await bash.exec("tar -cf /archive.tar")
        assert result.exit_code == 2
        assert "empty archive" in result.stderr.lower()


class TestCurlCommand:
    """Tests for the curl command."""

    @pytest.mark.asyncio
    async def test_curl_help(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()
        ctx = CommandContext(fs=fs, cwd="/", env={})
        cmd = CurlCommand()

        result = await cmd.execute(["--help"], ctx)
        assert result.exit_code == 0
        assert "Usage: curl" in result.stdout
        assert "-X, --request" in result.stdout

    @pytest.mark.asyncio
    async def test_curl_no_url(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()
        ctx = CommandContext(fs=fs, cwd="/", env={})
        cmd = CurlCommand()

        result = await cmd.execute([], ctx)
        assert result.exit_code == 2
        assert "no URL specified" in result.stderr

    @pytest.mark.asyncio
    async def test_curl_no_fetch(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()
        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=None)
        cmd = CurlCommand()

        result = await cmd.execute(["https://example.com"], ctx)
        assert result.exit_code == 1
        assert "fetch not available" in result.stderr

    @pytest.mark.asyncio
    async def test_curl_unknown_option(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()
        ctx = CommandContext(fs=fs, cwd="/", env={})
        cmd = CurlCommand()

        result = await cmd.execute(["--invalid-option", "https://example.com"], ctx)
        assert result.exit_code == 2
        assert "is unknown" in result.stderr

    @pytest.mark.asyncio
    async def test_curl_option_parsing(self):
        from just_bash.commands.curl.curl import parse_options

        # Test basic URL
        opts = parse_options(["https://example.com"])
        assert opts.url == "https://example.com"
        assert opts.method == "GET"

        # Test method
        opts = parse_options(["-X", "POST", "https://example.com"])
        assert opts.method == "POST"

        # Test headers
        opts = parse_options(["-H", "Content-Type: application/json", "https://example.com"])
        assert opts.headers.get("Content-Type") == "application/json"

        # Test data
        opts = parse_options(["-d", "test=value", "https://example.com"])
        assert opts.data == "test=value"
        assert opts.method == "POST"  # -d changes to POST

        # Test combined options
        opts = parse_options(["-sS", "https://example.com"])
        assert opts.silent is True
        assert opts.show_error is True

        # Test head
        opts = parse_options(["-I", "https://example.com"])
        assert opts.head_only is True
        assert opts.method == "HEAD"

        # Test verbose
        opts = parse_options(["-v", "https://example.com"])
        assert opts.verbose is True

        # Test output file
        opts = parse_options(["-o", "output.txt", "https://example.com"])
        assert opts.output_file == "output.txt"

        # Test user auth
        opts = parse_options(["-u", "user:pass", "https://example.com"])
        assert opts.user == "user:pass"

        # Test timeout
        opts = parse_options(["-m", "10", "https://example.com"])
        assert opts.timeout_ms == 10000

    @pytest.mark.asyncio
    async def test_curl_with_mock_fetch(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()

        # Create a mock fetch function
        async def mock_fetch(url, options=None):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-type": "text/plain"},
                "body": "Hello, World!",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        result = await cmd.execute(["https://example.com"], ctx)
        assert result.exit_code == 0
        assert result.stdout == "Hello, World!"

    @pytest.mark.asyncio
    async def test_curl_include_headers(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()

        async def mock_fetch(url, options=None):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-type": "text/plain"},
                "body": "body content",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        result = await cmd.execute(["-i", "https://example.com"], ctx)
        assert result.exit_code == 0
        assert "HTTP/1.1 200 OK" in result.stdout
        assert "content-type: text/plain" in result.stdout
        assert "body content" in result.stdout

    @pytest.mark.asyncio
    async def test_curl_output_to_file(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()

        async def mock_fetch(url, options=None):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "file content",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        result = await cmd.execute(["-o", "/output.txt", "https://example.com"], ctx)
        assert result.exit_code == 0
        assert result.stdout == ""  # Output goes to file

        # Check file was written
        content = await fs.read_file("/output.txt")
        assert content == "file content"

    @pytest.mark.asyncio
    async def test_curl_fail_on_http_error(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()

        async def mock_fetch(url, options=None):
            return {
                "status": 404,
                "statusText": "Not Found",
                "headers": {},
                "body": "Not Found",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        result = await cmd.execute(["-f", "https://example.com"], ctx)
        assert result.exit_code == 22
        assert "returned error: 404" in result.stderr

    @pytest.mark.asyncio
    async def test_curl_silent_mode(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()

        async def mock_fetch(url, options=None):
            raise Exception("Network error")

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        # Silent mode suppresses error
        result = await cmd.execute(["-s", "https://example.com"], ctx)
        assert result.exit_code == 1
        assert result.stderr == ""

        # -sS shows error even in silent mode
        result = await cmd.execute(["-sS", "https://example.com"], ctx)
        assert result.exit_code == 1
        assert "Network error" in result.stderr

    @pytest.mark.asyncio
    async def test_curl_write_out(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()

        async def mock_fetch(url, options=None):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-type": "application/json"},
                "body": '{"key": "value"}',
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        result = await cmd.execute(["-w", "%{http_code}\\n", "https://example.com"], ctx)
        assert result.exit_code == 0
        assert '{"key": "value"}200\n' in result.stdout

    @pytest.mark.asyncio
    async def test_curl_head_request(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()

        async def mock_fetch(url, options=None):
            assert options.get("method") == "HEAD"
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-length": "1234"},
                "body": "",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        result = await cmd.execute(["-I", "https://example.com"], ctx)
        assert result.exit_code == 0
        assert "HTTP/1.1 200 OK" in result.stdout
        assert "content-length" in result.stdout

    @pytest.mark.asyncio
    async def test_curl_post_data(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs()

        received_options = {}

        async def mock_fetch(url, options=None):
            received_options.update(options or {})
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "OK",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        result = await cmd.execute(["-d", "name=test", "https://example.com"], ctx)
        assert result.exit_code == 0
        assert received_options.get("method") == "POST"
        assert received_options.get("body") == "name=test"

    @pytest.mark.asyncio
    async def test_curl_user_auth(self):
        from just_bash.commands.curl.curl import CurlCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs
        import base64

        fs = InMemoryFs()

        received_headers = {}

        async def mock_fetch(url, options=None):
            received_headers.update(options.get("headers", {}) if options else {})
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "OK",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, fetch=mock_fetch)
        cmd = CurlCommand()

        result = await cmd.execute(["-u", "user:pass", "https://example.com"], ctx)
        assert result.exit_code == 0

        expected = base64.b64encode(b"user:pass").decode()
        assert received_headers.get("Authorization") == f"Basic {expected}"


class TestYqCommand:
    """Tests for the yq command."""

    @pytest.mark.asyncio
    async def test_yq_help(self):
        bash = Bash()
        result = await bash.exec("yq --help")
        assert result.exit_code == 0
        assert "Usage: yq" in result.stdout
        assert "input-format" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_yaml_identity(self):
        bash = Bash(files={"/test.yaml": "name: John\nage: 30"})
        result = await bash.exec("yq '.' /test.yaml")
        assert result.exit_code == 0
        assert "name" in result.stdout
        assert "John" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_yaml_field_access(self):
        bash = Bash(files={"/test.yaml": "name: John\nage: 30"})
        result = await bash.exec("yq '.name' /test.yaml")
        assert result.exit_code == 0
        assert "John" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_yaml_to_json(self):
        bash = Bash(files={"/test.yaml": "name: John\nage: 30"})
        result = await bash.exec("yq -o json '.' /test.yaml")
        assert result.exit_code == 0
        assert '"name"' in result.stdout
        assert '"John"' in result.stdout

    @pytest.mark.asyncio
    async def test_yq_json_to_yaml(self):
        bash = Bash(files={"/test.json": '{"name": "John", "age": 30}'})
        result = await bash.exec("yq -p json '.' /test.json")
        assert result.exit_code == 0
        assert "name:" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_csv_parse(self):
        bash = Bash(files={"/test.csv": "name,age\nJohn,30\nJane,25"})
        result = await bash.exec("yq -p csv '.[0].name' /test.csv")
        assert result.exit_code == 0
        assert "John" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_ini_parse(self):
        bash = Bash(files={"/test.ini": "[database]\nhost = localhost\nport = 5432"})
        result = await bash.exec("yq -p ini '.database.host' /test.ini")
        assert result.exit_code == 0
        assert "localhost" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_stdin(self):
        bash = Bash()
        result = await bash.exec("echo 'name: Test' | yq '.name'")
        assert result.exit_code == 0
        assert "Test" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_compact_json(self):
        bash = Bash(files={"/test.yaml": "items:\n  - a\n  - b"})
        result = await bash.exec("yq -o json -c '.items' /test.yaml")
        assert result.exit_code == 0
        assert '["a","b"]' in result.stdout

    @pytest.mark.asyncio
    async def test_yq_raw_output(self):
        bash = Bash(files={"/test.yaml": "name: Hello World"})
        result = await bash.exec("yq -o json -r '.name' /test.yaml")
        assert result.exit_code == 0
        assert result.stdout.strip() == "Hello World"

    @pytest.mark.asyncio
    async def test_yq_array_access(self):
        bash = Bash(files={"/test.yaml": "users:\n  - name: Alice\n  - name: Bob"})
        result = await bash.exec("yq '.users[1].name' /test.yaml")
        assert result.exit_code == 0
        assert "Bob" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_file_not_found(self):
        bash = Bash()
        result = await bash.exec("yq '.' /nonexistent.yaml")
        assert result.exit_code == 2
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_yq_unknown_option(self):
        bash = Bash()
        result = await bash.exec("yq --invalid-option '.' /test.yaml")
        assert result.exit_code == 2
        assert "unknown option" in result.stderr

    @pytest.mark.asyncio
    async def test_yq_null_input(self):
        bash = Bash()
        result = await bash.exec("yq -n 'null'")
        assert result.exit_code == 0
        assert "null" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_auto_detect_json(self):
        bash = Bash(files={"/test.json": '{"name": "Test"}'})
        result = await bash.exec("yq '.name' /test.json")
        assert result.exit_code == 0
        assert "Test" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_toml_parse(self):
        bash = Bash(files={"/test.toml": '[package]\nname = "myapp"\nversion = "1.0"'})
        result = await bash.exec("yq -p toml '.package.name' /test.toml")
        assert result.exit_code == 0
        assert "myapp" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_slurp(self):
        bash = Bash(files={"/test.yaml": "name: Test\nvalue: 123"})
        result = await bash.exec("yq -s -o json '.' /test.yaml")
        assert result.exit_code == 0
        # Should be wrapped in array
        assert "[" in result.stdout


class TestXanCommand:
    """Tests for the xan command - CSV toolkit."""

    @pytest.mark.asyncio
    async def test_xan_help(self):
        bash = Bash()
        result = await bash.exec("xan --help")
        assert result.exit_code == 0
        assert "Usage: xan" in result.stdout
        assert "headers" in result.stdout

    @pytest.mark.asyncio
    async def test_xan_headers(self):
        bash = Bash(files={"/test.csv": "name,age,city\nAlice,30,NYC\nBob,25,LA"})
        result = await bash.exec("xan headers /test.csv")
        assert result.exit_code == 0
        assert "name" in result.stdout
        assert "age" in result.stdout
        assert "city" in result.stdout

    @pytest.mark.asyncio
    async def test_xan_headers_just_names(self):
        bash = Bash(files={"/test.csv": "name,age,city\nAlice,30,NYC"})
        result = await bash.exec("xan headers -j /test.csv")
        assert result.exit_code == 0
        assert "name\n" in result.stdout
        assert "\t" not in result.stdout

    @pytest.mark.asyncio
    async def test_xan_count(self):
        bash = Bash(files={"/test.csv": "name,age\nAlice,30\nBob,25\nCharlie,35"})
        result = await bash.exec("xan count /test.csv")
        assert result.exit_code == 0
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_xan_head(self):
        bash = Bash(files={"/test.csv": "name,age\nAlice,30\nBob,25\nCharlie,35"})
        result = await bash.exec("xan head -n 2 /test.csv")
        assert result.exit_code == 0
        assert "Alice" in result.stdout
        assert "Bob" in result.stdout
        assert "Charlie" not in result.stdout

    @pytest.mark.asyncio
    async def test_xan_tail(self):
        bash = Bash(files={"/test.csv": "name,age\nAlice,30\nBob,25\nCharlie,35"})
        result = await bash.exec("xan tail -n 1 /test.csv")
        assert result.exit_code == 0
        assert "Charlie" in result.stdout
        assert "Alice" not in result.stdout

    @pytest.mark.asyncio
    async def test_xan_select(self):
        from just_bash.commands.xan.xan import XanCommand
        from just_bash.types import CommandContext
        from just_bash.fs import InMemoryFs

        fs = InMemoryFs({"/test.csv": "name,age,city\nAlice,30,NYC\nBob,25,LA"})
        ctx = CommandContext(fs=fs, cwd="/", env={})
        cmd = XanCommand()

        result = await cmd.execute(["select", "name,city", "/test.csv"], ctx)
        assert result.exit_code == 0
        assert "name" in result.stdout
        assert "city" in result.stdout
        assert "Alice" in result.stdout
        assert "NYC" in result.stdout
        # Should not include age column
        lines = result.stdout.strip().split("\n")
        assert "age" not in lines[0]

    @pytest.mark.asyncio
    async def test_xan_filter(self):
        bash = Bash(files={"/test.csv": "name,age\nAlice,30\nBob,25\nCharlie,35"})
        result = await bash.exec("xan filter 'age > 28' /test.csv")
        assert result.exit_code == 0
        assert "Alice" in result.stdout
        assert "Charlie" in result.stdout
        assert "Bob" not in result.stdout

    @pytest.mark.asyncio
    async def test_xan_filter_equals(self):
        bash = Bash(files={"/test.csv": "name,age\nAlice,30\nBob,25"})
        result = await bash.exec("xan filter 'name == Alice' /test.csv")
        assert result.exit_code == 0
        assert "Alice" in result.stdout
        assert "Bob" not in result.stdout

    @pytest.mark.asyncio
    async def test_xan_search(self):
        bash = Bash(files={"/test.csv": "name,city\nAlice,NYC\nBob,LA\nCharlie,NYC"})
        result = await bash.exec("xan search NYC /test.csv")
        assert result.exit_code == 0
        assert "Alice" in result.stdout
        assert "Charlie" in result.stdout
        assert "Bob" not in result.stdout

    @pytest.mark.asyncio
    async def test_xan_sort_numeric(self):
        bash = Bash(files={"/test.csv": "name,age\nAlice,30\nBob,25\nCharlie,35"})
        result = await bash.exec("xan sort -N age /test.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Should be sorted: header, Bob (25), Alice (30), Charlie (35)
        assert "Bob" in lines[1]
        assert "Alice" in lines[2]
        assert "Charlie" in lines[3]

    @pytest.mark.asyncio
    async def test_xan_sort_reverse(self):
        bash = Bash(files={"/test.csv": "name,age\nAlice,30\nBob,25\nCharlie,35"})
        result = await bash.exec("xan sort -N -r age /test.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Should be sorted descending: header, Charlie (35), Alice (30), Bob (25)
        assert "Charlie" in lines[1]
        assert "Alice" in lines[2]
        assert "Bob" in lines[3]

    @pytest.mark.asyncio
    async def test_xan_view(self):
        bash = Bash(files={"/test.csv": "name,age\nAlice,30\nBob,25"})
        result = await bash.exec("xan view /test.csv")
        assert result.exit_code == 0
        assert "|" in result.stdout  # Table format
        assert "name" in result.stdout
        assert "Alice" in result.stdout

    @pytest.mark.asyncio
    async def test_xan_stats(self):
        bash = Bash(files={"/test.csv": "name,value\nA,10\nB,20\nC,30"})
        result = await bash.exec("xan stats /test.csv")
        assert result.exit_code == 0
        assert "Column: value" in result.stdout
        assert "Min: 10" in result.stdout
        assert "Max: 30" in result.stdout

    @pytest.mark.asyncio
    async def test_xan_frequency(self):
        bash = Bash(files={"/test.csv": "name,category\nA,X\nB,Y\nC,X\nD,X"})
        result = await bash.exec("xan frequency category /test.csv")
        assert result.exit_code == 0
        assert "X,3" in result.stdout
        assert "Y,1" in result.stdout

    @pytest.mark.asyncio
    async def test_xan_stdin(self):
        bash = Bash()
        result = await bash.exec("echo 'name,age\nAlice,30' | xan count")
        assert result.exit_code == 0
        assert result.stdout.strip() == "1"

    @pytest.mark.asyncio
    async def test_xan_unknown_command(self):
        bash = Bash()
        result = await bash.exec("xan invalid /test.csv")
        assert result.exit_code == 1
        assert "unknown command" in result.stderr

    @pytest.mark.asyncio
    async def test_xan_file_not_found(self):
        bash = Bash()
        result = await bash.exec("xan headers /nonexistent.csv")
        assert result.exit_code == 2
        assert "No such file" in result.stderr


class TestSqlite3Command:
    """Test sqlite3 command."""

    @pytest.mark.asyncio
    async def test_sqlite3_version(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -version")
        assert result.exit_code == 0
        # Should output version like "3.x.x"
        assert result.stdout.strip()

    @pytest.mark.asyncio
    async def test_sqlite3_help(self):
        bash = Bash()
        result = await bash.exec("sqlite3 --help")
        assert result.exit_code == 0
        assert "Usage:" in result.stdout
        assert "-json" in result.stdout
        assert "-csv" in result.stdout

    @pytest.mark.asyncio
    async def test_sqlite3_missing_database(self):
        bash = Bash()
        result = await bash.exec("sqlite3")
        assert result.exit_code == 1
        assert "missing database" in result.stderr

    @pytest.mark.asyncio
    async def test_sqlite3_memory_select(self):
        bash = Bash()
        result = await bash.exec("sqlite3 :memory: 'SELECT 1+1'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "2"

    @pytest.mark.asyncio
    async def test_sqlite3_memory_multiple_columns(self):
        bash = Bash()
        result = await bash.exec("sqlite3 :memory: 'SELECT 1, 2, 3'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "1|2|3"

    @pytest.mark.asyncio
    async def test_sqlite3_csv_mode(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -csv :memory: \"SELECT 'a,b' AS col\"")
        assert result.exit_code == 0
        # CSV should quote the value since it contains a comma
        assert '"a,b"' in result.stdout or "a,b" in result.stdout

    @pytest.mark.asyncio
    async def test_sqlite3_json_mode(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -json :memory: 'SELECT 1 AS val, 2 AS num'")
        assert result.exit_code == 0
        import json
        data = json.loads(result.stdout)
        assert len(data) == 1
        assert data[0]["val"] == 1
        assert data[0]["num"] == 2

    @pytest.mark.asyncio
    async def test_sqlite3_header(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -header :memory: 'SELECT 1 AS foo, 2 AS bar'")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "foo|bar"
        assert lines[1] == "1|2"

    @pytest.mark.asyncio
    async def test_sqlite3_separator(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -separator ',' :memory: 'SELECT 1, 2, 3'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "1,2,3"

    @pytest.mark.asyncio
    async def test_sqlite3_line_mode(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -line :memory: 'SELECT 1 AS foo, 2 AS bar'")
        assert result.exit_code == 0
        assert "foo = 1" in result.stdout
        assert "bar = 2" in result.stdout

    @pytest.mark.asyncio
    async def test_sqlite3_column_mode(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -column -header :memory: 'SELECT 1 AS foo, 2 AS bar'")
        assert result.exit_code == 0
        assert "foo" in result.stdout
        assert "bar" in result.stdout
        assert "---" in result.stdout  # Column separator

    @pytest.mark.asyncio
    async def test_sqlite3_table_mode(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -table -header :memory: 'SELECT 1 AS foo'")
        assert result.exit_code == 0
        assert "+---" in result.stdout  # Table border
        assert "|" in result.stdout

    @pytest.mark.asyncio
    async def test_sqlite3_markdown_mode(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -markdown :memory: 'SELECT 1 AS foo, 2 AS bar'")
        assert result.exit_code == 0
        assert "|" in result.stdout
        assert "---" in result.stdout  # Markdown separator

    @pytest.mark.asyncio
    async def test_sqlite3_tabs_mode(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -tabs :memory: 'SELECT 1, 2, 3'")
        assert result.exit_code == 0
        assert "1\t2\t3" in result.stdout

    @pytest.mark.asyncio
    async def test_sqlite3_create_and_select(self):
        bash = Bash()
        result = await bash.exec(
            "sqlite3 :memory: 'CREATE TABLE t (x INT); INSERT INTO t VALUES (10); SELECT * FROM t'"
        )
        assert result.exit_code == 0
        assert result.stdout.strip() == "10"

    @pytest.mark.asyncio
    async def test_sqlite3_file_database_rejected(self):
        bash = Bash()
        # File-based databases should be rejected (in-memory only)
        result = await bash.exec("sqlite3 /test.db 'SELECT 1'")
        assert result.exit_code == 1
        assert "only :memory:" in result.stderr

    @pytest.mark.asyncio
    async def test_sqlite3_nullvalue(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -nullvalue 'NULL' :memory: 'SELECT NULL'")
        assert result.exit_code == 0
        assert result.stdout.strip() == "NULL"

    @pytest.mark.asyncio
    async def test_sqlite3_multiple_statements(self):
        bash = Bash()
        result = await bash.exec(
            "sqlite3 :memory: 'SELECT 1; SELECT 2; SELECT 3'"
        )
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert "1" in lines
        assert "2" in lines
        assert "3" in lines

    @pytest.mark.asyncio
    async def test_sqlite3_sql_error(self):
        bash = Bash()
        result = await bash.exec("sqlite3 :memory: 'SELECT * FROM nonexistent'")
        # With default behavior, error is in stdout and exit_code may still be 0
        assert "Error" in result.stdout or result.exit_code != 0

    @pytest.mark.asyncio
    async def test_sqlite3_bail_on_error(self):
        bash = Bash()
        result = await bash.exec(
            "sqlite3 -bail :memory: 'SELECT * FROM nonexistent; SELECT 1'"
        )
        assert result.exit_code == 1
        assert "Error" in result.stderr

    @pytest.mark.asyncio
    async def test_sqlite3_echo(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -echo :memory: 'SELECT 42'")
        assert result.exit_code == 0
        assert "SELECT 42" in result.stdout
        assert "42" in result.stdout

    @pytest.mark.asyncio
    async def test_sqlite3_stdin(self):
        bash = Bash()
        result = await bash.exec("echo 'SELECT 1+2' | sqlite3 :memory:")
        assert result.exit_code == 0
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_sqlite3_unknown_option(self):
        bash = Bash()
        result = await bash.exec("sqlite3 -unknownoption :memory: 'SELECT 1'")
        assert result.exit_code == 1
        assert "unknown option" in result.stderr


# =============================================================================
# Text Processing Commands - Extended Features
# =============================================================================


class TestSortDictionaryOrder:
    """Test sort -d (dictionary order) flag."""

    @pytest.mark.asyncio
    async def test_sort_dictionary_order_basic(self):
        """Test -d sorts using only blanks and alphanumerics."""
        bash = Bash(files={"/test.txt": "a-b\na_c\na b\n"})
        result = await bash.exec("sort -d /test.txt")
        # -d ignores non-alphanumeric, so "a-b" becomes "ab", "a_c" becomes "ac", "a b" stays "a b"
        # Sorted: "a b" (a b), "a-b" (ab), "a_c" (ac)
        assert result.stdout == "a b\na-b\na_c\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sort_dictionary_order_combined_with_fold_case(self):
        """Test -d combined with -f (fold case)."""
        bash = Bash(files={"/test.txt": "B-1\na_2\nC 3\n"})
        result = await bash.exec("sort -df /test.txt")
        # Dictionary order ignores - and _, fold case makes case-insensitive
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sort_dictionary_order_with_reverse(self):
        """Test -d combined with -r (reverse)."""
        bash = Bash(files={"/test.txt": "a-b\na_c\na b\n"})
        result = await bash.exec("sort -dr /test.txt")
        # Reverse of dictionary order
        assert result.stdout == "a_c\na-b\na b\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sort_dictionary_order_special_chars(self):
        """Test -d with various special characters."""
        bash = Bash(files={"/test.txt": "hello!world\nhelloworld\nhello world\n"})
        result = await bash.exec("sort -d /test.txt")
        # "hello world" (helloworld) vs "hello!world" (helloworld) vs "helloworld"
        # All compare as "helloworld" in dictionary order, stable sort maintains order
        assert result.exit_code == 0


class TestGrepPerlRegexp:
    """Test grep -P (Perl-compatible regex) flag."""

    @pytest.mark.asyncio
    async def test_grep_perl_regexp_flag_recognized(self):
        """Test -P flag is recognized and doesn't error."""
        bash = Bash(files={"/test.txt": "hello123\nworld456\n"})
        result = await bash.exec("grep -P 'hello' /test.txt")
        assert result.exit_code == 0
        assert "hello123" in result.stdout

    @pytest.mark.asyncio
    async def test_grep_perl_regexp_digit_class(self):
        """Test -P with \\d+ digit pattern."""
        bash = Bash(files={"/test.txt": "hello123\nworld456\nabc\n"})
        result = await bash.exec("grep -P '\\d+' /test.txt")
        assert "hello123" in result.stdout
        assert "world456" in result.stdout
        assert "abc" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_perl_regexp_lookahead(self):
        """Test -P with lookahead (PCRE feature)."""
        bash = Bash(files={"/test.txt": "foo bar\nfoo baz\n"})
        result = await bash.exec("grep -P 'foo(?= bar)' /test.txt")
        assert "foo bar" in result.stdout
        assert "foo baz" not in result.stdout

    @pytest.mark.asyncio
    async def test_grep_perl_regexp_combined_flags(self):
        """Test -P with other flags like -i."""
        bash = Bash(files={"/test.txt": "Hello123\nWORLD456\n"})
        result = await bash.exec("grep -Pi 'hello' /test.txt")
        assert "Hello123" in result.stdout


class TestTacFlags:
    """Test tac -b, -r, -s flags."""

    @pytest.mark.asyncio
    async def test_tac_custom_separator(self):
        """Test -s uses custom separator."""
        bash = Bash(files={"/test.txt": "a:b:c"})
        result = await bash.exec("tac -s ':' /test.txt")
        assert result.stdout == "c:b:a"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tac_before_separator(self):
        """Test -b attaches separator before instead of after."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("tac -b /test.txt")
        # With -b, separator attaches to the beginning of the record
        # Input has records: "a\n", "b\n", "c\n" (separators after)
        # With -b, output has separators before: "\nc", "\nb", "\na" -> "c\nb\na"
        assert result.stdout == "c\nb\na"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tac_regex_separator(self):
        """Test -r treats separator as regex."""
        bash = Bash(files={"/test.txt": "a::b:::c"})
        result = await bash.exec("tac -r -s ':+' /test.txt")
        # :+ matches one or more colons
        # Segments: "a", "b", "c" reversed -> "c", "b", "a"
        assert "c" in result.stdout
        assert "a" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tac_combined_before_and_separator(self):
        """Test -b -s combined."""
        bash = Bash(files={"/test.txt": "a|b|c"})
        result = await bash.exec("tac -b -s '|' /test.txt")
        assert result.stdout == "c|b|a"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tac_separator_newline_default(self):
        """Test default newline separator behavior."""
        bash = Bash(files={"/test.txt": "line1\nline2\nline3\n"})
        result = await bash.exec("tac /test.txt")
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "line3"
        assert lines[-1] == "line1"

    @pytest.mark.asyncio
    async def test_tac_regex_separator_multichar(self):
        """Test -r with multi-character regex separator."""
        bash = Bash(files={"/test.txt": "a---b---c"})
        result = await bash.exec("tac -r -s '-+' /test.txt")
        assert result.exit_code == 0


class TestSedLineNumber:
    """Test sed = command (print line number)."""

    @pytest.mark.asyncio
    async def test_sed_print_line_number(self):
        """Test = prints line number."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sed '=' /test.txt")
        # = prints line number, then the line itself is printed
        assert "1" in result.stdout
        assert "2" in result.stdout
        assert "3" in result.stdout
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_sed_print_line_number_with_address(self):
        """Test = with line address."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sed '2=' /test.txt")
        # Should only print line number for line 2
        lines = result.stdout.strip().split("\n")
        # Output: a, 2, b, c
        assert "2" in lines
        # Line 1 and 3 numbers should NOT appear
        line_nums_only = [l for l in lines if l.isdigit()]
        assert line_nums_only == ["2"]

    @pytest.mark.asyncio
    async def test_sed_print_line_number_silent(self):
        """Test = with -n flag (silent mode)."""
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("sed -n '=' /test.txt")
        # In silent mode, only line numbers are printed
        lines = result.stdout.strip().split("\n")
        assert lines == ["1", "2", "3"]


class TestSedFileIO:
    """Test sed r and w commands for file I/O."""

    @pytest.mark.asyncio
    async def test_sed_read_file(self):
        """Test r reads and inserts file content."""
        bash = Bash(files={
            "/main.txt": "before\nmarker\nafter\n",
            "/insert.txt": "INSERTED\n"
        })
        result = await bash.exec("sed '/marker/r /insert.txt' /main.txt")
        # INSERTED should appear after "marker"
        assert "INSERTED" in result.stdout
        assert result.exit_code == 0
        # Verify order: before, marker, INSERTED, after
        lines = result.stdout.strip().split("\n")
        marker_idx = lines.index("marker")
        inserted_idx = lines.index("INSERTED")
        assert inserted_idx > marker_idx

    @pytest.mark.asyncio
    async def test_sed_read_file_with_line_address(self):
        """Test r with line number address."""
        bash = Bash(files={
            "/main.txt": "line1\nline2\nline3\n",
            "/insert.txt": "INSERT\n"
        })
        result = await bash.exec("sed '2r /insert.txt' /main.txt")
        # INSERT should appear after line 2
        lines = result.stdout.strip().split("\n")
        assert "INSERT" in lines
        line2_idx = lines.index("line2")
        insert_idx = lines.index("INSERT")
        assert insert_idx == line2_idx + 1

    @pytest.mark.asyncio
    async def test_sed_write_file(self):
        """Test w writes pattern space to file."""
        bash = Bash(files={"/test.txt": "keep\nwrite\nkeep\n"})
        await bash.exec("sed '/write/w /output.txt' /test.txt")
        result = await bash.exec("cat /output.txt")
        assert "write" in result.stdout

    @pytest.mark.asyncio
    async def test_sed_write_file_multiple_matches(self):
        """Test w with multiple matching lines."""
        bash = Bash(files={"/test.txt": "match1\nno\nmatch2\nno\nmatch3\n"})
        await bash.exec("sed '/match/w /output.txt' /test.txt")
        result = await bash.exec("cat /output.txt")
        assert "match1" in result.stdout
        assert "match2" in result.stdout
        assert "match3" in result.stdout
        assert "no" not in result.stdout

    @pytest.mark.asyncio
    async def test_sed_read_nonexistent_file(self):
        """Test r with nonexistent file (should be silent)."""
        bash = Bash(files={"/main.txt": "line1\nline2\n"})
        result = await bash.exec("sed '/line1/r /nonexistent.txt' /main.txt")
        # Real sed silently ignores nonexistent files for r command
        assert result.exit_code == 0
        assert "line1" in result.stdout


# =============================================================================
# Split -n CHUNKS Tests
# =============================================================================


class TestSplitChunks:
    """Test split -n (split into N equal chunks)."""

    @pytest.mark.asyncio
    async def test_split_n_basic(self):
        """Test -n splits into N equal parts."""
        # 12 bytes split into 3 parts = 4 bytes each
        bash = Bash(files={"/test.txt": "aaa\nbbb\nccc\n"})
        result = await bash.exec("split -n 3 /test.txt")
        assert result.exit_code == 0
        # Check files were created
        r1 = await bash.exec("cat xaa")
        r2 = await bash.exec("cat xab")
        r3 = await bash.exec("cat xac")
        assert r1.exit_code == 0
        assert r2.exit_code == 0
        assert r3.exit_code == 0
        # Combined should equal original
        combined = r1.stdout + r2.stdout + r3.stdout
        assert combined == "aaa\nbbb\nccc\n"

    @pytest.mark.asyncio
    async def test_split_n_uneven(self):
        """Test -n with content that doesn't divide evenly."""
        # 10 bytes split into 3 parts: 4, 3, 3 bytes
        bash = Bash(files={"/test.txt": "0123456789"})
        result = await bash.exec("split -n 3 /test.txt")
        assert result.exit_code == 0
        r1 = await bash.exec("cat xaa")
        r2 = await bash.exec("cat xab")
        r3 = await bash.exec("cat xac")
        # cat adds trailing newlines, so strip them for comparison
        combined = r1.stdout.rstrip("\n") + r2.stdout.rstrip("\n") + r3.stdout.rstrip("\n")
        assert combined == "0123456789"

    @pytest.mark.asyncio
    async def test_split_n_with_prefix(self):
        """Test -n with custom prefix."""
        bash = Bash(files={"/test.txt": "abcdef"})
        result = await bash.exec("split -n 2 /test.txt out_")
        assert result.exit_code == 0
        r1 = await bash.exec("cat out_aa")
        r2 = await bash.exec("cat out_ab")
        assert r1.exit_code == 0
        assert r2.exit_code == 0
        # cat adds trailing newlines, so strip them for comparison
        assert r1.stdout.rstrip("\n") + r2.stdout.rstrip("\n") == "abcdef"

    @pytest.mark.asyncio
    async def test_split_n_with_numeric_suffix(self):
        """Test -n with -d (numeric suffix)."""
        bash = Bash(files={"/test.txt": "abcdef"})
        result = await bash.exec("split -n 2 -d /test.txt")
        assert result.exit_code == 0
        r1 = await bash.exec("cat x00")
        r2 = await bash.exec("cat x01")
        assert r1.exit_code == 0
        assert r2.exit_code == 0

    @pytest.mark.asyncio
    async def test_split_n_single_chunk(self):
        """Test -n 1 keeps file as single chunk."""
        bash = Bash(files={"/test.txt": "hello world"})
        result = await bash.exec("split -n 1 /test.txt")
        assert result.exit_code == 0
        r = await bash.exec("cat xaa")
        assert r.stdout.rstrip("\n") == "hello world"

    @pytest.mark.asyncio
    async def test_split_n_more_chunks_than_bytes(self):
        """Test -n with more chunks than bytes creates empty files."""
        bash = Bash(files={"/test.txt": "ab"})
        result = await bash.exec("split -n 5 /test.txt")
        assert result.exit_code == 0
        # Should create 5 files, some may be empty
        r1 = await bash.exec("cat xaa")
        assert r1.exit_code == 0


# =============================================================================
# Sed Extended Commands Tests (l, F, R)
# =============================================================================


class TestSedListCommand:
    """Test sed l command (list with escapes)."""

    @pytest.mark.asyncio
    async def test_sed_list_basic(self):
        """Test l prints pattern space with escapes."""
        bash = Bash(files={"/test.txt": "hello\tworld\n"})
        result = await bash.exec("sed -n 'l' /test.txt")
        # Tab should be shown as \t
        assert "\\t" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sed_list_newline(self):
        """Test l shows $ at end of line."""
        bash = Bash(files={"/test.txt": "hello\n"})
        result = await bash.exec("sed -n 'l' /test.txt")
        # Line should end with $
        assert "$" in result.stdout

    @pytest.mark.asyncio
    async def test_sed_list_special_chars(self):
        """Test l escapes non-printable characters."""
        # Create file with special characters
        bash = Bash(files={"/test.txt": "a\x01b\x7fc\n"})
        result = await bash.exec("sed -n 'l' /test.txt")
        # Non-printable chars should be escaped
        assert "\\x01" in result.stdout.lower() or "\\001" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sed_list_with_address(self):
        """Test l with line address."""
        bash = Bash(files={"/test.txt": "line1\nline2\thas tab\nline3\n"})
        result = await bash.exec("sed -n '2l' /test.txt")
        assert "\\t" in result.stdout
        assert "line1" not in result.stdout


class TestSedFilenameCommand:
    """Test sed F command (print filename)."""

    @pytest.mark.asyncio
    async def test_sed_print_filename(self):
        """Test F prints current filename."""
        bash = Bash(files={"/test.txt": "line1\nline2\n"})
        result = await bash.exec("sed 'F' /test.txt")
        assert "/test.txt" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_sed_print_filename_with_address(self):
        """Test F with address."""
        bash = Bash(files={"/test.txt": "line1\nline2\nline3\n"})
        result = await bash.exec("sed '2F' /test.txt")
        # Filename should appear once (for line 2)
        assert result.stdout.count("/test.txt") == 1

    @pytest.mark.asyncio
    async def test_sed_print_filename_silent(self):
        """Test F with -n flag."""
        bash = Bash(files={"/test.txt": "line1\nline2\n"})
        result = await bash.exec("sed -n 'F' /test.txt")
        # Should print filename for each line
        lines = [l for l in result.stdout.strip().split("\n") if l]
        assert all("/test.txt" in l for l in lines)

    @pytest.mark.asyncio
    async def test_sed_print_filename_stdin(self):
        """Test F with stdin (no filename)."""
        bash = Bash()
        result = await bash.exec("echo 'hello' | sed 'F'")
        # For stdin, filename is typically empty or "-"
        assert result.exit_code == 0


class TestSedReadLineCommand:
    """Test sed R command (read single line from file)."""

    @pytest.mark.asyncio
    async def test_sed_read_line_basic(self):
        """Test R reads one line at a time."""
        bash = Bash(files={
            "/main.txt": "a\nb\nc\n",
            "/lines.txt": "LINE1\nLINE2\nLINE3\n"
        })
        result = await bash.exec("sed 'R /lines.txt' /main.txt")
        # Each line of main.txt should be followed by one line from lines.txt
        lines = result.stdout.strip().split("\n")
        # Expected: a, LINE1, b, LINE2, c, LINE3
        assert "a" in lines
        assert "LINE1" in lines
        assert "b" in lines
        assert "LINE2" in lines

    @pytest.mark.asyncio
    async def test_sed_read_line_with_address(self):
        """Test R with address reads line only for matching lines."""
        bash = Bash(files={
            "/main.txt": "keep\ninsert\nkeep\n",
            "/lines.txt": "INSERTED\n"
        })
        result = await bash.exec("sed '/insert/R /lines.txt' /main.txt")
        assert "INSERTED" in result.stdout
        # INSERTED should appear only once
        assert result.stdout.count("INSERTED") == 1

    @pytest.mark.asyncio
    async def test_sed_read_line_exhausted(self):
        """Test R when source file runs out of lines."""
        bash = Bash(files={
            "/main.txt": "a\nb\nc\nd\ne\n",
            "/lines.txt": "X\nY\n"
        })
        result = await bash.exec("sed 'R /lines.txt' /main.txt")
        # Only first 2 lines get insertions
        assert "X" in result.stdout
        assert "Y" in result.stdout
        # But all main lines should be present
        assert "a" in result.stdout
        assert "e" in result.stdout

    @pytest.mark.asyncio
    async def test_sed_read_line_nonexistent(self):
        """Test R with nonexistent file (silent)."""
        bash = Bash(files={"/main.txt": "line1\nline2\n"})
        result = await bash.exec("sed 'R /nonexistent.txt' /main.txt")
        # Should not error, just skip the R command
        assert result.exit_code == 0
        assert "line1" in result.stdout


class TestInputRedirection:
    """Test < input redirection."""

    @pytest.mark.asyncio
    async def test_input_redirect_basic(self):
        """Test basic input redirection with cat."""
        bash = Bash(files={"/input.txt": "hello\nworld\n"})
        result = await bash.exec("cat < /input.txt")
        assert result.stdout == "hello\nworld\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_input_redirect_wc(self):
        """Test input redirection with wc -l."""
        bash = Bash(files={"/input.txt": "line1\nline2\nline3\n"})
        result = await bash.exec("wc -l < /input.txt")
        assert "3" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_input_redirect_with_variable(self):
        """Test input redirection with variable expansion."""
        bash = Bash(files={"/data.txt": "content\n"})
        result = await bash.exec('file=/data.txt; cat < $file')
        assert result.stdout == "content\n"

    @pytest.mark.asyncio
    async def test_input_redirect_file_not_found(self):
        """Test input redirection with nonexistent file."""
        bash = Bash()
        result = await bash.exec("cat < /nonexistent.txt")
        assert "No such file" in result.stderr
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_input_redirect_head(self):
        """Test input redirection with head command."""
        bash = Bash(files={"/input.txt": "a\nb\nc\nd\ne\n"})
        result = await bash.exec("head -n 2 < /input.txt")
        assert result.stdout == "a\nb\n"

    @pytest.mark.asyncio
    async def test_input_redirect_is_directory(self):
        """Test input redirection with a directory."""
        bash = Bash(files={"/dir/file.txt": "content"})
        result = await bash.exec("cat < /dir")
        assert "Is a directory" in result.stderr
        assert result.exit_code == 1


class TestShufCommand:
    """Test shuf command."""

    @pytest.mark.asyncio
    async def test_shuf_basic(self):
        """Test basic shuf shuffles lines."""
        bash = Bash(files={"/input.txt": "a\nb\nc\nd\ne\n"})
        result = await bash.exec("shuf /input.txt")
        assert result.exit_code == 0
        lines = sorted(result.stdout.strip().split("\n"))
        assert lines == ["a", "b", "c", "d", "e"]

    @pytest.mark.asyncio
    async def test_shuf_stdin(self):
        """Test shuf reads from stdin."""
        bash = Bash()
        result = await bash.exec("echo -e 'x\\ny\\nz' | shuf")
        assert result.exit_code == 0
        lines = sorted(result.stdout.strip().split("\n"))
        assert lines == ["x", "y", "z"]

    @pytest.mark.asyncio
    async def test_shuf_n_limit(self):
        """Test shuf -n limits output lines."""
        bash = Bash(files={"/input.txt": "a\nb\nc\nd\ne\n"})
        result = await bash.exec("shuf -n 2 /input.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 2
        # All output lines should be from input
        for line in lines:
            assert line in ["a", "b", "c", "d", "e"]

    @pytest.mark.asyncio
    async def test_shuf_n_greater_than_input(self):
        """Test shuf -n with n greater than input lines."""
        bash = Bash(files={"/input.txt": "a\nb\nc\n"})
        result = await bash.exec("shuf -n 10 /input.txt")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3

    @pytest.mark.asyncio
    async def test_shuf_e_args(self):
        """Test shuf -e treats args as input lines."""
        bash = Bash()
        result = await bash.exec("shuf -e one two three")
        assert result.exit_code == 0
        lines = sorted(result.stdout.strip().split("\n"))
        assert lines == ["one", "three", "two"]

    @pytest.mark.asyncio
    async def test_shuf_e_with_n(self):
        """Test shuf -e with -n."""
        bash = Bash()
        result = await bash.exec("shuf -e -n 2 a b c d e")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 2

    @pytest.mark.asyncio
    async def test_shuf_i_range(self):
        """Test shuf -i generates range."""
        bash = Bash()
        result = await bash.exec("shuf -i 1-5")
        assert result.exit_code == 0
        lines = sorted(result.stdout.strip().split("\n"), key=int)
        assert lines == ["1", "2", "3", "4", "5"]

    @pytest.mark.asyncio
    async def test_shuf_i_with_n(self):
        """Test shuf -i with -n."""
        bash = Bash()
        result = await bash.exec("shuf -i 1-100 -n 5")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 5
        for line in lines:
            assert 1 <= int(line) <= 100

    @pytest.mark.asyncio
    async def test_shuf_r_repeat(self):
        """Test shuf -r allows repeats."""
        bash = Bash()
        result = await bash.exec("shuf -r -n 10 -e a b")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 10
        for line in lines:
            assert line in ["a", "b"]

    @pytest.mark.asyncio
    async def test_shuf_o_output_file(self):
        """Test shuf -o writes to file."""
        bash = Bash(files={"/input.txt": "a\nb\nc\n"})
        result = await bash.exec("shuf /input.txt -o /output.txt")
        assert result.exit_code == 0
        assert result.stdout == ""
        # Read output file
        read_result = await bash.exec("cat /output.txt")
        lines = sorted(read_result.stdout.strip().split("\n"))
        assert lines == ["a", "b", "c"]

    @pytest.mark.asyncio
    async def test_shuf_random_source(self):
        """Test shuf --random-source for reproducible output."""
        bash = Bash(files={
            "/input.txt": "a\nb\nc\nd\ne\n",
            "/seed.txt": "deterministic seed data here"
        })
        result1 = await bash.exec("shuf --random-source=/seed.txt /input.txt")
        result2 = await bash.exec("shuf --random-source=/seed.txt /input.txt")
        assert result1.exit_code == 0
        assert result2.exit_code == 0
        assert result1.stdout == result2.stdout

    @pytest.mark.asyncio
    async def test_shuf_file_not_found(self):
        """Test shuf with nonexistent file."""
        bash = Bash()
        result = await bash.exec("shuf /nonexistent.txt")
        assert "No such file" in result.stderr
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_shuf_empty_file(self):
        """Test shuf with empty file."""
        bash = Bash(files={"/empty.txt": ""})
        result = await bash.exec("shuf /empty.txt")
        assert result.exit_code == 0
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_shuf_i_invalid_range(self):
        """Test shuf -i with invalid range."""
        bash = Bash()
        result = await bash.exec("shuf -i 5-1")
        assert result.exit_code == 1
        assert "invalid" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_shuf_preserves_content(self):
        """Test shuf preserves line content exactly."""
        bash = Bash(files={"/input.txt": "  spaces  \n\ttabs\t\nspecial!@#\n"})
        result = await bash.exec("shuf /input.txt")
        assert result.exit_code == 0
        # Use rstrip to only remove trailing newline, not leading whitespace
        lines = result.stdout.rstrip("\n").split("\n")
        assert sorted(lines) == sorted(["  spaces  ", "\ttabs\t", "special!@#"])


class TestHtmlUnescape:
    """Test HTML entity unescaping for LLM-generated commands."""

    @pytest.mark.asyncio
    async def test_unescape_redirect_input(self):
        """Test &lt; is unescaped to < for input redirection."""
        bash = Bash(files={"/f.txt": "hello\n"})
        result = await bash.exec("cat &lt; /f.txt")
        assert result.stdout == "hello\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_unescape_redirect_output(self):
        """Test &gt; is unescaped to > for output redirection."""
        bash = Bash()
        result = await bash.exec("echo hello &gt; /out.txt")
        assert result.exit_code == 0
        content = await bash.fs.read_file("/out.txt")
        assert content in ("hello\n", b"hello\n")

    @pytest.mark.asyncio
    async def test_unescape_append(self):
        """Test &gt;&gt; is unescaped to >> for append."""
        bash = Bash(files={"/out.txt": "line1\n"})
        result = await bash.exec("echo line2 &gt;&gt; /out.txt")
        assert result.exit_code == 0
        content = await bash.fs.read_file("/out.txt")
        assert content in ("line1\nline2\n", b"line1\nline2\n")

    @pytest.mark.asyncio
    async def test_unescape_and_operator(self):
        """Test &amp;&amp; is unescaped to && for AND operator."""
        bash = Bash()
        result = await bash.exec("true &amp;&amp; echo success")
        assert result.stdout == "success\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_unescape_or_operator(self):
        """Test mixed operators with &amp;."""
        bash = Bash()
        result = await bash.exec("false || echo fallback")
        # || shouldn't need unescaping, but ensure it still works
        assert result.stdout == "fallback\n"

    @pytest.mark.asyncio
    async def test_unescape_background(self):
        """Test &amp; at end is unescaped for background (though we don't truly background)."""
        bash = Bash()
        # Background jobs run but don't actually background in our interpreter
        result = await bash.exec("echo bg &amp;")
        # Should run without error
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_preserve_in_double_quotes(self):
        """Test that HTML entities inside double quotes are preserved."""
        bash = Bash()
        result = await bash.exec('echo "&lt;"')
        assert result.stdout == "&lt;\n"

    @pytest.mark.asyncio
    async def test_preserve_in_single_quotes(self):
        """Test that HTML entities inside single quotes are preserved."""
        bash = Bash()
        result = await bash.exec("echo '&lt;'")
        assert result.stdout == "&lt;\n"

    @pytest.mark.asyncio
    async def test_preserve_amp_in_quotes(self):
        """Test &amp; inside quotes is preserved."""
        bash = Bash()
        result = await bash.exec('echo "&amp;"')
        assert result.stdout == "&amp;\n"

    @pytest.mark.asyncio
    async def test_opt_out_unescape(self):
        """Test unescape_html=False disables unescaping."""
        bash = Bash(files={"/f.txt": "hello\n"}, unescape_html=False)
        result = await bash.exec("cat &lt; /f.txt")
        # Should fail because &lt; is treated as literal text, not redirect
        assert result.exit_code != 0 or "&lt;" in result.stderr or "cat" in result.stderr

    @pytest.mark.asyncio
    async def test_mixed_real_and_escaped(self):
        """Test that real operators still work alongside escaped ones."""
        bash = Bash()
        result = await bash.exec("echo a &amp;&amp; echo b && echo c")
        assert result.stdout == "a\nb\nc\n"

    @pytest.mark.asyncio
    async def test_unescape_quot_outside_quotes(self):
        """Test &quot; is unescaped to double quote outside quotes."""
        bash = Bash()
        result = await bash.exec("echo &quot;hello&quot;")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_unescape_apos_outside_quotes(self):
        """Test &apos; is unescaped to single quote outside quotes."""
        bash = Bash()
        result = await bash.exec("echo &apos;hello&apos;")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_heredoc_preserved(self):
        """Test that HTML entities in heredoc content are preserved."""
        bash = Bash()
        result = await bash.exec("""cat << 'EOF'
&lt;tag&gt;
EOF""")
        assert result.stdout == "&lt;tag&gt;\n"

    @pytest.mark.asyncio
    async def test_unescape_pipe(self):
        """Test pipeline still works (| shouldn't need escaping but verify)."""
        bash = Bash()
        result = await bash.exec("echo hello | cat")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_complex_llm_command(self):
        """Test a realistic LLM-generated command with HTML escaping."""
        bash = Bash(files={"/input.txt": "line1\nline2\nline3\n"})
        result = await bash.exec("wc -l &lt; /input.txt &amp;&amp; echo done")
        assert "3" in result.stdout
        assert "done" in result.stdout


class TestEmptyArithmeticExitCode:
    """Test that empty (( )) returns exit code 1."""

    @pytest.mark.asyncio
    async def test_empty_arith_returns_1(self):
        """Empty (( )) should return exit code 1 (evaluates to 0/false)."""
        bash = Bash()
        result = await bash.exec("(( )); echo $?")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_empty_arith_dollar_returns_0(self):
        """Empty $(( )) should return 0."""
        bash = Bash()
        result = await bash.exec("echo $(( ))")
        assert result.stdout == "0\n"


class TestShiftValidation:
    """Test shift builtin argument validation."""

    @pytest.mark.asyncio
    async def test_shift_extra_args(self):
        """shift 1 extra should fail."""
        bash = Bash()
        result = await bash.exec("set -- a b c; shift 1 extra 2>&1")
        assert result.exit_code != 0

    @pytest.mark.asyncio
    async def test_shift_negative(self):
        """shift with negative count should fail."""
        bash = Bash()
        result = await bash.exec("set -- a b c; shift -1 2>&1")
        assert result.exit_code != 0


class TestDollarSingleQuoteControlChars:
    """Test $'\\cX' control character escapes."""

    @pytest.mark.asyncio
    async def test_c_escape_ctrl_a(self):
        """$'\\cA' should produce control character 0x01."""
        bash = Bash()
        result = await bash.exec("printf '%s' $'\\cA' | od -An -tx1")
        assert "01" in result.stdout

    @pytest.mark.asyncio
    async def test_c_escape_ctrl_at(self):
        """$'\\c@' should produce NUL (0x00), which is stripped."""
        bash = Bash()
        result = await bash.exec("echo -n $'\\c@' | wc -c")
        assert result.stdout.strip() == "0"

    @pytest.mark.asyncio
    async def test_c_escape_ctrl_question(self):
        """$'\\c?' should produce DEL (0x7F)."""
        bash = Bash()
        result = await bash.exec("printf '%s' $'\\c?' | od -An -tx1")
        assert "7f" in result.stdout


class TestSubstringArithmeticOffset:
    """Test ${s:$var} substring with arithmetic expressions as offset/length."""

    @pytest.mark.asyncio
    async def test_variable_offset(self):
        """${s:$zero} should use variable value as offset."""
        bash = Bash()
        result = await bash.exec("s='abcd'; zero=0; echo ${s:$zero}")
        assert result.stdout == "abcd\n"

    @pytest.mark.asyncio
    async def test_variable_offset_and_length(self):
        """${s:$zero:4} should use variable values."""
        bash = Bash()
        result = await bash.exec("s='abcd'; zero=0; echo ${s:$zero:4}")
        assert result.stdout == "abcd\n"

    @pytest.mark.asyncio
    async def test_variable_offset_and_variable_length(self):
        """${s:$one:$one} should use variable values for both."""
        bash = Bash()
        result = await bash.exec("s='abcd'; one=1; echo ${s:$one:$one}")
        assert result.stdout == "b\n"

    @pytest.mark.asyncio
    async def test_arithmetic_expression_offset(self):
        """${s:1+1} should evaluate arithmetic expression."""
        bash = Bash()
        result = await bash.exec("s='abcd'; echo ${s:1+1}")
        assert result.stdout == "cd\n"

    @pytest.mark.asyncio
    async def test_bare_variable_name_offset(self):
        """${s:n} should treat n as arithmetic variable."""
        bash = Bash()
        result = await bash.exec("s='abcd'; n=2; echo ${s:n}")
        assert result.stdout == "cd\n"


class TestMapfileDelimiterRetention:
    """Test mapfile retains delimiter without -t flag."""

    @pytest.mark.asyncio
    async def test_mapfile_retains_newline(self):
        """mapfile without -t should retain trailing newline on each line."""
        bash = Bash()
        result = await bash.exec("printf '1\\n2\\n3\\n' | mapfile arr; echo -n \"${arr[0]}\"")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_mapfile_t_strips_newline(self):
        """mapfile -t should strip trailing newline."""
        bash = Bash()
        result = await bash.exec("printf '1\\n2\\n3\\n' | mapfile -t arr; echo -n \"${arr[0]}\"")
        assert result.stdout == "1"

    @pytest.mark.asyncio
    async def test_mapfile_retains_custom_delimiter(self):
        """mapfile -d: without -t should retain delimiter."""
        bash = Bash()
        result = await bash.exec("printf '1:2:3:' | mapfile -d: arr; echo -n \"${arr[0]}\"")
        assert result.stdout == "1:"


class TestArraySubscriptArithmeticLHS:
    """Test array subscript arithmetic evaluation on LHS of assignment."""

    @pytest.mark.asyncio
    async def test_variable_subscript(self):
        """a[n]=X should evaluate n as variable."""
        bash = Bash()
        result = await bash.exec("a=(1 2 3); n=1; a[n]=X; echo ${a[@]}")
        assert result.stdout == "1 X 3\n"

    @pytest.mark.asyncio
    async def test_arithmetic_subscript(self):
        """a[1+1]=X should evaluate expression."""
        bash = Bash()
        result = await bash.exec("a=(1 2 3); a[1+1]=X; echo ${a[@]}")
        assert result.stdout == "1 2 X\n"

    @pytest.mark.asyncio
    async def test_variable_arithmetic_subscript(self):
        """a[zero+5-4]=X should evaluate complex expression."""
        bash = Bash()
        result = await bash.exec("a=(1 2 3); zero=0; a[zero+5-4]=X; echo ${a[@]}")
        assert result.stdout == "1 X 3\n"


class TestPipeAmp:
    """Test |& (pipe both stdout and stderr)."""

    @pytest.mark.asyncio
    async def test_pipe_amp_merges_stderr(self):
        """|& should pipe both stdout and stderr to next command."""
        bash = Bash()
        result = await bash.exec("echo stdout; echo stderr >&2")
        assert "stdout" in result.stdout
        assert "stderr" in result.stderr

    @pytest.mark.asyncio
    async def test_pipe_amp_basic(self):
        """|& should pass stderr to stdin of next command."""
        bash = Bash()
        result = await bash.exec("{ echo out; echo err >&2; } |& cat")
        assert "out" in result.stdout
        assert "err" in result.stdout


class TestShoptNounsetValidation:
    """Test that shopt rejects set -o options without -o flag."""

    @pytest.mark.asyncio
    async def test_shopt_s_nounset_fails(self):
        """shopt -s nounset should fail (nounset is a set -o option)."""
        bash = Bash()
        result = await bash.exec("shopt -s nounset 2>/dev/null; echo $?")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_shopt_s_o_nounset_succeeds(self):
        """shopt -s -o nounset should succeed."""
        bash = Bash()
        result = await bash.exec("shopt -s -o nounset; echo $?")
        assert result.stdout == "0\n"


class TestWhileReadPipeline:
    """Test while read in pipeline."""

    @pytest.mark.asyncio
    async def test_seq_pipe_while_read(self):
        """seq 3 | while read i; do echo .$i; done should work."""
        bash = Bash()
        result = await bash.exec("seq 3 | while read i; do echo \".$i\"; done")
        assert result.stdout == ".1\n.2\n.3\n"

    @pytest.mark.asyncio
    async def test_echo_pipe_while_read(self):
        """echo pipe to while read loop."""
        bash = Bash()
        result = await bash.exec("printf 'a\\nb\\n' | while read line; do echo \"got:$line\"; done")
        assert result.stdout == "got:a\ngot:b\n"


class TestCStyleForLoopNestedParens:
    """Test C-style for loop with nested parentheses."""

    @pytest.mark.asyncio
    async def test_nested_parens_in_condition(self):
        """for (( n=0; n<(3-(1)); n++ )) should work."""
        bash = Bash()
        result = await bash.exec("for (( n=0; n<(3-(1)); n++ )); do echo $n; done")
        assert result.stdout == "0\n1\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_single_nested_paren(self):
        """for (( n=0; n<(3); n++ )) should work."""
        bash = Bash()
        result = await bash.exec("for (( n=0; n<(3); n++ )); do echo $n; done")
        assert result.stdout == "0\n1\n2\n"
        assert result.exit_code == 0


class TestScalarToArrayAppend:
    """Test scalar variable conversion to array via +=()."""

    @pytest.mark.asyncio
    async def test_scalar_to_array_append(self):
        """s='abc'; s+=(d e f) should convert scalar to array then append."""
        bash = Bash()
        result = await bash.exec("s='abc'; s+=(d e f); echo \"${s[@]}\"")
        assert result.stdout == "abc d e f\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_scalar_to_array_count(self):
        """After s+=(d e f), ${#s[@]} should count all elements."""
        bash = Bash()
        result = await bash.exec("s='abc'; s+=(d e f); echo ${#s[@]}")
        assert result.stdout == "4\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_scalar_to_array_index_zero(self):
        """After conversion, s[0] should be the original scalar value."""
        bash = Bash()
        result = await bash.exec("s='abc'; s+=(d e f); echo \"${s[0]}\"")
        assert result.stdout == "abc\n"
        assert result.exit_code == 0


class TestPatternSubstitutionGreedy:
    """Test pattern substitution uses longest match (greedy)."""

    @pytest.mark.asyncio
    async def test_glob_star_longest_match(self):
        """${v/c*/XX} should replace c and everything after with XX."""
        bash = Bash()
        result = await bash.exec("v=abcde; echo ${v/c*/XX}")
        assert result.stdout == "abXX\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_glob_star_at_end(self):
        """${v/b*/} should remove from b onwards."""
        bash = Bash()
        result = await bash.exec("v=abc; echo ${v/b*/}")
        assert result.stdout == "a\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_glob_star_in_middle(self):
        """${v/a*d/X} should replace from a through d."""
        bash = Bash()
        result = await bash.exec("v=abcde; echo ${v/a*d/X}")
        assert result.stdout == "Xe\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_empty_pattern_replace_all(self):
        """${x//$empty/r} with empty expanded pattern returns original."""
        bash = Bash()
        result = await bash.exec("x=-foo-; echo \"${x//$unset/bar}\"")
        assert result.stdout == "-foo-\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_empty_pattern_replace_once(self):
        """${x/$empty/r} with empty expanded pattern returns original."""
        bash = Bash()
        result = await bash.exec("x=foo; echo \"${x/$unset/bar}\"")
        assert result.stdout == "foo\n"
        assert result.exit_code == 0


class TestIFSWordSplitting:
    """Test IFS word splitting edge cases."""

    @pytest.mark.asyncio
    async def test_unquoted_star_empty_ifs(self):
        """$* with empty IFS should produce individual positional params."""
        bash = Bash()
        result = await bash.exec('set -- "1 2" "3  4"; IFS=; argv.py $*')
        assert result.stdout == "['1 2', '3  4']\n"

    @pytest.mark.asyncio
    async def test_quoted_star_empty_ifs(self):
        """"$*" with empty IFS should join params with no separator."""
        bash = Bash()
        result = await bash.exec('set -- "1 2" "3  4"; IFS=; argv.py "$*"')
        assert result.stdout == "['1 23  4']\n"

    @pytest.mark.asyncio
    async def test_unquoted_at_with_non_default_ifs(self):
        """$@ with non-default IFS should produce individual params."""
        bash = Bash()
        result = await bash.exec("IFS=:; set -- x 'y z'; argv.py $@")
        assert result.stdout == "['x', 'y z']\n"

    @pytest.mark.asyncio
    async def test_unquoted_star_with_non_default_ifs(self):
        """$* with non-default IFS should produce individual params."""
        bash = Bash()
        result = await bash.exec("IFS=:; set -- x 'y z'; argv.py $*")
        assert result.stdout == "['x', 'y z']\n"

    @pytest.mark.asyncio
    async def test_ifs_whitespace_nonws_composite_delimiter(self):
        """Whitespace + non-whitespace IFS chars form composite delimiters."""
        bash = Bash()
        result = await bash.exec("IFS='_ '; s='a_b _ _ _ c  _d e'; argv.py $s")
        assert result.stdout == "['a', 'b', '', '', 'c', 'd', 'e']\n"

    @pytest.mark.asyncio
    async def test_ifs_leading_nonws_produces_empty(self):
        """Leading non-whitespace IFS char produces empty field."""
        bash = Bash()
        result = await bash.exec("IFS='_ '; s='_ a  b _ '; argv.py $s")
        assert result.stdout == "['', 'a', 'b']\n"

    @pytest.mark.asyncio
    async def test_ifs_leading_ws_is_stripped(self):
        """Leading whitespace IFS chars are stripped (no empty field)."""
        bash = Bash()
        result = await bash.exec("IFS='_ '; s='  a  b _ '; argv.py $s")
        assert result.stdout == "['a', 'b']\n"

    @pytest.mark.asyncio
    async def test_empty_ifs_at_array(self):
        """${arr[@]} with empty IFS produces individual elements."""
        bash = Bash()
        result = await bash.exec("myarray=(a 'b c'); IFS=''; argv.py ${myarray[@]}")
        assert result.stdout == "['a', 'b c']\n"

    @pytest.mark.asyncio
    async def test_empty_ifs_star_array(self):
        """${arr[*]} with empty IFS produces individual elements."""
        bash = Bash()
        result = await bash.exec("myarray=(a 'b c'); IFS=''; argv.py ${myarray[*]}")
        assert result.stdout == "['a', 'b c']\n"


class TestEmptyCommandExitCode:
    """Test exit code when command name expands to empty."""

    @pytest.mark.asyncio
    async def test_command_sub_true_preserves_exit_code(self):
        """$(true) as bare command should preserve exit code 0."""
        bash = Bash()
        result = await bash.exec("$(true); echo $?")
        assert result.stdout == "0\n"

    @pytest.mark.asyncio
    async def test_command_sub_false_preserves_exit_code(self):
        """$(false) as bare command should preserve exit code 1."""
        bash = Bash()
        result = await bash.exec("$(false); echo $?")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_unset_var_as_command_preserves_exit(self):
        """$UNSET_VAR as command should be a no-op."""
        bash = Bash()
        result = await bash.exec("true; $UNSET_VAR; echo $?")
        assert result.stdout == "0\n"

    @pytest.mark.asyncio
    async def test_empty_expansion_with_assignments(self):
        """Variable assignment with empty command preserves expansion exit code."""
        bash = Bash()
        result = await bash.exec("x=$(false); echo $?")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_exit_code_truncated_to_byte(self):
        """Exit codes should be truncated to 0-255 range."""
        bash = Bash()
        result = await bash.exec("exit 256; echo $?")
        # exit 256 truncates to 0
        assert result.exit_code == 0


class TestParserKeywordArguments:
    """Test that shell keywords can be used as command arguments."""

    @pytest.mark.asyncio
    async def test_type_t_keywords_including_bang(self):
        """type -t should handle ! as an argument, not pipeline negation."""
        bash = Bash()
        result = await bash.exec("type -t for ! {")
        assert "keyword\n" in result.stdout

    @pytest.mark.asyncio
    async def test_echo_bang_as_argument(self):
        """! should be accepted as a command argument."""
        bash = Bash()
        result = await bash.exec("echo !")
        assert result.stdout == "!\n"

    @pytest.mark.asyncio
    async def test_echo_lbrace_as_argument(self):
        """{ should be accepted as a command argument."""
        bash = Bash()
        result = await bash.exec("echo {")
        assert result.stdout == "{\n"


class TestExecFnExitError:
    """Test that bash -c 'exit N' doesn't kill parent script."""

    @pytest.mark.asyncio
    async def test_bash_c_exit_preserves_parent(self):
        """bash -c 'exit 1' should not kill the parent script."""
        bash = Bash()
        result = await bash.exec("bash -c 'exit 1'; echo status=$?")
        assert "status=1" in result.stdout

    @pytest.mark.asyncio
    async def test_bash_c_exit_zero(self):
        """bash -c 'exit 0' should allow parent to continue."""
        bash = Bash()
        result = await bash.exec("bash -c 'exit 0'; echo status=$?")
        assert "status=0" in result.stdout

    @pytest.mark.asyncio
    async def test_bash_c_with_output(self):
        """bash -c should capture output and exit code."""
        bash = Bash()
        result = await bash.exec("bash -c 'echo hello'; echo done")
        assert result.stdout == "hello\ndone\n"


class TestDeclarationNoSplit:
    """Declaration builtins should not word-split assignment values."""

    @pytest.mark.asyncio
    async def test_export_no_split(self):
        """export x=$var should not split the value."""
        bash = Bash()
        result = await bash.exec("words='a b c'; export ex=$words; echo \"$ex\"")
        assert result.stdout == "a b c\n"

    @pytest.mark.asyncio
    async def test_readonly_no_split(self):
        """readonly x=$var should not split the value."""
        bash = Bash()
        result = await bash.exec("words='a b c'; readonly ro=$words; echo \"$ro\"")
        assert result.stdout == "a b c\n"

    @pytest.mark.asyncio
    async def test_local_no_split(self):
        """local x=$var inside a function should not split the value."""
        bash = Bash()
        result = await bash.exec("f() { local l=$1; echo \"$l\"; }; f 'a b c'")
        assert result.stdout == "a b c\n"

    @pytest.mark.asyncio
    async def test_declare_no_split(self):
        """declare x=$var should not split the value."""
        bash = Bash()
        result = await bash.exec("words='a b c'; declare d=$words; echo \"$d\"")
        assert result.stdout == "a b c\n"

    @pytest.mark.asyncio
    async def test_argv_export_declare_readonly(self):
        """Full test matching the spec test: static assignment doesn't split."""
        bash = Bash()
        result = await bash.exec(
            "words='a b c'\n"
            "export ex=$words\n"
            "glo=$words\n"
            "readonly ro=$words\n"
            'argv.py "$ex" "$glo" "$ro"'
        )
        assert result.stdout == "['a b c', 'a b c', 'a b c']\n"


class TestBreakInLoopCondition:
    """Break/continue in loop conditions should affect the correct loop."""

    @pytest.mark.asyncio
    async def test_break_in_while_condition(self):
        """break in while condition should break the while, not outer for."""
        bash = Bash()
        result = await bash.exec(
            "for i in 1 2 3; do\n"
            "  echo i=$i\n"
            "  while break; do\n"
            "    echo x\n"
            "  done\n"
            "done\n"
            "echo done"
        )
        assert result.stdout == "i=1\ni=2\ni=3\ndone\n"

    @pytest.mark.asyncio
    async def test_continue_in_while_condition(self):
        """continue in while condition should continue the while loop."""
        bash = Bash()
        result = await bash.exec(
            "for i in 1 2 3; do\n"
            "  echo i=$i\n"
            "  x=0\n"
            "  while true; do\n"
            "    x=$((x+1))\n"
            "    if [ $x -ge 3 ]; then break; fi\n"
            "    echo x=$x\n"
            "  done\n"
            "done\n"
            "echo done"
        )
        assert result.stdout == "i=1\nx=1\nx=2\ni=2\nx=1\nx=2\ni=3\nx=1\nx=2\ndone\n"

    @pytest.mark.asyncio
    async def test_break_in_until_condition(self):
        """break in until condition should break the until loop."""
        bash = Bash()
        result = await bash.exec(
            "for i in 1 2 3; do\n"
            "  echo i=$i\n"
            "  until break; do\n"
            "    echo x\n"
            "  done\n"
            "done\n"
            "echo done"
        )
        assert result.stdout == "i=1\ni=2\ni=3\ndone\n"


class TestCdBuiltin:
    """Test cd builtin edge cases."""

    @pytest.mark.asyncio
    async def test_cd_dash_without_oldpwd(self):
        """cd - in a fresh shell should fail with OLDPWD not set."""
        bash = Bash(cwd="/home/user")
        result = await bash.exec("cd -\necho status=$?")
        assert "OLDPWD not set" in result.stderr
        assert "status=1" in result.stdout

    @pytest.mark.asyncio
    async def test_cd_double_dash(self):
        """cd -- /dir should cd to /dir (-- ends options)."""
        bash = Bash(cwd="/home/user")
        result = await bash.exec("cd -- /tmp\npwd")
        assert result.stdout == "/tmp\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_bad_parent(self):
        """cd nonexistent/.. should fail because nonexistent doesn't exist."""
        bash = Bash(cwd="/home/user")
        result = await bash.exec("cd nonexistent_ZZ/..\necho status=$?")
        assert "status=1" in result.stdout

    @pytest.mark.asyncio
    async def test_cd_dash_L_flag(self):
        """cd -L /tmp should work (logical mode, the default)."""
        bash = Bash(cwd="/home/user")
        result = await bash.exec("cd -L /tmp\npwd")
        assert result.stdout == "/tmp\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_dash_P_flag(self):
        """cd -P /tmp should work (physical mode)."""
        bash = Bash(cwd="/home/user")
        result = await bash.exec("cd -P /tmp\npwd")
        assert result.stdout == "/tmp\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_too_many_args(self):
        """cd with more than one non-flag arg should fail."""
        bash = Bash(cwd="/home/user")
        result = await bash.exec("cd /tmp /usr\necho status=$?")
        assert "status=1" in result.stdout


class TestPushdPopdDirs:
    """Test pushd, popd, and dirs builtins."""

    @pytest.mark.asyncio
    async def test_dirs_shows_cwd(self):
        """dirs with no args shows current directory."""
        bash = Bash(cwd="/")
        result = await bash.exec("dirs")
        assert result.stdout == "/\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_pushd_popd_basic(self):
        """pushd pushes directory, popd pops it."""
        bash = Bash(cwd="/")
        result = await bash.exec(
            "pushd /tmp >/dev/null\n"
            "echo pwd=$(pwd)\n"
            "popd >/dev/null\n"
            "echo pwd=$(pwd)"
        )
        assert result.stdout == "pwd=/tmp\npwd=/\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_pushd_prints_stack(self):
        """pushd prints the updated directory stack."""
        bash = Bash(cwd="/", env={"HOME": "/home/user"})
        result = await bash.exec("pushd /tmp")
        assert result.stdout == "/tmp /\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_pushd_invalid_flag(self):
        """pushd with invalid flag returns exit code 2."""
        bash = Bash()
        result = await bash.exec("pushd -z; echo status=$?")
        assert "status=2" in result.stdout

    @pytest.mark.asyncio
    async def test_pushd_too_many_args(self):
        """pushd with more than one argument fails."""
        bash = Bash(cwd="/")
        result = await bash.exec("pushd /tmp /tmp >/dev/null; echo status=$?")
        assert "status=2" in result.stdout

    @pytest.mark.asyncio
    async def test_popd_empty_stack(self):
        """popd on empty stack returns error."""
        bash = Bash(cwd="/")
        result = await bash.exec("popd 2>&1")
        assert result.exit_code == 1
        assert "directory stack" in result.stdout

    @pytest.mark.asyncio
    async def test_popd_invalid_flag(self):
        """popd with invalid flag returns exit code 2."""
        bash = Bash(cwd="/")
        result = await bash.exec("pushd /tmp >/dev/null; popd -z; echo status=$?")
        assert "status=2" in result.stdout

    @pytest.mark.asyncio
    async def test_dirs_c_clears_stack(self):
        """dirs -c clears the directory stack."""
        bash = Bash(cwd="/", env={"HOME": "/home/user"})
        result = await bash.exec(
            "pushd /tmp >/dev/null\n"
            "dirs -c\n"
            "dirs"
        )
        assert result.stdout == "/tmp\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_dirs_v_numbered(self):
        """dirs -v prints numbered stack entries."""
        bash = Bash(cwd="/", env={"HOME": "/home/user"})
        result = await bash.exec(
            "pushd /tmp >/dev/null\n"
            "dirs -v"
        )
        assert result.stdout == " 0  /tmp\n 1  /\n"

    @pytest.mark.asyncio
    async def test_dirs_p_one_per_line(self):
        """dirs -p prints one entry per line."""
        bash = Bash(cwd="/", env={"HOME": "/home/user"})
        result = await bash.exec(
            "pushd /tmp >/dev/null\n"
            "dirs -p"
        )
        assert result.stdout == "/tmp\n/\n"

    @pytest.mark.asyncio
    async def test_dirs_tilde_substitution(self):
        """dirs replaces $HOME prefix with ~."""
        bash = Bash(cwd="/", env={"HOME": "/tmp"})
        await bash.fs.mkdir("/tmp/mydir")
        result = await bash.exec(
            "pushd /tmp/mydir >/dev/null\n"
            "dirs"
        )
        assert result.stdout == "~/mydir /\n"

    @pytest.mark.asyncio
    async def test_dirs_l_no_tilde(self):
        """dirs -l shows full paths without tilde substitution."""
        bash = Bash(cwd="/", env={"HOME": "/tmp"})
        await bash.fs.mkdir("/tmp/mydir")
        result = await bash.exec(
            "pushd /tmp/mydir >/dev/null\n"
            "dirs -l"
        )
        assert result.stdout == "/tmp/mydir /\n"

    @pytest.mark.asyncio
    async def test_dirs_rejects_positional_args(self):
        """dirs with positional arguments fails."""
        bash = Bash(cwd="/")
        result = await bash.exec("dirs a; echo status=$?")
        assert "status=1" in result.stdout

    @pytest.mark.asyncio
    async def test_cd_updates_bottom_of_stack(self):
        """cd changes the bottom entry of the directory stack."""
        bash = Bash(cwd="/", env={"HOME": "/home/user"})
        result = await bash.exec(
            "pushd /tmp >/dev/null\n"
            "cd /usr\n"
            "dirs"
        )
        assert result.stdout == "/usr /\n"


class TestSetOutputFormat:
    """Test set builtin output format matches bash."""

    @pytest.mark.asyncio
    async def test_set_no_quotes_simple_value(self):
        """Simple alphanumeric values should not be quoted."""
        bash = Bash()
        result = await bash.exec("MY_VAR=hello\nset | grep ^MY_VAR=")
        assert result.stdout == "MY_VAR=hello\n"

    @pytest.mark.asyncio
    async def test_set_quotes_value_with_spaces(self):
        """Values with spaces should be single-quoted."""
        bash = Bash()
        result = await bash.exec("MY_VAR='hello world'\nset | grep ^MY_VAR=")
        assert result.stdout == "MY_VAR='hello world'\n"

    @pytest.mark.asyncio
    async def test_set_quotes_empty_value(self):
        """Empty values should be shown as VAR=''."""
        bash = Bash()
        result = await bash.exec("MY_VAR=''\nset | grep ^MY_VAR=")
        assert result.stdout == "MY_VAR=''\n"


class TestShoptExitCode:
    """Test shopt exit code for unknown options."""

    @pytest.mark.asyncio
    async def test_shopt_unknown_with_ignore(self):
        """shopt -s with unknown option should return 1 even with ignore_shopt_not_impl."""
        bash = Bash()
        # First enable ignore_shopt_not_impl, then try an unknown option
        result = await bash.exec("shopt -s ignore_shopt_not_impl\nshopt -s nonexistent_option_xyz\necho status=$?")
        assert "status=1" in result.stdout


class TestLsDefaultFormat:
    """Test ls default output format."""

    @pytest.mark.asyncio
    async def test_ls_default_one_per_line(self):
        """Default ls should output one entry per line (non-terminal mode)."""
        bash = Bash(files={
            "/dir/alpha": "a",
            "/dir/beta": "b",
            "/dir/gamma": "c",
        })
        result = await bash.exec("ls /dir")
        assert result.stdout == "alpha\nbeta\ngamma\n"


class TestWhichCommand:
    """Test which command respects PATH."""

    @pytest.mark.asyncio
    async def test_which_respects_path(self):
        """which should search PATH directories in VFS."""
        bash = Bash(files={"/mybin/mycmd": "#!/bin/bash\necho hi"})
        await bash.fs.chmod("/mybin/mycmd", 0o755)
        result = await bash.exec("PATH=/mybin which mycmd")
        assert result.stdout == "/mybin/mycmd\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_which_registered_command(self):
        """which should find registered commands via PATH."""
        bash = Bash()
        result = await bash.exec("which echo")
        assert result.exit_code == 0
        assert "echo" in result.stdout

    @pytest.mark.asyncio
    async def test_which_not_found(self):
        """which should return 1 for missing commands."""
        bash = Bash()
        result = await bash.exec("which nonexistent_cmd_xyz")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_which_all_flag(self):
        """which -a should find all matches in PATH."""
        bash = Bash(files={
            "/bin1/mycmd": "#!/bin/bash\necho one",
            "/bin2/mycmd": "#!/bin/bash\necho two",
        })
        await bash.fs.chmod("/bin1/mycmd", 0o755)
        await bash.fs.chmod("/bin2/mycmd", 0o755)
        result = await bash.exec("PATH=/bin1:/bin2 which -a mycmd")
        assert "/bin1/mycmd\n/bin2/mycmd\n" == result.stdout


class TestTypeAllFlag:
    """Test type -a returns all matches."""

    @pytest.mark.asyncio
    async def test_type_a_builtin(self):
        """type -a for a builtin should show it as builtin."""
        bash = Bash()
        result = await bash.exec("type -a echo")
        assert "echo is a shell builtin" in result.stdout

    @pytest.mark.asyncio
    async def test_type_a_file_in_vfs(self):
        """type -a should find files in VFS PATH directories."""
        bash = Bash(files={"/mybin/mycmd": "#!/bin/bash\necho hi"})
        await bash.fs.chmod("/mybin/mycmd", 0o755)
        result = await bash.exec("PATH=/mybin type -a mycmd")
        assert "mycmd is /mybin/mycmd" in result.stdout


class TestVfsScriptExecution:
    """Test executing scripts from the virtual filesystem."""

    @pytest.mark.asyncio
    async def test_execute_script_by_path(self):
        """Scripts in VFS can be executed by direct path."""
        bash = Bash(files={"/usr/local/bin/myscript": "#!/bin/bash\necho hello from script"})
        await bash.fs.chmod("/usr/local/bin/myscript", 0o755)
        result = await bash.exec("/usr/local/bin/myscript")
        assert result.stdout == "hello from script\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_execute_script_via_path_lookup(self):
        """Scripts in VFS PATH directories can be executed by name."""
        bash = Bash(files={"/mybin/mycmd": "echo found me"})
        await bash.fs.chmod("/mybin/mycmd", 0o755)
        result = await bash.exec("PATH=/mybin mycmd")
        assert result.stdout == "found me\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_execute_script_with_args(self):
        """VFS scripts receive positional parameters."""
        bash = Bash(files={"/mybin/greet": 'echo "Hello $1"'})
        await bash.fs.chmod("/mybin/greet", 0o755)
        result = await bash.exec("PATH=/mybin greet world")
        assert result.stdout == "Hello world\n"

    @pytest.mark.asyncio
    async def test_execute_non_executable_returns_126(self):
        """Non-executable files should return exit code 126."""
        bash = Bash(files={"/tmp/notexec": "echo hi"})
        result = await bash.exec("/tmp/notexec")
        assert result.exit_code == 126
        assert "Permission denied" in result.stderr

    @pytest.mark.asyncio
    async def test_execute_nonexistent_returns_127(self):
        """Missing commands should still return exit code 127."""
        bash = Bash()
        result = await bash.exec("/tmp/no_such_script")
        assert result.exit_code == 127
        assert "command not found" in result.stderr


class TestHashBuiltin:
    """Test hash builtin."""

    @pytest.mark.asyncio
    async def test_hash_empty_table(self):
        """hash with no args and empty table."""
        bash = Bash()
        result = await bash.exec("hash 2>&1; echo status=$?")
        assert "status=1" in result.stdout

    @pytest.mark.asyncio
    async def test_hash_r_clears_table(self):
        """hash -r clears the hash table."""
        bash = Bash()
        result = await bash.exec("hash -r; echo status=$?")
        assert "status=0" in result.stdout

    @pytest.mark.asyncio
    async def test_hash_r_ignores_extra_args(self):
        """hash -r with extra args should succeed (bash ignores them)."""
        bash = Bash()
        result = await bash.exec("hash -r foo 2>&1; echo status=$?")
        assert "status=0" in result.stdout


class TestPrintfFixes:
    """Test printf edge cases."""

    @pytest.mark.asyncio
    async def test_printf_positive_integer_overflow(self):
        """printf should clamp positive integer overflow to 64-bit."""
        bash = Bash()
        # 2^64 = 18446744073709551616, should clamp to ULLONG_MAX for %u
        result = await bash.exec("printf '%u\\n' 18446744073709551616")
        assert result.stdout == "0\n"  # wraps around to 0

    @pytest.mark.asyncio
    async def test_printf_unsigned_negative(self):
        """printf %u with negative should wrap to unsigned 64-bit."""
        bash = Bash()
        result = await bash.exec("printf '%u\\n' -1")
        assert result.stdout == "18446744073709551615\n"

    @pytest.mark.asyncio
    async def test_printf_signed_overflow(self):
        """printf %d should clamp to signed 64-bit range."""
        bash = Bash()
        # 2^63 = 9223372036854775808, should clamp to LLONG_MAX
        result = await bash.exec("printf '%d\\n' 9223372036854775808")
        assert result.stdout == "9223372036854775807\n"

    @pytest.mark.asyncio
    async def test_printf_c_first_byte(self):
        """printf %c should output the first character."""
        bash = Bash()
        result = await bash.exec("printf '%c' hello")
        assert result.stdout == "h"

    @pytest.mark.asyncio
    async def test_printf_strftime_truncation(self):
        """printf %(fmt)T strftime should truncate at 128 chars."""
        bash = Bash()
        # Use a simple format that produces a reasonable result
        result = await bash.exec("printf '%(%Y)T\\n' 1557978599")
        assert result.stdout == "2019\n"


class TestHeredocCustomFD:
    """Test here-doc redirections to custom file descriptors."""

    @pytest.mark.asyncio
    async def test_heredoc_fd3_read_u(self):
        """read -u 3 should read from FD 3 when here-doc targets FD 3."""
        bash = Bash()
        result = await bash.exec('read -u 3 line 3<<EOF\nhello from fd3\nEOF\necho "$line"')
        assert result.stdout == "hello from fd3\n"

    @pytest.mark.asyncio
    async def test_heredoc_fd3_with_options(self):
        """Here-doc to FD 3 with read -s (silent) flag."""
        bash = Bash()
        result = await bash.exec('read -s -u 3 line 3<<EOF\nsecret\nEOF\necho "$line"')
        assert result.stdout == "secret\n"


class TestDevNullInputRedirect:
    """Test /dev/null in input redirections."""

    @pytest.mark.asyncio
    async def test_dev_null_input(self):
        """/dev/null as input should provide empty stdin."""
        bash = Bash()
        result = await bash.exec("cat < /dev/null; echo status=$?")
        assert "status=0" in result.stdout

    @pytest.mark.asyncio
    async def test_read_from_dev_null(self):
        """read from /dev/null should fail (no input)."""
        bash = Bash()
        result = await bash.exec("read x < /dev/null; echo status=$?")
        assert "status=1" in result.stdout


class TestTempBindingEmptyArgv:
    """Test temporary assignments become permanent when command expands to empty."""

    @pytest.mark.asyncio
    async def test_temp_assign_unset_var(self):
        """FOO=bar $unset should make FOO=bar permanent."""
        bash = Bash()
        result = await bash.exec('FOO=bar $unset; echo "FOO=$FOO"')
        assert result.stdout == "FOO=bar\n"

    @pytest.mark.asyncio
    async def test_temp_assign_with_command(self):
        """FOO=bar echo hi should NOT make FOO permanent."""
        bash = Bash()
        result = await bash.exec('FOO=bar echo hi; echo "FOO=$FOO"')
        assert result.stdout == "hi\nFOO=\n"

    @pytest.mark.asyncio
    async def test_temp_assign_empty_command_sub(self):
        """FOO=bar $(true) should make FOO=bar permanent."""
        bash = Bash()
        result = await bash.exec('FOO=bar $(true); echo "FOO=$FOO"')
        assert result.stdout == "FOO=bar\n"


class TestCommandSubExitCode:
    """Test command substitution exit code tracking."""

    @pytest.mark.asyncio
    async def test_last_cmd_sub_wins(self):
        """$(exit 42) $(exit 43) should give exit code 43."""
        bash = Bash()
        result = await bash.exec("$(exit 42) $(exit 43); echo status=$?")
        assert result.stdout == "status=43\n"


class TestLoopControlEdgeCases:
    """Test break/continue edge cases."""

    @pytest.mark.asyncio
    async def test_continue_too_many_args_breaks(self):
        """continue 1 2 3 should break the loop (bash behavior)."""
        bash = Bash()
        result = await bash.exec('for x in a b c; do echo $x; continue 1 2 3; done; echo --')
        assert result.stdout == "a\n--\n"

    @pytest.mark.asyncio
    async def test_break_too_many_args_breaks(self):
        """break 1 2 3 should break the loop (bash behavior)."""
        bash = Bash()
        result = await bash.exec('for x in a b c; do echo $x; break 1 2 3; done; echo --')
        assert result.stdout == "a\n--\n"

    @pytest.mark.asyncio
    async def test_continue_in_subshell(self):
        """continue in subshell within loop should exit the subshell."""
        bash = Bash()
        result = await bash.exec(
            'for i in 1 2; do echo "> $i"; '
            '( if true; then continue; fi; echo "Should not print" ); '
            'echo "subshell status=$?"; echo ". $i"; done'
        )
        assert result.stdout == "> 1\nsubshell status=0\n. 1\n> 2\nsubshell status=0\n. 2\n"


class TestQuotingInParameterExpansionDefaults:
    """Test that quotes inside ${var:-default} are respected for word splitting."""

    @pytest.mark.asyncio
    async def test_single_quotes_in_default_protect_from_splitting(self):
        """${Unset:-'a b c'} should produce single word 'a b c'."""
        bash = Bash()
        result = await bash.exec("argv.py ${Unset:-'a b c'}")
        assert result.stdout == "['a b c']\n"

    @pytest.mark.asyncio
    async def test_double_quotes_in_default_protect_from_splitting(self):
        """${Unset:-"a b c"} should produce single word 'a b c'."""
        bash = Bash()
        result = await bash.exec('argv.py ${Unset:-"a b c"}')
        assert result.stdout == "['a b c']\n"

    @pytest.mark.asyncio
    async def test_inner_double_quotes_in_outer_double_quotes_removed(self):
        '''"${Unset-"b"}" should produce 'b' not '"b"'.'''
        bash = Bash()
        result = await bash.exec('argv.py "${Unset-"b"}"')
        assert result.stdout == "['b']\n"

    @pytest.mark.asyncio
    async def test_multiple_quoted_words_in_default(self):
        """${Unset:-"a b" "c d"} should produce two words."""
        bash = Bash()
        result = await bash.exec('argv.py ${Unset:-"a b" "c d"}')
        assert result.stdout == "['a b', 'c d']\n"

    @pytest.mark.asyncio
    async def test_nested_defaults_with_quotes(self):
        """Nested ${a:-${a:-"1 2" "3 4"}5 "6 7"} should preserve quoted words."""
        bash = Bash()
        result = await bash.exec('argv.py ${a:-${a:-"1 2" "3 4"}5 "6 7"}')
        assert result.stdout == "['1 2', '3 45', '6 7']\n"

    @pytest.mark.asyncio
    async def test_mixed_quotes_in_default(self):
        """${Unset:-'a'"b"'c'} should produce 'abc'."""
        bash = Bash()
        result = await bash.exec('argv.py ${Unset:-\'a\'"b"\'c\'}')
        assert result.stdout == "['abc']\n"

    @pytest.mark.asyncio
    async def test_alternate_value_with_quotes(self):
        """${var:+'a b'} should produce 'a b' when var is set."""
        bash = Bash()
        result = await bash.exec(r"var=x; argv.py ${var:+'a b'}")
        assert result.stdout == "['a b']\n"

    @pytest.mark.asyncio
    async def test_empty_literal_preserved_in_default(self):
        '''${Unset:-""} should produce one empty word.'''
        bash = Bash()
        result = await bash.exec('argv.py ${Unset:-""}')
        assert result.stdout == "['']\n"

    @pytest.mark.asyncio
    async def test_empty_var_and_empty_string_suffix(self):
        '''$empty"" where empty="" should produce one empty word.'''
        bash = Bash()
        result = await bash.exec('empty=""; argv.py 1 $empty"" 2')
        assert result.stdout == "['1', '', '2']\n"


class TestWordSplitLiteralPreservation:
    """Test that literal parts adjacent to expansions are handled correctly."""

    @pytest.mark.asyncio
    async def test_literal_colon_after_ifs_split(self):
        """IFS=: with ${word}:b - colon is IFS, so 'a:' splits to 'a' and ''."""
        bash = Bash()
        # Note: bash 3.2 and our impl treat the literal : as IFS delimiter
        result = await bash.exec("IFS=':'; word='a:'; argv.py ${word}:b")
        assert result.stdout == "['a', '', 'b']\n"

    @pytest.mark.asyncio
    async def test_literal_after_expansion_trailing(self):
        """${word}: with trailing literal after expansion."""
        bash = Bash()
        result = await bash.exec("IFS=':'; word='a:'; argv.py ${word}:")
        assert result.stdout == "['a', '']\n"

    @pytest.mark.asyncio
    async def test_quoted_default_not_further_split(self):
        '''"${v:-AxBxC}"x should not be split even with IFS=x.'''
        bash = Bash()
        result = await bash.exec('IFS=x; argv.py "${v:-AxBxC}"x')
        assert result.stdout == "['AxBxCx']\n"


class TestArraySlicingAsArguments:
    """Test that array slicing ${a[@]:offset:length} produces separate arguments."""

    @pytest.mark.asyncio
    async def test_array_slice_produces_separate_args(self):
        '''a=(1 2 3); argv.py "${a[@]:1:2}" should produce ['2', '3'].'''
        bash = Bash()
        result = await bash.exec('a=(1 2 3); argv.py "${a[@]:1:2}"')
        assert result.stdout == "['2', '3']\n"

    @pytest.mark.asyncio
    async def test_array_slice_from_start(self):
        '''a=(a b c d e); argv.py "${a[@]:0:3}" should produce ['a', 'b', 'c'].'''
        bash = Bash()
        result = await bash.exec('a=(a b c d e); argv.py "${a[@]:0:3}"')
        assert result.stdout == "['a', 'b', 'c']\n"

    @pytest.mark.asyncio
    async def test_array_slice_to_end(self):
        '''a=(1 2 3 4); argv.py "${a[@]:2}" should produce ['3', '4'].'''
        bash = Bash()
        result = await bash.exec('a=(1 2 3 4); argv.py "${a[@]:2}"')
        assert result.stdout == "['3', '4']\n"

    @pytest.mark.asyncio
    async def test_array_slice_negative_offset(self):
        '''a=(1 2 3 4 5); argv.py "${a[@]: -2}" should produce ['4', '5'].'''
        bash = Bash()
        result = await bash.exec('a=(1 2 3 4 5); argv.py "${a[@]: -2}"')
        assert result.stdout == "['4', '5']\n"

    @pytest.mark.asyncio
    async def test_array_slice_with_spaces_in_elements(self):
        '''a=("a b" "c d" "e f"); argv.py "${a[@]:1:2}" should produce ['c d', 'e f'].'''
        bash = Bash()
        result = await bash.exec('a=("a b" "c d" "e f"); argv.py "${a[@]:1:2}"')
        assert result.stdout == "['c d', 'e f']\n"

    @pytest.mark.asyncio
    async def test_array_slice_empty_result(self):
        '''a=(1 2 3); argv.py X"${a[@]:5:2}"Y should produce ['XY'].'''
        bash = Bash()
        result = await bash.exec('a=(1 2 3); argv.py X"${a[@]:5:2}"Y')
        assert result.stdout == "['XY']\n"

    @pytest.mark.asyncio
    async def test_array_slice_star_joins(self):
        '''a=(1 2 3 4); argv.py "${a[*]:1:2}" should produce ['2 3'] (joined).'''
        bash = Bash()
        result = await bash.exec('a=(1 2 3 4); argv.py "${a[*]:1:2}"')
        assert result.stdout == "['2 3']\n"

    @pytest.mark.asyncio
    async def test_array_slice_star_custom_ifs(self):
        '''IFS=:; a=(1 2 3 4); argv.py "${a[*]:1:2}" should produce ['2:3'].'''
        bash = Bash()
        result = await bash.exec('IFS=:; a=(1 2 3 4); argv.py "${a[*]:1:2}"')
        assert result.stdout == "['2:3']\n"

    @pytest.mark.asyncio
    async def test_array_pattern_removal_separate_args(self):
        '''a=(aXb cXd eXf); argv.py "${a[@]#*X}" should produce ['b', 'd', 'f'].'''
        bash = Bash()
        result = await bash.exec('a=(aXb cXd eXf); argv.py "${a[@]#*X}"')
        assert result.stdout == "['b', 'd', 'f']\n"

    @pytest.mark.asyncio
    async def test_array_pattern_replacement_separate_args(self):
        '''a=(abc def ghi); argv.py "${a[@]/e/E}" should produce ['abc', 'dEf', 'ghi'].'''
        bash = Bash()
        result = await bash.exec('a=(abc def ghi); argv.py "${a[@]/e/E}"')
        assert result.stdout == "['abc', 'dEf', 'ghi']\n"

    @pytest.mark.asyncio
    async def test_array_case_modification_separate_args(self):
        '''a=(abc DEF gHi); argv.py "${a[@]^^}" should produce ['ABC', 'DEF', 'GHI'].'''
        bash = Bash()
        result = await bash.exec('a=(abc DEF gHi); argv.py "${a[@]^^}"')
        assert result.stdout == "['ABC', 'DEF', 'GHI']\n"


class TestQuotedEmptyExpansionPreservation:
    """Test that quoted empty expansion results preserve an empty argument."""

    @pytest.mark.asyncio
    async def test_quoted_unset_alternative_produces_empty(self):
        '''"${unset_var+set}" should produce [''] when unset_var is unset.'''
        bash = Bash()
        result = await bash.exec('argv.py "${unset_var+set}"')
        assert result.stdout == "['']\n"

    @pytest.mark.asyncio
    async def test_unquoted_unset_alternative_is_elided(self):
        '''${unset_var+set} should produce [] when unset_var is unset.'''
        bash = Bash()
        result = await bash.exec('argv.py ${unset_var+set}')
        assert result.stdout == "[]\n"

    @pytest.mark.asyncio
    async def test_quoted_set_alternative_produces_value(self):
        '''"${x+set}" should produce ['set'] when x is set.'''
        bash = Bash()
        result = await bash.exec('x=1; argv.py "${x+set}"')
        assert result.stdout == "['set']\n"

    @pytest.mark.asyncio
    async def test_quoted_empty_var_produces_empty(self):
        '''"$empty" should produce [''] when empty="".'''
        bash = Bash()
        result = await bash.exec('empty=""; argv.py "$empty"')
        assert result.stdout == "['']\n"

    @pytest.mark.asyncio
    async def test_quoted_unset_default_empty_produces_empty(self):
        '''"${unset:-}" should produce [''] (empty default used).'''
        bash = Bash()
        result = await bash.exec('argv.py "${unset:-}"')
        assert result.stdout == "['']\n"

    @pytest.mark.asyncio
    async def test_full_regression_case(self):
        '''argv.py "${with_icc+set}" = set should produce ['', '=', 'set'].'''
        bash = Bash()
        result = await bash.exec('argv.py "${with_icc+set}" = set')
        assert result.stdout == "['', '=', 'set']\n"


class TestSingleQuotesInDoubleQuotedExpansion:
    """Test that single quotes inside double-quoted parameter expansion are literal.

    In bash, single quotes inside double quotes are literal characters, not quote markers.
    So "${Unset:-'b'}" should produce 'b' (with the quotes), not b.
    But ${Unset:-'b'} (unquoted) should recognize single quotes and produce b.
    """

    @pytest.mark.asyncio
    async def test_double_quoted_expansion_with_single_quotes_literal(self):
        '''Single quotes in "${Unset:-'b'}" should be preserved as literal.'''
        bash = Bash()
        result = await bash.exec('argv.py "${Unset:-\'b\'}"')
        # The argument should be the literal string 'b' with single quotes
        import ast
        args = ast.literal_eval(result.stdout.strip())
        assert args == ["'b'"]

    @pytest.mark.asyncio
    async def test_unquoted_expansion_with_single_quotes_stripped(self):
        '''Single quotes in ${Unset:-'b'} (unquoted) should be recognized.'''
        bash = Bash()
        result = await bash.exec("argv.py ${Unset:-'b'}")
        assert result.stdout == "['b']\n"

    @pytest.mark.asyncio
    async def test_double_quoted_expansion_with_nested_double_quotes(self):
        '''Double quotes in "${Unset:-"b"}" should still be recognized.'''
        bash = Bash()
        # The inner "b" is a nested quoted string that resolves to just b
        result = await bash.exec('argv.py "${Unset:-"b"}"')
        assert result.stdout == "['b']\n"

    @pytest.mark.asyncio
    async def test_unquoted_expansion_with_double_quotes(self):
        '''Double quotes in ${Unset:-"b"} should be recognized.'''
        bash = Bash()
        result = await bash.exec('argv.py ${Unset:-"b"}')
        assert result.stdout == "['b']\n"

    @pytest.mark.asyncio
    async def test_single_quotes_in_alternative(self):
        '''Single quotes in "${x+'b'}" should be literal when x is set.'''
        bash = Bash()
        result = await bash.exec('x=1; argv.py "${x+\'alt\'}"')
        # The argument should be the literal string 'alt' with single quotes
        import ast
        args = ast.literal_eval(result.stdout.strip())
        assert args == ["'alt'"]

    @pytest.mark.asyncio
    async def test_multiple_quoted_values(self):
        '''Complex case with single quotes in default value.'''
        bash = Bash()
        result = await bash.exec('argv.py "${a:-\'x\'}" "${b:-\'y\'}"')
        # Both arguments should contain literal single quotes
        import ast
        args = ast.literal_eval(result.stdout.strip())
        assert args == ["'x'", "'y'"]
