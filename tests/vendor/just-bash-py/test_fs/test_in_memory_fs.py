"""Tests for the in-memory filesystem."""

import pytest
from just_bash.fs import InMemoryFs


class TestBasicOperations:
    """Test basic file operations."""

    @pytest.mark.asyncio
    async def test_write_and_read_file(self):
        fs = InMemoryFs()
        await fs.write_file("/test.txt", "hello world")
        content = await fs.read_file("/test.txt")
        assert content == "hello world"

    @pytest.mark.asyncio
    async def test_write_and_read_bytes(self):
        fs = InMemoryFs()
        await fs.write_file("/binary.bin", b"\x00\x01\x02\x03")
        content = await fs.read_file_bytes("/binary.bin")
        assert content == b"\x00\x01\x02\x03"

    @pytest.mark.asyncio
    async def test_append_file(self):
        fs = InMemoryFs()
        await fs.write_file("/test.txt", "hello")
        await fs.append_file("/test.txt", " world")
        content = await fs.read_file("/test.txt")
        assert content == "hello world"

    @pytest.mark.asyncio
    async def test_file_not_found(self):
        fs = InMemoryFs()
        with pytest.raises(FileNotFoundError):
            await fs.read_file("/nonexistent.txt")


class TestInitialFiles:
    """Test filesystem initialization with files."""

    @pytest.mark.asyncio
    async def test_initial_files(self):
        fs = InMemoryFs(initial_files={
            "/file1.txt": "content1",
            "/dir/file2.txt": "content2",
        })
        assert await fs.read_file("/file1.txt") == "content1"
        assert await fs.read_file("/dir/file2.txt") == "content2"


class TestDirectories:
    """Test directory operations."""

    @pytest.mark.asyncio
    async def test_mkdir(self):
        fs = InMemoryFs()
        await fs.mkdir("/newdir")
        assert await fs.is_directory("/newdir")

    @pytest.mark.asyncio
    async def test_mkdir_recursive(self):
        fs = InMemoryFs()
        await fs.mkdir("/a/b/c", recursive=True)
        assert await fs.is_directory("/a")
        assert await fs.is_directory("/a/b")
        assert await fs.is_directory("/a/b/c")

    @pytest.mark.asyncio
    async def test_mkdir_exists_error(self):
        fs = InMemoryFs()
        await fs.mkdir("/testdir")
        with pytest.raises(OSError):
            await fs.mkdir("/testdir")

    @pytest.mark.asyncio
    async def test_mkdir_exists_recursive_ok(self):
        fs = InMemoryFs()
        await fs.mkdir("/testdir")
        # Should not raise with recursive=True
        await fs.mkdir("/testdir", recursive=True)

    @pytest.mark.asyncio
    async def test_readdir(self):
        fs = InMemoryFs(initial_files={
            "/dir/file1.txt": "a",
            "/dir/file2.txt": "b",
            "/dir/subdir/file3.txt": "c",
        })
        entries = await fs.readdir("/dir")
        assert "file1.txt" in entries
        assert "file2.txt" in entries
        assert "subdir" in entries
        assert len(entries) == 3


class TestRemove:
    """Test file/directory removal."""

    @pytest.mark.asyncio
    async def test_rm_file(self):
        fs = InMemoryFs(initial_files={"/test.txt": "content"})
        await fs.rm("/test.txt")
        assert not await fs.exists("/test.txt")

    @pytest.mark.asyncio
    async def test_rm_empty_directory(self):
        fs = InMemoryFs()
        await fs.mkdir("/emptydir")
        await fs.rm("/emptydir")
        assert not await fs.exists("/emptydir")

    @pytest.mark.asyncio
    async def test_rm_nonempty_directory_error(self):
        fs = InMemoryFs(initial_files={"/dir/file.txt": "content"})
        with pytest.raises(OSError):
            await fs.rm("/dir")

    @pytest.mark.asyncio
    async def test_rm_recursive(self):
        fs = InMemoryFs(initial_files={
            "/dir/file.txt": "content",
            "/dir/subdir/other.txt": "other",
        })
        await fs.rm("/dir", recursive=True)
        assert not await fs.exists("/dir")

    @pytest.mark.asyncio
    async def test_rm_force_nonexistent(self):
        fs = InMemoryFs()
        # Should not raise with force=True
        await fs.rm("/nonexistent", force=True)


class TestCopyMove:
    """Test copy and move operations."""

    @pytest.mark.asyncio
    async def test_cp_file(self):
        fs = InMemoryFs(initial_files={"/src.txt": "content"})
        await fs.cp("/src.txt", "/dest.txt")
        assert await fs.read_file("/dest.txt") == "content"
        assert await fs.exists("/src.txt")  # Original still exists

    @pytest.mark.asyncio
    async def test_cp_directory_recursive(self):
        fs = InMemoryFs(initial_files={
            "/srcdir/file.txt": "content",
        })
        await fs.cp("/srcdir", "/destdir", recursive=True)
        assert await fs.read_file("/destdir/file.txt") == "content"

    @pytest.mark.asyncio
    async def test_mv_file(self):
        fs = InMemoryFs(initial_files={"/src.txt": "content"})
        await fs.mv("/src.txt", "/dest.txt")
        assert await fs.read_file("/dest.txt") == "content"
        assert not await fs.exists("/src.txt")


class TestStat:
    """Test file stat operations."""

    @pytest.mark.asyncio
    async def test_stat_file(self):
        fs = InMemoryFs(initial_files={"/test.txt": "hello"})
        stat = await fs.stat("/test.txt")
        assert stat.is_file
        assert not stat.is_directory
        assert stat.size == 5  # "hello" is 5 bytes

    @pytest.mark.asyncio
    async def test_stat_directory(self):
        fs = InMemoryFs()
        await fs.mkdir("/testdir")
        stat = await fs.stat("/testdir")
        assert stat.is_directory
        assert not stat.is_file


class TestSymlinks:
    """Test symbolic link operations."""

    @pytest.mark.asyncio
    async def test_symlink_to_file(self):
        fs = InMemoryFs(initial_files={"/original.txt": "content"})
        await fs.symlink("/original.txt", "/link.txt")

        # Reading through symlink should work
        content = await fs.read_file("/link.txt")
        assert content == "content"

    @pytest.mark.asyncio
    async def test_symlink_to_directory(self):
        fs = InMemoryFs(initial_files={"/dir/file.txt": "content"})
        await fs.symlink("/dir", "/linkdir")

        entries = await fs.readdir("/linkdir")
        assert "file.txt" in entries

    @pytest.mark.asyncio
    async def test_readlink(self):
        fs = InMemoryFs(initial_files={"/original.txt": "content"})
        await fs.symlink("/original.txt", "/link.txt")

        target = await fs.readlink("/link.txt")
        assert target == "/original.txt"

    @pytest.mark.asyncio
    async def test_lstat_symlink(self):
        fs = InMemoryFs(initial_files={"/original.txt": "content"})
        await fs.symlink("/original.txt", "/link.txt")

        stat = await fs.lstat("/link.txt")
        assert stat.is_symbolic_link
        assert not stat.is_file


class TestHardLinks:
    """Test hard link operations."""

    @pytest.mark.asyncio
    async def test_hard_link(self):
        fs = InMemoryFs(initial_files={"/original.txt": "content"})
        await fs.link("/original.txt", "/hardlink.txt")

        content = await fs.read_file("/hardlink.txt")
        assert content == "content"


class TestPathNormalization:
    """Test path normalization."""

    @pytest.mark.asyncio
    async def test_trailing_slash(self):
        fs = InMemoryFs(initial_files={"/file.txt": "content"})
        # These should all work the same
        assert await fs.read_file("/file.txt") == "content"

    @pytest.mark.asyncio
    async def test_dot_in_path(self):
        fs = InMemoryFs(initial_files={"/dir/file.txt": "content"})
        content = await fs.read_file("/dir/./file.txt")
        assert content == "content"

    @pytest.mark.asyncio
    async def test_dotdot_in_path(self):
        fs = InMemoryFs(initial_files={"/dir/file.txt": "content"})
        content = await fs.read_file("/dir/subdir/../file.txt")
        assert content == "content"


class TestPermissions:
    """Test permission operations."""

    @pytest.mark.asyncio
    async def test_chmod(self):
        fs = InMemoryFs(initial_files={"/test.txt": "content"})
        await fs.chmod("/test.txt", 0o755)
        stat = await fs.stat("/test.txt")
        assert stat.mode == 0o755


class TestDefaultStructure:
    """Test default directory structure."""

    @pytest.mark.asyncio
    async def test_default_directories_exist(self):
        fs = InMemoryFs()
        assert await fs.is_directory("/")
        assert await fs.is_directory("/home")
        assert await fs.is_directory("/home/user")
        assert await fs.is_directory("/tmp")
        assert await fs.is_directory("/bin")
        assert await fs.is_directory("/usr")
        assert await fs.is_directory("/usr/bin")
