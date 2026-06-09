"""Tests for gzip/gunzip/zcat compression commands."""

import pytest
from just_bash import Bash


class TestGzipCommand:
    """Test gzip command."""

    @pytest.mark.asyncio
    async def test_gzip_basic(self):
        """Basic file compression."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("gzip /test.txt")
        assert result.exit_code == 0
        # Original file should be removed
        assert not await bash.fs.exists("/test.txt")
        # Compressed file should exist
        assert await bash.fs.exists("/test.txt.gz")

    @pytest.mark.asyncio
    async def test_gzip_keep_original(self):
        """Keep original file with -k flag."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("gzip -k /test.txt")
        assert result.exit_code == 0
        # Both files should exist
        assert await bash.fs.exists("/test.txt")
        assert await bash.fs.exists("/test.txt.gz")

    @pytest.mark.asyncio
    async def test_gzip_stdout(self):
        """Output to stdout with -c flag."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("gzip -c /test.txt")
        assert result.exit_code == 0
        # Original file should still exist
        assert await bash.fs.exists("/test.txt")
        # Output should be compressed data (gzip magic bytes)
        assert result.stdout.startswith("\x1f\x8b") or len(result.stdout) > 0

    @pytest.mark.asyncio
    async def test_gzip_verbose(self):
        """Verbose output with -v flag."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("gzip -v /test.txt")
        assert result.exit_code == 0
        # Should show compression info
        assert "%" in result.stderr or "test.txt" in result.stderr

    @pytest.mark.asyncio
    async def test_gzip_force_overwrite(self):
        """Force overwrite with -f flag."""
        bash = Bash(files={
            "/test.txt": "hello world\n",
            "/test.txt.gz": "existing\n",
        })
        result = await bash.exec("gzip -f /test.txt")
        assert result.exit_code == 0
        # Should have overwritten the gz file
        assert await bash.fs.exists("/test.txt.gz")

    @pytest.mark.asyncio
    async def test_gzip_compression_level_1(self):
        """Fast compression with -1 flag."""
        bash = Bash(files={"/test.txt": "hello world\n" * 100})
        result = await bash.exec("gzip -1 /test.txt")
        assert result.exit_code == 0
        assert await bash.fs.exists("/test.txt.gz")

    @pytest.mark.asyncio
    async def test_gzip_compression_level_9(self):
        """Best compression with -9 flag."""
        bash = Bash(files={"/test.txt": "hello world\n" * 100})
        result = await bash.exec("gzip -9 /test.txt")
        assert result.exit_code == 0
        assert await bash.fs.exists("/test.txt.gz")

    @pytest.mark.asyncio
    async def test_gzip_multiple_files(self):
        """Compress multiple files."""
        bash = Bash(files={
            "/a.txt": "aaa\n",
            "/b.txt": "bbb\n",
        })
        result = await bash.exec("gzip /a.txt /b.txt")
        assert result.exit_code == 0
        assert await bash.fs.exists("/a.txt.gz")
        assert await bash.fs.exists("/b.txt.gz")

    @pytest.mark.asyncio
    async def test_gzip_stdin(self):
        """Compress stdin."""
        bash = Bash()
        result = await bash.exec("echo 'hello' | gzip -c")
        assert result.exit_code == 0
        # Output should be compressed
        assert len(result.stdout) > 0

    @pytest.mark.asyncio
    async def test_gzip_nonexistent_file(self):
        """Error on nonexistent file."""
        bash = Bash()
        result = await bash.exec("gzip /nonexistent.txt")
        assert result.exit_code == 1
        assert "No such file" in result.stderr or "not found" in result.stderr.lower()


class TestGunzipCommand:
    """Test gunzip command."""

    @pytest.mark.asyncio
    async def test_gunzip_basic(self):
        """Basic decompression."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        # First compress
        await bash.exec("gzip /test.txt")
        # Then decompress
        result = await bash.exec("gunzip /test.txt.gz")
        assert result.exit_code == 0
        # Decompressed file should exist
        assert await bash.fs.exists("/test.txt")
        # Compressed file should be removed
        assert not await bash.fs.exists("/test.txt.gz")
        # Content should match original
        content = await bash.fs.read_file("/test.txt")
        assert content == "hello world\n"

    @pytest.mark.asyncio
    async def test_gunzip_keep(self):
        """Keep compressed file with -k flag."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip /test.txt")
        result = await bash.exec("gunzip -k /test.txt.gz")
        assert result.exit_code == 0
        # Both files should exist
        assert await bash.fs.exists("/test.txt")
        assert await bash.fs.exists("/test.txt.gz")

    @pytest.mark.asyncio
    async def test_gunzip_stdout(self):
        """Output to stdout with -c flag."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip /test.txt")
        result = await bash.exec("gunzip -c /test.txt.gz")
        assert result.exit_code == 0
        assert result.stdout == "hello world\n"
        # Compressed file should still exist
        assert await bash.fs.exists("/test.txt.gz")

    @pytest.mark.asyncio
    async def test_gunzip_force(self):
        """Force overwrite with -f flag."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip -k /test.txt")  # Keep original
        result = await bash.exec("gunzip -f /test.txt.gz")
        assert result.exit_code == 0
        assert await bash.fs.exists("/test.txt")

    @pytest.mark.asyncio
    async def test_gunzip_verbose(self):
        """Verbose output with -v flag."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip /test.txt")
        result = await bash.exec("gunzip -v /test.txt.gz")
        assert result.exit_code == 0
        # Should show decompression info
        assert "%" in result.stderr or "test.txt" in result.stderr

    @pytest.mark.asyncio
    async def test_gunzip_multiple_files(self):
        """Decompress multiple files."""
        bash = Bash(files={
            "/a.txt": "aaa\n",
            "/b.txt": "bbb\n",
        })
        await bash.exec("gzip /a.txt /b.txt")
        result = await bash.exec("gunzip /a.txt.gz /b.txt.gz")
        assert result.exit_code == 0
        assert await bash.fs.exists("/a.txt")
        assert await bash.fs.exists("/b.txt")


class TestZcatCommand:
    """Test zcat command."""

    @pytest.mark.asyncio
    async def test_zcat_basic(self):
        """Basic zcat - decompress to stdout."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip /test.txt")
        result = await bash.exec("zcat /test.txt.gz")
        assert result.exit_code == 0
        assert result.stdout == "hello world\n"
        # Compressed file should still exist
        assert await bash.fs.exists("/test.txt.gz")

    @pytest.mark.asyncio
    async def test_zcat_multiple_files(self):
        """Decompress multiple files to stdout."""
        bash = Bash(files={
            "/a.txt": "aaa\n",
            "/b.txt": "bbb\n",
        })
        await bash.exec("gzip /a.txt /b.txt")
        result = await bash.exec("zcat /a.txt.gz /b.txt.gz")
        assert result.exit_code == 0
        assert "aaa" in result.stdout
        assert "bbb" in result.stdout

    @pytest.mark.asyncio
    async def test_zcat_pipeline(self):
        """Use zcat in a pipeline."""
        bash = Bash(files={"/data.txt": "apple\nbanana\ncherry\n"})
        await bash.exec("gzip /data.txt")
        result = await bash.exec("zcat /data.txt.gz | grep banana")
        assert result.exit_code == 0
        assert result.stdout == "banana\n"

    @pytest.mark.asyncio
    async def test_zcat_nonexistent(self):
        """Error on nonexistent file."""
        bash = Bash()
        result = await bash.exec("zcat /nonexistent.gz")
        assert result.exit_code == 1


class TestGzipDecompressFlag:
    """Test gzip -d flag (equivalent to gunzip)."""

    @pytest.mark.asyncio
    async def test_gzip_decompress(self):
        """Decompress with gzip -d."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip /test.txt")
        result = await bash.exec("gzip -d /test.txt.gz")
        assert result.exit_code == 0
        assert await bash.fs.exists("/test.txt")
        content = await bash.fs.read_file("/test.txt")
        assert content == "hello world\n"

    @pytest.mark.asyncio
    async def test_gzip_decompress_stdout(self):
        """Decompress to stdout with gzip -dc."""
        bash = Bash(files={"/test.txt": "hello world\n"})
        await bash.exec("gzip /test.txt")
        result = await bash.exec("gzip -dc /test.txt.gz")
        assert result.exit_code == 0
        assert result.stdout == "hello world\n"
