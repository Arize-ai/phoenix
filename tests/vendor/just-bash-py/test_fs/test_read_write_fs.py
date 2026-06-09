"""Tests for the ReadWriteFs (real filesystem wrapper)."""

import os
import pytest
import tempfile
import shutil
from pathlib import Path


class TestConstructor:
    """Test ReadWriteFs constructor."""

    @pytest.mark.asyncio
    async def test_valid_root(self):
        """Creating with valid directory root should succeed."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            assert await fs.exists("/")

    @pytest.mark.asyncio
    async def test_nonexistent_root(self):
        """Creating with nonexistent root should raise error."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with pytest.raises(FileNotFoundError):
            ReadWriteFs(ReadWriteFsOptions(root="/nonexistent/path/that/doesnt/exist"))

    @pytest.mark.asyncio
    async def test_file_as_root(self):
        """Creating with file as root should raise error."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.NamedTemporaryFile() as tmp:
            with pytest.raises(NotADirectoryError):
                ReadWriteFs(ReadWriteFsOptions(root=tmp.name))


class TestReadOperations:
    """Test read operations on real filesystem."""

    @pytest.mark.asyncio
    async def test_read_file(self):
        """Reading a file should return its contents."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a test file
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("hello world")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            content = await fs.read_file("/test.txt")
            assert content == "hello world"

    @pytest.mark.asyncio
    async def test_read_file_bytes(self):
        """Reading a file as bytes should return raw bytes."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "binary.bin"
            test_file.write_bytes(b"\x00\x01\x02\x03")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            content = await fs.read_file_bytes("/binary.bin")
            assert content == b"\x00\x01\x02\x03"

    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self):
        """Reading nonexistent file should raise FileNotFoundError."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            with pytest.raises(FileNotFoundError):
                await fs.read_file("/nonexistent.txt")

    @pytest.mark.asyncio
    async def test_exists_true(self):
        """exists() should return True for existing file."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "exists.txt"
            test_file.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            assert await fs.exists("/exists.txt") is True

    @pytest.mark.asyncio
    async def test_exists_false(self):
        """exists() should return False for nonexistent file."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            assert await fs.exists("/nonexistent.txt") is False

    @pytest.mark.asyncio
    async def test_is_file(self):
        """is_file() should return True for files."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "file.txt"
            test_file.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            assert await fs.is_file("/file.txt") is True
            assert await fs.is_file("/") is False

    @pytest.mark.asyncio
    async def test_is_directory(self):
        """is_directory() should return True for directories."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir) / "subdir"
            subdir.mkdir()

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            assert await fs.is_directory("/subdir") is True
            assert await fs.is_directory("/") is True

    @pytest.mark.asyncio
    async def test_stat_file(self):
        """stat() should return file stats."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("hello")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            stat = await fs.stat("/test.txt")
            assert stat.is_file is True
            assert stat.is_directory is False
            assert stat.size == 5

    @pytest.mark.asyncio
    async def test_stat_directory(self):
        """stat() should return directory stats."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir) / "mydir"
            subdir.mkdir()

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            stat = await fs.stat("/mydir")
            assert stat.is_directory is True
            assert stat.is_file is False


class TestWriteOperations:
    """Test write operations on real filesystem."""

    @pytest.mark.asyncio
    async def test_write_file(self):
        """write_file() should create file on real filesystem."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.write_file("/newfile.txt", "hello world")

            # Verify it was written to real filesystem
            real_path = Path(tmpdir) / "newfile.txt"
            assert real_path.exists()
            assert real_path.read_text() == "hello world"

    @pytest.mark.asyncio
    async def test_write_file_creates_parent_dirs(self):
        """write_file() should create parent directories."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.write_file("/a/b/c/file.txt", "nested content")

            real_path = Path(tmpdir) / "a" / "b" / "c" / "file.txt"
            assert real_path.exists()
            assert real_path.read_text() == "nested content"

    @pytest.mark.asyncio
    async def test_append_file(self):
        """append_file() should append to existing file."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "append.txt"
            test_file.write_text("hello")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.append_file("/append.txt", " world")

            assert test_file.read_text() == "hello world"

    @pytest.mark.asyncio
    async def test_mkdir(self):
        """mkdir() should create directory on real filesystem."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.mkdir("/newdir")

            real_path = Path(tmpdir) / "newdir"
            assert real_path.exists()
            assert real_path.is_dir()

    @pytest.mark.asyncio
    async def test_mkdir_recursive(self):
        """mkdir(recursive=True) should create nested directories."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.mkdir("/a/b/c", recursive=True)

            real_path = Path(tmpdir) / "a" / "b" / "c"
            assert real_path.exists()
            assert real_path.is_dir()


class TestDirectoryOperations:
    """Test directory listing operations."""

    @pytest.mark.asyncio
    async def test_readdir(self):
        """readdir() should list directory contents."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create some files and directories
            (Path(tmpdir) / "file1.txt").write_text("a")
            (Path(tmpdir) / "file2.txt").write_text("b")
            (Path(tmpdir) / "subdir").mkdir()

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            entries = await fs.readdir("/")

            assert "file1.txt" in entries
            assert "file2.txt" in entries
            assert "subdir" in entries

    @pytest.mark.asyncio
    async def test_readdir_with_file_types(self):
        """readdir_with_file_types() should return typed entries."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "file.txt").write_text("content")
            (Path(tmpdir) / "subdir").mkdir()

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            entries = await fs.readdir_with_file_types("/")

            entry_names = {e.name for e in entries}
            assert "file.txt" in entry_names
            assert "subdir" in entry_names

            for entry in entries:
                if entry.name == "file.txt":
                    assert entry.is_file is True
                    assert entry.is_directory is False
                elif entry.name == "subdir":
                    assert entry.is_directory is True
                    assert entry.is_file is False


class TestFileOperations:
    """Test file manipulation operations."""

    @pytest.mark.asyncio
    async def test_rm_file(self):
        """rm() should remove file from real filesystem."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "todelete.txt"
            test_file.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.rm("/todelete.txt")

            assert not test_file.exists()

    @pytest.mark.asyncio
    async def test_rm_directory_recursive(self):
        """rm(recursive=True) should remove directory tree."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir) / "toremove"
            subdir.mkdir()
            (subdir / "file.txt").write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.rm("/toremove", recursive=True)

            assert not subdir.exists()

    @pytest.mark.asyncio
    async def test_cp_file(self):
        """cp() should copy file."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src.txt"
            src.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.cp("/src.txt", "/dest.txt")

            dest = Path(tmpdir) / "dest.txt"
            assert dest.exists()
            assert dest.read_text() == "content"
            assert src.exists()  # Original still exists

    @pytest.mark.asyncio
    async def test_mv_file(self):
        """mv() should move file."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src.txt"
            src.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.mv("/src.txt", "/dest.txt")

            dest = Path(tmpdir) / "dest.txt"
            assert dest.exists()
            assert dest.read_text() == "content"
            assert not src.exists()  # Original is gone


class TestLinkOperations:
    """Test symbolic and hard link operations."""

    @pytest.mark.asyncio
    async def test_symlink(self):
        """symlink() should create symbolic link."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            target = Path(tmpdir) / "target.txt"
            target.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.symlink("/target.txt", "/link.txt")

            link = Path(tmpdir) / "link.txt"
            assert link.is_symlink()
            content = await fs.read_file("/link.txt")
            assert content == "content"

    @pytest.mark.asyncio
    async def test_readlink(self):
        """readlink() should return symlink target."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            target = Path(tmpdir) / "target.txt"
            target.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.symlink("/target.txt", "/link.txt")

            link_target = await fs.readlink("/link.txt")
            # The target should be the virtual path we specified
            assert link_target == "/target.txt"

    @pytest.mark.asyncio
    async def test_link_hard(self):
        """link() should create hard link."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            original = Path(tmpdir) / "original.txt"
            original.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.link("/original.txt", "/hardlink.txt")

            hardlink = Path(tmpdir) / "hardlink.txt"
            assert hardlink.exists()
            assert hardlink.read_text() == "content"
            # Check it's actually a hard link (same inode)
            assert original.stat().st_ino == hardlink.stat().st_ino


class TestPathHandling:
    """Test path normalization and handling."""

    @pytest.mark.asyncio
    async def test_relative_path_components(self):
        """Paths with . and .. should be resolved correctly."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir) / "dir"
            subdir.mkdir()
            test_file = subdir / "file.txt"
            test_file.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))

            # ./dir/file.txt should work
            content = await fs.read_file("/dir/./file.txt")
            assert content == "content"

            # dir/../dir/file.txt should work
            content = await fs.read_file("/dir/../dir/file.txt")
            assert content == "content"

    @pytest.mark.asyncio
    async def test_absolute_paths(self):
        """All paths should be treated as relative to root."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))

            # Both should work
            content1 = await fs.read_file("/test.txt")
            assert content1 == "content"

    @pytest.mark.asyncio
    async def test_resolve_path(self):
        """resolve_path() should combine base and relative paths."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))

            # Relative path
            result = fs.resolve_path("/dir", "file.txt")
            assert result == "/dir/file.txt"

            # Absolute path should ignore base
            result = fs.resolve_path("/dir", "/other/file.txt")
            assert result == "/other/file.txt"


class TestChmod:
    """Test permission operations."""

    @pytest.mark.asyncio
    async def test_chmod(self):
        """chmod() should change file permissions."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.chmod("/test.txt", 0o755)

            # Check permission was changed
            mode = test_file.stat().st_mode & 0o777
            assert mode == 0o755


class TestUtimes:
    """Test utimes() timestamp operations (issue #6)."""

    @pytest.mark.asyncio
    async def test_utimes_sets_times(self):
        """utimes() should set access and modification times."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("content")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            await fs.utimes("/test.txt", 1000000000.0, 1000000000.0)

            stat = test_file.stat()
            assert stat.st_mtime == 1000000000.0
            assert stat.st_atime == 1000000000.0

    @pytest.mark.asyncio
    async def test_utimes_nonexistent_file(self):
        """utimes() on a missing file should raise FileNotFoundError."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            with pytest.raises(FileNotFoundError):
                await fs.utimes("/nonexistent.txt", 1000000000.0, 1000000000.0)

    @pytest.mark.asyncio
    async def test_touch_creates_file(self):
        """touch on ReadWriteFs should create the file without errors (issue #6)."""
        from just_bash import Bash
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            bash = Bash(fs=fs, cwd="/")

            result = await bash.exec("touch text.py")

            assert result.exit_code == 0
            assert result.stderr == ""
            assert (Path(tmpdir) / "text.py").exists()

    @pytest.mark.asyncio
    async def test_touch_existing_file_updates_mtime(self):
        """touch on an existing file should update its mtime."""
        from just_bash import Bash
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "old.txt"
            test_file.write_text("content")
            os.utime(test_file, (1000000000.0, 1000000000.0))

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))
            bash = Bash(fs=fs, cwd="/")

            result = await bash.exec("touch old.txt")

            assert result.exit_code == 0
            assert result.stderr == ""
            assert test_file.stat().st_mtime > 1000000000.0
            assert test_file.read_text() == "content"
