"""Tests for redirections.

Covers: redirect.test.sh failures
Key areas: >& syntax, <> read-write, <<< here-strings, FD duplication,
           /dev/null, /dev/stdin, /dev/stdout
"""

import pytest
from phoenix.vendor.just_bash import Bash


class TestBasicRedirects:
    """Basic redirection operations."""

    @pytest.mark.asyncio
    async def test_redirect_stdout_to_file(self):
        """Redirect stdout to file with >."""
        bash = Bash()
        result = await bash.exec('''
echo "hello" > /output.txt
cat /output.txt
''')
        assert result.stdout.strip() == "hello"

    @pytest.mark.asyncio
    async def test_redirect_append(self):
        """Redirect append with >>."""
        bash = Bash(files={"/output.txt": "first\n"})
        result = await bash.exec('''
echo "second" >> /output.txt
cat /output.txt
''')
        assert "first" in result.stdout
        assert "second" in result.stdout

    @pytest.mark.asyncio
    async def test_redirect_stdin_from_file(self):
        """Redirect stdin from file with <."""
        bash = Bash(files={"/input.txt": "hello world\n"})
        result = await bash.exec('cat < /input.txt')
        assert result.stdout.strip() == "hello world"

    @pytest.mark.asyncio
    async def test_redirect_stderr_to_file(self):
        """Redirect stderr to file with 2>."""
        bash = Bash()
        result = await bash.exec('''
ls /nonexistent 2> /error.txt
cat /error.txt
''')
        assert "No such file" in result.stdout or "nonexistent" in result.stdout


class TestStdoutStderrRedirection:
    """Test stdout and stderr redirection combinations."""

    @pytest.mark.asyncio
    async def test_stderr_to_stdout(self):
        """Redirect stderr to stdout with 2>&1."""
        bash = Bash()
        result = await bash.exec('''
{ echo "out"; echo "err" >&2; } 2>&1 | cat
''')
        assert "out" in result.stdout
        assert "err" in result.stdout

    @pytest.mark.asyncio
    async def test_stdout_to_stderr(self):
        """Redirect stdout to stderr with >&2."""
        bash = Bash()
        result = await bash.exec('echo "to stderr" >&2')
        assert "to stderr" in result.stderr

    @pytest.mark.asyncio
    async def test_both_to_file(self):
        """Redirect both stdout and stderr to file."""
        bash = Bash()
        result = await bash.exec('''
{ echo "out"; echo "err" >&2; } > /combined.txt 2>&1
cat /combined.txt
''')
        assert "out" in result.stdout
        assert "err" in result.stdout

    @pytest.mark.asyncio
    async def test_ampersand_greater(self):
        """&> redirects both stdout and stderr."""
        bash = Bash()
        result = await bash.exec('''
{ echo "out"; echo "err" >&2; } &> /both.txt
cat /both.txt
''')
        assert "out" in result.stdout
        assert "err" in result.stdout


class TestHereStrings:
    """Test here-strings <<<."""

    @pytest.mark.asyncio
    async def test_here_string_basic(self):
        """Basic here-string."""
        bash = Bash()
        result = await bash.exec('cat <<< "hello world"')
        assert "hello world" in result.stdout

    @pytest.mark.asyncio
    async def test_here_string_variable(self):
        """Here-string with variable expansion."""
        bash = Bash()
        result = await bash.exec('''
name="Alice"
cat <<< "Hello, $name"
''')
        assert "Hello, Alice" in result.stdout

    @pytest.mark.asyncio
    async def test_here_string_unquoted(self):
        """Unquoted here-string."""
        bash = Bash()
        result = await bash.exec('cat <<< hello')
        assert "hello" in result.stdout

    @pytest.mark.asyncio
    async def test_here_string_multiword(self):
        """Here-string with spaces."""
        bash = Bash()
        result = await bash.exec('cat <<< "one two three"')
        assert "one two three" in result.stdout


class TestHereDocuments:
    """Test here-documents <<."""

    @pytest.mark.asyncio
    async def test_heredoc_basic(self):
        """Basic here-document."""
        bash = Bash()
        result = await bash.exec('''
cat << EOF
hello
world
EOF
''')
        assert "hello" in result.stdout
        assert "world" in result.stdout

    @pytest.mark.asyncio
    async def test_heredoc_variable_expansion(self):
        """Here-document with variable expansion."""
        bash = Bash()
        result = await bash.exec('''
name="Bob"
cat << EOF
Hello, $name!
EOF
''')
        assert "Hello, Bob!" in result.stdout

    @pytest.mark.asyncio
    async def test_heredoc_quoted_delimiter(self):
        """Here-document with quoted delimiter (no expansion)."""
        bash = Bash()
        result = await bash.exec('''
name="Bob"
cat << 'EOF'
Hello, $name!
EOF
''')
        assert "Hello, $name!" in result.stdout

    @pytest.mark.asyncio
    async def test_heredoc_tab_stripping(self):
        """Here-document with <<- strips tabs."""
        bash = Bash()
        result = await bash.exec('''
cat <<- EOF
	indented
	text
EOF
''')
        assert "indented" in result.stdout


class TestDevNullAndSpecialFiles:
    """Test /dev/null and other special files."""

    @pytest.mark.asyncio
    async def test_redirect_to_dev_null(self):
        """Redirect to /dev/null discards output."""
        bash = Bash()
        result = await bash.exec('echo "discarded" > /dev/null; echo "done"')
        assert "discarded" not in result.stdout
        assert "done" in result.stdout

    @pytest.mark.asyncio
    async def test_stderr_to_dev_null(self):
        """Redirect stderr to /dev/null."""
        bash = Bash()
        result = await bash.exec('ls /nonexistent 2>/dev/null; echo $?')
        # Error message should be suppressed
        assert "No such file" not in result.stderr
        assert "No such file" not in result.stdout

    @pytest.mark.asyncio
    async def test_both_to_dev_null(self):
        """Redirect both to /dev/null."""
        bash = Bash()
        result = await bash.exec('''
{ echo "out"; echo "err" >&2; } &>/dev/null
echo "done"
''')
        assert result.stdout.strip() == "done"

    @pytest.mark.asyncio
    async def test_dev_stdin(self):
        """/dev/stdin reads from stdin."""
        bash = Bash()
        result = await bash.exec('echo "input" | cat /dev/stdin')
        assert "input" in result.stdout

    @pytest.mark.asyncio
    async def test_dev_stdout(self):
        """/dev/stdout writes to stdout."""
        bash = Bash()
        result = await bash.exec('echo "output" > /dev/stdout')
        assert "output" in result.stdout


class TestFileDescriptors:
    """Test file descriptor operations."""

    @pytest.mark.asyncio
    async def test_fd_duplication(self):
        """Duplicate file descriptor."""
        bash = Bash()
        result = await bash.exec('''
exec 3>&1
echo "to fd3" >&3
''')
        assert "to fd3" in result.stdout

    @pytest.mark.asyncio
    async def test_fd_close(self):
        """Close file descriptor."""
        bash = Bash()
        result = await bash.exec('''
exec 3>&1
exec 3>&-
echo "done"
''')
        assert "done" in result.stdout

    @pytest.mark.asyncio
    async def test_read_write_fd(self):
        """Open file for read-write with <>."""
        bash = Bash(files={"/test.txt": "initial"})
        result = await bash.exec('''
exec 3<>/test.txt
cat <&3
''')
        assert result.exit_code == 0


class TestMultipleRedirects:
    """Test multiple redirects on same command."""

    @pytest.mark.asyncio
    async def test_multiple_output_redirects(self):
        """Multiple output redirects."""
        bash = Bash()
        result = await bash.exec('''
echo "message" > /out1.txt > /out2.txt
cat /out2.txt
''')
        # Last redirect wins
        assert "message" in result.stdout

    @pytest.mark.asyncio
    async def test_input_and_output_redirect(self):
        """Both input and output redirect."""
        bash = Bash(files={"/input.txt": "hello"})
        result = await bash.exec('''
cat < /input.txt > /output.txt
cat /output.txt
''')
        assert "hello" in result.stdout


class TestRedirectInPipeline:
    """Test redirects in pipelines."""

    @pytest.mark.asyncio
    async def test_redirect_in_middle(self):
        """Redirect in middle of pipeline."""
        bash = Bash()
        result = await bash.exec('''
{ echo "line1"; echo "line2"; } | cat > /result.txt
cat /result.txt
''')
        assert "line1" in result.stdout
        assert "line2" in result.stdout

    @pytest.mark.asyncio
    async def test_stderr_in_pipeline(self):
        """Redirect stderr within pipeline."""
        bash = Bash()
        result = await bash.exec('''
{ echo "out"; echo "err" >&2; } 2>&1 | grep -c .
''')
        # Should count both lines
        assert result.exit_code == 0


class TestRedirectWithSubshell:
    """Test redirects with subshells and groups."""

    @pytest.mark.asyncio
    async def test_subshell_redirect(self):
        """Redirect output of subshell."""
        bash = Bash()
        result = await bash.exec('''
( echo "subshell" ) > /sub.txt
cat /sub.txt
''')
        assert "subshell" in result.stdout

    @pytest.mark.asyncio
    async def test_group_redirect(self):
        """Redirect output of command group."""
        bash = Bash()
        result = await bash.exec('''
{ echo "grouped"; echo "output"; } > /group.txt
cat /group.txt
''')
        assert "grouped" in result.stdout
        assert "output" in result.stdout


class TestNoclobber:
    """Test noclobber option behavior."""

    @pytest.mark.asyncio
    async def test_force_overwrite(self):
        """>| forces overwrite with noclobber."""
        bash = Bash(files={"/existing.txt": "old"})
        result = await bash.exec('''
set -o noclobber
echo "new" >| /existing.txt
cat /existing.txt
''')
        assert "new" in result.stdout


class TestProcessSubstitution:
    """Test process substitution <() and >()."""

    @pytest.mark.asyncio
    async def test_process_sub_input(self):
        """Process substitution for input <()."""
        bash = Bash()
        result = await bash.exec('''
cat <(echo "from process sub")
''')
        assert "from process sub" in result.stdout

    @pytest.mark.asyncio
    async def test_process_sub_diff(self):
        """Process substitution with diff."""
        bash = Bash()
        result = await bash.exec('''
diff <(echo "a") <(echo "a")
echo $?
''')
        # Same content, diff returns 0
        assert "0" in result.stdout


class TestFDValidation:
    """Test that redirecting to non-open FDs produces errors."""

    @pytest.mark.asyncio
    async def test_redirect_to_non_open_fd(self):
        """echo hi 1>&7 where FD 7 isn't open should fail."""
        bash = Bash()
        result = await bash.exec('echo hi 1>&7')
        assert result.exit_code == 1
        assert "Bad file descriptor" in result.stderr

    @pytest.mark.asyncio
    async def test_redirect_to_high_fd(self):
        """echo foo >&100 should fail."""
        bash = Bash()
        result = await bash.exec('echo foo >&100')
        assert result.exit_code == 1
        assert "Bad file descriptor" in result.stderr

    @pytest.mark.asyncio
    async def test_redirect_to_open_fd_works(self):
        """Redirect to an open FD should work."""
        bash = Bash()
        result = await bash.exec('echo hello >&1')
        assert result.exit_code == 0
        assert result.stdout == "hello\n"


class TestMoveFD:
    """Test >&N- move file descriptor syntax."""

    @pytest.mark.asyncio
    async def test_move_fd(self):
        """exec 6>&5- should dup FD 5 onto 6 then close 5."""
        bash = Bash()
        result = await bash.exec('''
echo hello > /tmp/move_test.txt
exec 5< /tmp/move_test.txt
exec 6<&5-
read line <&6
echo "$line"
''')
        assert result.exit_code == 0
        assert result.stdout.strip() == "hello"
