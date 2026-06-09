"""Tests for medium priority command improvements.

These tests cover:
- gzip: -l (list), -t (test), -r (recursive), -q (quiet), -S (suffix)
- timeout: -k (kill-after), -s (signal), --preserve-status
- env: command execution with modified environment, -u (unset), -i (ignore)
"""

import gzip
import pytest
from just_bash.commands.compression.compression import GzipCommand
from just_bash.commands.timeout.timeout import TimeoutCommand
from just_bash.commands.env.env import EnvCommand
from just_bash.types import CommandContext, ExecResult
from just_bash.fs import InMemoryFs


# =============================================================================
# GZIP TESTS
# =============================================================================


class TestGzipList:
    """Tests for gzip -l (--list) flag."""

    @pytest.mark.asyncio
    async def test_gzip_list_single_file(self):
        """List info for a single gzip file."""
        fs = InMemoryFs()
        # Create a gzip file
        original = b"Hello, this is test content for gzip listing!"
        compressed = gzip.compress(original)
        await fs.write_file("/test.gz", compressed)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-l", "/test.gz"], ctx)

        assert result.exit_code == 0
        # Output should contain compressed size, uncompressed size, ratio, filename
        assert "test.gz" in result.stdout
        # Should show sizes
        assert str(len(compressed)) in result.stdout or str(len(original)) in result.stdout

    @pytest.mark.asyncio
    async def test_gzip_list_multiple_files(self):
        """List info for multiple gzip files."""
        fs = InMemoryFs()
        data1 = gzip.compress(b"File one content")
        data2 = gzip.compress(b"File two has more content here")
        await fs.write_file("/a.gz", data1)
        await fs.write_file("/b.gz", data2)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-l", "/a.gz", "/b.gz"], ctx)

        assert result.exit_code == 0
        assert "a.gz" in result.stdout
        assert "b.gz" in result.stdout

    @pytest.mark.asyncio
    async def test_gzip_list_not_gzip(self):
        """Error when listing non-gzip file."""
        fs = InMemoryFs()
        await fs.write_file("/plain.txt", "not compressed")

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-l", "/plain.txt"], ctx)

        assert result.exit_code != 0
        assert "not in gzip format" in result.stderr.lower() or "error" in result.stderr.lower()


class TestGzipTest:
    """Tests for gzip -t (--test) flag."""

    @pytest.mark.asyncio
    async def test_gzip_test_valid_file(self):
        """Test integrity of valid gzip file."""
        fs = InMemoryFs()
        compressed = gzip.compress(b"Valid gzip content")
        await fs.write_file("/valid.gz", compressed)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-t", "/valid.gz"], ctx)

        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_gzip_test_invalid_file(self):
        """Test integrity of corrupted gzip file."""
        fs = InMemoryFs()
        # Create corrupted gzip data
        await fs.write_file("/corrupt.gz", b"\x1f\x8b\x08\x00corrupted data")

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-t", "/corrupt.gz"], ctx)

        assert result.exit_code != 0

    @pytest.mark.asyncio
    async def test_gzip_test_quiet_valid(self):
        """Test with -t and -q produces no output for valid file."""
        fs = InMemoryFs()
        compressed = gzip.compress(b"Valid content")
        await fs.write_file("/valid.gz", compressed)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-tq", "/valid.gz"], ctx)

        assert result.exit_code == 0
        assert result.stdout == ""
        assert result.stderr == ""


class TestGzipQuiet:
    """Tests for gzip -q (--quiet) flag."""

    @pytest.mark.asyncio
    async def test_gzip_quiet_suppresses_warnings(self):
        """Quiet mode suppresses warnings."""
        fs = InMemoryFs()
        await fs.write_file("/noext", "content without .gz extension")

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        # Decompress a file without .gz extension normally warns
        result = await cmd.execute(["-dq", "/noext"], ctx)

        # With -q, warnings should be suppressed (though it may still fail)
        # The key is no warning message about "unknown suffix"
        assert "unknown suffix" not in result.stderr


class TestGzipSuffix:
    """Tests for gzip -S (--suffix) flag."""

    @pytest.mark.asyncio
    async def test_gzip_custom_suffix(self):
        """Compress with custom suffix."""
        fs = InMemoryFs()
        await fs.write_file("/data.txt", "content to compress")

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-S", ".z", "/data.txt"], ctx)

        assert result.exit_code == 0
        # Should create file with .z suffix
        exists = await fs.exists("/data.txt.z")
        assert exists

    @pytest.mark.asyncio
    async def test_gzip_decompress_custom_suffix(self):
        """Decompress file with custom suffix."""
        fs = InMemoryFs()
        compressed = gzip.compress(b"custom suffix content")
        await fs.write_file("/data.z", compressed)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-d", "-S", ".z", "/data.z"], ctx)

        assert result.exit_code == 0
        exists = await fs.exists("/data")
        assert exists


class TestGzipRecursive:
    """Tests for gzip -r (--recursive) flag."""

    @pytest.mark.asyncio
    async def test_gzip_recursive_compress(self):
        """Recursively compress files in directory."""
        fs = InMemoryFs()
        await fs.mkdir("/dir", recursive=True)
        await fs.write_file("/dir/a.txt", "file a")
        await fs.write_file("/dir/b.txt", "file b")
        await fs.mkdir("/dir/sub", recursive=True)
        await fs.write_file("/dir/sub/c.txt", "file c")

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-r", "/dir"], ctx)

        assert result.exit_code == 0
        # All .txt files should now be .txt.gz
        assert await fs.exists("/dir/a.txt.gz")
        assert await fs.exists("/dir/b.txt.gz")
        assert await fs.exists("/dir/sub/c.txt.gz")

    @pytest.mark.asyncio
    async def test_gzip_recursive_decompress(self):
        """Recursively decompress files in directory."""
        fs = InMemoryFs()
        await fs.mkdir("/dir", recursive=True)
        await fs.write_file("/dir/a.txt.gz", gzip.compress(b"file a"))
        await fs.write_file("/dir/b.txt.gz", gzip.compress(b"file b"))

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = GzipCommand()
        result = await cmd.execute(["-dr", "/dir"], ctx)

        assert result.exit_code == 0
        assert await fs.exists("/dir/a.txt")
        assert await fs.exists("/dir/b.txt")


# =============================================================================
# TIMEOUT TESTS
# =============================================================================


class TestTimeoutKillAfter:
    """Tests for timeout -k (--kill-after) flag."""

    @pytest.mark.asyncio
    async def test_timeout_kill_after_parsing(self):
        """Kill-after duration is parsed correctly."""
        fs = InMemoryFs()

        exec_called_with = {}

        async def mock_exec(cmd, opts):
            exec_called_with["cmd"] = cmd
            return ExecResult(stdout="done", stderr="", exit_code=0)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", exec=mock_exec)
        cmd = TimeoutCommand()
        result = await cmd.execute(["-k", "5s", "10s", "echo", "hello"], ctx)

        assert result.exit_code == 0
        assert "echo" in exec_called_with.get("cmd", "")

    @pytest.mark.asyncio
    async def test_timeout_kill_after_long_form(self):
        """--kill-after works with long form."""
        fs = InMemoryFs()

        async def mock_exec(cmd, opts):
            return ExecResult(stdout="done", stderr="", exit_code=0)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", exec=mock_exec)
        cmd = TimeoutCommand()
        result = await cmd.execute(["--kill-after=5", "10", "true"], ctx)

        assert result.exit_code == 0


class TestTimeoutSignal:
    """Tests for timeout -s (--signal) flag."""

    @pytest.mark.asyncio
    async def test_timeout_signal_parsing(self):
        """Signal option is parsed correctly."""
        fs = InMemoryFs()

        async def mock_exec(cmd, opts):
            return ExecResult(stdout="done", stderr="", exit_code=0)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", exec=mock_exec)
        cmd = TimeoutCommand()
        result = await cmd.execute(["-s", "TERM", "10s", "echo", "hello"], ctx)

        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_timeout_signal_long_form(self):
        """--signal works with long form."""
        fs = InMemoryFs()

        async def mock_exec(cmd, opts):
            return ExecResult(stdout="done", stderr="", exit_code=0)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", exec=mock_exec)
        cmd = TimeoutCommand()
        result = await cmd.execute(["--signal=KILL", "10", "true"], ctx)

        assert result.exit_code == 0


class TestTimeoutPreserveStatus:
    """Tests for timeout --preserve-status flag."""

    @pytest.mark.asyncio
    async def test_timeout_preserve_status_normal_exit(self):
        """Preserve status passes through normal exit code."""
        fs = InMemoryFs()

        async def mock_exec(cmd, opts):
            return ExecResult(stdout="", stderr="", exit_code=42)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", exec=mock_exec)
        cmd = TimeoutCommand()
        result = await cmd.execute(["--preserve-status", "10s", "exit", "42"], ctx)

        assert result.exit_code == 42


# =============================================================================
# ENV TESTS
# =============================================================================


class TestEnvCommandExecution:
    """Tests for env executing commands with modified environment."""

    @pytest.mark.asyncio
    async def test_env_run_command_with_var(self):
        """Run command with additional environment variable."""
        fs = InMemoryFs()
        exec_env = {}

        async def mock_exec(cmd, opts):
            exec_env.update(opts.get("env", {}))
            return ExecResult(stdout="executed", stderr="", exit_code=0)

        ctx = CommandContext(
            fs=fs, cwd="/", env={"EXISTING": "value"}, stdin="", exec=mock_exec
        )
        cmd = EnvCommand()
        result = await cmd.execute(["FOO=bar", "echo", "hello"], ctx)

        assert result.exit_code == 0
        assert exec_env.get("FOO") == "bar"
        assert exec_env.get("EXISTING") == "value"

    @pytest.mark.asyncio
    async def test_env_run_command_multiple_vars(self):
        """Run command with multiple environment variables."""
        fs = InMemoryFs()
        exec_env = {}

        async def mock_exec(cmd, opts):
            exec_env.update(opts.get("env", {}))
            return ExecResult(stdout="executed", stderr="", exit_code=0)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", exec=mock_exec)
        cmd = EnvCommand()
        result = await cmd.execute(["A=1", "B=2", "C=3", "printenv"], ctx)

        assert result.exit_code == 0
        assert exec_env.get("A") == "1"
        assert exec_env.get("B") == "2"
        assert exec_env.get("C") == "3"


class TestEnvUnset:
    """Tests for env -u (--unset) flag."""

    @pytest.mark.asyncio
    async def test_env_unset_variable(self):
        """Unset a variable before running command."""
        fs = InMemoryFs()
        exec_env = {}

        async def mock_exec(cmd, opts):
            exec_env.update(opts.get("env", {}))
            return ExecResult(stdout="executed", stderr="", exit_code=0)

        ctx = CommandContext(
            fs=fs, cwd="/", env={"FOO": "bar", "BAZ": "qux"}, stdin="", exec=mock_exec
        )
        cmd = EnvCommand()
        result = await cmd.execute(["-u", "FOO", "echo", "test"], ctx)

        assert result.exit_code == 0
        assert "FOO" not in exec_env
        assert exec_env.get("BAZ") == "qux"

    @pytest.mark.asyncio
    async def test_env_unset_multiple(self):
        """Unset multiple variables."""
        fs = InMemoryFs()
        exec_env = {}

        async def mock_exec(cmd, opts):
            exec_env.update(opts.get("env", {}))
            return ExecResult(stdout="executed", stderr="", exit_code=0)

        ctx = CommandContext(
            fs=fs, cwd="/", env={"A": "1", "B": "2", "C": "3"}, stdin="", exec=mock_exec
        )
        cmd = EnvCommand()
        result = await cmd.execute(["-u", "A", "-u", "B", "echo", "test"], ctx)

        assert result.exit_code == 0
        assert "A" not in exec_env
        assert "B" not in exec_env
        assert exec_env.get("C") == "3"

    @pytest.mark.asyncio
    async def test_env_unset_print_only(self):
        """Unset when just printing (no command)."""
        fs = InMemoryFs()
        ctx = CommandContext(
            fs=fs, cwd="/", env={"FOO": "bar", "BAZ": "qux"}, stdin=""
        )
        cmd = EnvCommand()
        result = await cmd.execute(["-u", "FOO"], ctx)

        assert result.exit_code == 0
        assert "FOO" not in result.stdout
        assert "BAZ=qux" in result.stdout


class TestEnvIgnoreEnvironment:
    """Tests for env -i (--ignore-environment) flag."""

    @pytest.mark.asyncio
    async def test_env_ignore_environment(self):
        """Start with empty environment."""
        fs = InMemoryFs()
        exec_env = {}

        async def mock_exec(cmd, opts):
            exec_env.update(opts.get("env", {}))
            return ExecResult(stdout="executed", stderr="", exit_code=0)

        ctx = CommandContext(
            fs=fs, cwd="/", env={"EXISTING": "value"}, stdin="", exec=mock_exec
        )
        cmd = EnvCommand()
        result = await cmd.execute(["-i", "NEW=val", "echo", "test"], ctx)

        assert result.exit_code == 0
        assert "EXISTING" not in exec_env
        assert exec_env.get("NEW") == "val"

    @pytest.mark.asyncio
    async def test_env_ignore_environment_print(self):
        """Print empty environment with -i (no command)."""
        fs = InMemoryFs()
        ctx = CommandContext(
            fs=fs, cwd="/", env={"FOO": "bar"}, stdin=""
        )
        cmd = EnvCommand()
        result = await cmd.execute(["-i"], ctx)

        assert result.exit_code == 0
        assert result.stdout == "" or result.stdout == "\n"

    @pytest.mark.asyncio
    async def test_env_ignore_with_new_vars(self):
        """Ignore existing but add new variables."""
        fs = InMemoryFs()
        ctx = CommandContext(
            fs=fs, cwd="/", env={"OLD": "value"}, stdin=""
        )
        cmd = EnvCommand()
        result = await cmd.execute(["-i", "NEW=fresh"], ctx)

        assert result.exit_code == 0
        assert "OLD" not in result.stdout
        assert "NEW=fresh" in result.stdout
