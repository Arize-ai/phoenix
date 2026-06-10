"""Tests for the OverlayFs (copy-on-write overlay filesystem)."""

import pytest
import tempfile
from pathlib import Path


class TestConstructor:
    """Test OverlayFs constructor."""

    @pytest.mark.asyncio
    async def test_valid_root(self):
        """Creating with valid directory root should succeed."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir))
            mount_point = fs.get_mount_point()
            assert await fs.exists(mount_point)

    @pytest.mark.asyncio
    async def test_nonexistent_root(self):
        """Creating with nonexistent root should raise error."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with pytest.raises(FileNotFoundError):
            OverlayFs(OverlayFsOptions(root="/nonexistent/path/that/doesnt/exist"))

    @pytest.mark.asyncio
    async def test_default_mount_point(self):
        """Default mount point should be /home/user/project."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir))
            assert fs.get_mount_point() == "/home/user/project"

    @pytest.mark.asyncio
    async def test_custom_mount_point(self):
        """Custom mount point should be respected."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/workspace"))
            assert fs.get_mount_point() == "/workspace"


class TestMountPoint:
    """Test mount point behavior."""

    @pytest.mark.asyncio
    async def test_read_at_mount_point(self):
        """Files in the root should be accessible via mount point."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a real file
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("hello from disk")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            content = await fs.read_file("/mnt/test.txt")
            assert content == "hello from disk"

    @pytest.mark.asyncio
    async def test_files_outside_mount_not_accessible(self):
        """Files outside the mount point should not exist."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # This path exists on disk but not under our mount
            assert await fs.exists("/other/test.txt") is False

    @pytest.mark.asyncio
    async def test_mount_point_is_directory(self):
        """The mount point should appear as a directory."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            assert await fs.is_directory("/mnt") is True
            assert await fs.is_file("/mnt") is False

    @pytest.mark.asyncio
    async def test_readdir_at_mount_point(self):
        """readdir at mount point should list real files."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "file1.txt").write_text("a")
            (Path(tmpdir) / "file2.txt").write_text("b")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            entries = await fs.readdir("/mnt")
            assert "file1.txt" in entries
            assert "file2.txt" in entries


class TestReadFallback:
    """Test reading falls back to real filesystem."""

    @pytest.mark.asyncio
    async def test_read_from_real_fs(self):
        """Reading file not in memory should read from real fs."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "real.txt"
            real_file.write_text("real content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            content = await fs.read_file("/mnt/real.txt")
            assert content == "real content"

    @pytest.mark.asyncio
    async def test_read_bytes_from_real_fs(self):
        """Reading bytes should also fall back to real fs."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "binary.bin"
            real_file.write_bytes(b"\x00\x01\x02")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            content = await fs.read_file_bytes("/mnt/binary.bin")
            assert content == b"\x00\x01\x02"

    @pytest.mark.asyncio
    async def test_stat_from_real_fs(self):
        """stat should work for real files."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "real.txt"
            real_file.write_text("hello")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            stat = await fs.stat("/mnt/real.txt")
            assert stat.is_file is True
            assert stat.size == 5


class TestMemoryLayer:
    """Test writes go to memory only."""

    @pytest.mark.asyncio
    async def test_write_stays_in_memory(self):
        """Writing should store in memory, not affect real fs."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.write_file("/mnt/memory.txt", "memory content")

            # Should be readable through overlay
            content = await fs.read_file("/mnt/memory.txt")
            assert content == "memory content"

            # But should NOT exist on real filesystem
            real_path = Path(tmpdir) / "memory.txt"
            assert not real_path.exists()

    @pytest.mark.asyncio
    async def test_overwrite_real_file_in_memory(self):
        """Overwriting a real file should store change in memory only."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "existing.txt"
            real_file.write_text("original")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # Overwrite through overlay
            await fs.write_file("/mnt/existing.txt", "modified")

            # Overlay should see modified version
            content = await fs.read_file("/mnt/existing.txt")
            assert content == "modified"

            # Real file should be unchanged
            assert real_file.read_text() == "original"

    @pytest.mark.asyncio
    async def test_append_to_real_file(self):
        """Appending to a real file should copy-on-write."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "append.txt"
            real_file.write_text("original")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.append_file("/mnt/append.txt", " appended")

            # Overlay should see appended version
            content = await fs.read_file("/mnt/append.txt")
            assert content == "original appended"

            # Real file should be unchanged
            assert real_file.read_text() == "original"

    @pytest.mark.asyncio
    async def test_mkdir_in_memory(self):
        """mkdir should create directory in memory only."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.mkdir("/mnt/newdir")

            assert await fs.is_directory("/mnt/newdir")

            # Should NOT exist on real filesystem
            real_path = Path(tmpdir) / "newdir"
            assert not real_path.exists()


class TestDeletionTracking:
    """Test deletion behavior."""

    @pytest.mark.asyncio
    async def test_rm_marks_as_deleted(self):
        """rm should mark file as deleted, not actually delete from disk."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "todelete.txt"
            real_file.write_text("content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.rm("/mnt/todelete.txt")

            # Should appear deleted in overlay
            assert await fs.exists("/mnt/todelete.txt") is False

            # But should still exist on disk
            assert real_file.exists()

    @pytest.mark.asyncio
    async def test_deleted_file_returns_enoent(self):
        """Reading a deleted file should raise FileNotFoundError."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "deleted.txt"
            real_file.write_text("content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.rm("/mnt/deleted.txt")

            with pytest.raises(FileNotFoundError):
                await fs.read_file("/mnt/deleted.txt")

    @pytest.mark.asyncio
    async def test_recreate_deleted_file(self):
        """Writing to a deleted path should recreate in memory."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "recreate.txt"
            real_file.write_text("original")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.rm("/mnt/recreate.txt")
            await fs.write_file("/mnt/recreate.txt", "new content")

            content = await fs.read_file("/mnt/recreate.txt")
            assert content == "new content"

            # Real file should still have original
            assert real_file.read_text() == "original"

    @pytest.mark.asyncio
    async def test_rm_directory_recursive(self):
        """rm -r should mark directory and contents as deleted."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir) / "dir"
            subdir.mkdir()
            (subdir / "file.txt").write_text("content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.rm("/mnt/dir", recursive=True)

            assert await fs.exists("/mnt/dir") is False
            assert await fs.exists("/mnt/dir/file.txt") is False

            # Real files should still exist
            assert subdir.exists()
            assert (subdir / "file.txt").exists()


class TestReadOnlyMode:
    """Test read-only mode."""

    @pytest.mark.asyncio
    async def test_read_only_write_raises_error(self):
        """Writing in read-only mode should raise EROFS error."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt", read_only=True))

            with pytest.raises(OSError) as excinfo:
                await fs.write_file("/mnt/file.txt", "content")
            assert "EROFS" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_read_only_mkdir_raises_error(self):
        """mkdir in read-only mode should raise EROFS error."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt", read_only=True))

            with pytest.raises(OSError) as excinfo:
                await fs.mkdir("/mnt/newdir")
            assert "EROFS" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_read_only_rm_raises_error(self):
        """rm in read-only mode should raise EROFS error."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "file.txt"
            real_file.write_text("content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt", read_only=True))

            with pytest.raises(OSError) as excinfo:
                await fs.rm("/mnt/file.txt")
            assert "EROFS" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_read_only_can_read(self):
        """Reading in read-only mode should work."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "file.txt"
            real_file.write_text("content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt", read_only=True))

            content = await fs.read_file("/mnt/file.txt")
            assert content == "content"


class TestSymlinks:
    """Test symbolic link operations."""

    @pytest.mark.asyncio
    async def test_symlink_creation(self):
        """Creating symlink should work in memory."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "target.txt"
            real_file.write_text("target content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.symlink("/mnt/target.txt", "/mnt/link.txt")

            # Should be able to read through link
            content = await fs.read_file("/mnt/link.txt")
            assert content == "target content"

    @pytest.mark.asyncio
    async def test_readlink(self):
        """readlink should return symlink target."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))
            await fs.write_file("/mnt/target.txt", "content")
            await fs.symlink("/mnt/target.txt", "/mnt/link.txt")

            target = await fs.readlink("/mnt/link.txt")
            assert target == "/mnt/target.txt"


class TestDirectoryMerging:
    """Test readdir merges memory and real fs entries."""

    @pytest.mark.asyncio
    async def test_readdir_merges_entries(self):
        """readdir should show both real and memory files."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create real file
            (Path(tmpdir) / "real.txt").write_text("real")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # Create memory file
            await fs.write_file("/mnt/memory.txt", "memory")

            entries = await fs.readdir("/mnt")
            assert "real.txt" in entries
            assert "memory.txt" in entries

    @pytest.mark.asyncio
    async def test_readdir_excludes_deleted(self):
        """readdir should not show deleted files."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "keep.txt").write_text("keep")
            (Path(tmpdir) / "delete.txt").write_text("delete")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.rm("/mnt/delete.txt")

            entries = await fs.readdir("/mnt")
            assert "keep.txt" in entries
            assert "delete.txt" not in entries

    @pytest.mark.asyncio
    async def test_readdir_memory_overrides_real(self):
        """If file exists in both, memory version takes precedence."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "both.txt").write_text("real")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # Overwrite in memory
            await fs.write_file("/mnt/both.txt", "memory")

            entries = await fs.readdir("/mnt")
            # Should only appear once
            assert entries.count("both.txt") == 1


class TestCopyMove:
    """Test copy and move operations."""

    @pytest.mark.asyncio
    async def test_cp_real_to_memory(self):
        """Copying real file creates memory copy."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "src.txt").write_text("source")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.cp("/mnt/src.txt", "/mnt/dest.txt")

            content = await fs.read_file("/mnt/dest.txt")
            assert content == "source"

            # dest should not exist on disk
            assert not (Path(tmpdir) / "dest.txt").exists()

    @pytest.mark.asyncio
    async def test_mv_real_file(self):
        """Moving real file: source marked deleted, dest in memory."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "src.txt").write_text("content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.mv("/mnt/src.txt", "/mnt/dest.txt")

            # Source should appear deleted
            assert await fs.exists("/mnt/src.txt") is False

            # Dest should be readable
            content = await fs.read_file("/mnt/dest.txt")
            assert content == "content"

            # But real file still exists
            assert (Path(tmpdir) / "src.txt").exists()


class TestChmod:
    """Test permission changes."""

    @pytest.mark.asyncio
    async def test_chmod_memory_file(self):
        """chmod on memory file should work."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.write_file("/mnt/file.txt", "content")
            await fs.chmod("/mnt/file.txt", 0o755)

            stat = await fs.stat("/mnt/file.txt")
            assert stat.mode == 0o755

    @pytest.mark.asyncio
    async def test_chmod_real_file_copies_to_memory(self):
        """chmod on real file should copy to memory with new mode."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "file.txt"
            real_file.write_text("content")
            real_file.chmod(0o644)

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.chmod("/mnt/file.txt", 0o755)

            stat = await fs.stat("/mnt/file.txt")
            assert stat.mode == 0o755

            # Real file should be unchanged
            assert (real_file.stat().st_mode & 0o777) == 0o644


class TestPathHandling:
    """Test path normalization and resolution."""

    @pytest.mark.asyncio
    async def test_resolve_path(self):
        """resolve_path should work correctly."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            result = fs.resolve_path("/mnt/dir", "file.txt")
            assert result == "/mnt/dir/file.txt"

            result = fs.resolve_path("/mnt/dir", "/other/file.txt")
            assert result == "/other/file.txt"

    @pytest.mark.asyncio
    async def test_paths_with_dot_components(self):
        """Paths with . and .. should resolve correctly."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "file.txt").write_text("content")

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            content = await fs.read_file("/mnt/./file.txt")
            assert content == "content"

            content = await fs.read_file("/mnt/dir/../file.txt")
            assert content == "content"


class TestUtimes:
    """Test utimes() timestamp operations (issue #6)."""

    @pytest.mark.asyncio
    async def test_utimes_memory_file(self):
        """utimes on memory file should update mtime."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.write_file("/mnt/file.txt", "content")
            await fs.utimes("/mnt/file.txt", 1000000000.0, 1000000000.0)

            stat = await fs.stat("/mnt/file.txt")
            assert stat.mtime == 1000000000.0

    @pytest.mark.asyncio
    async def test_utimes_real_file_copies_to_memory(self):
        """utimes on real file should copy to memory with new mtime, leaving the real file unchanged."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            real_file = Path(tmpdir) / "file.txt"
            real_file.write_text("content")
            original_mtime = real_file.stat().st_mtime

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            await fs.utimes("/mnt/file.txt", 1000000000.0, 1000000000.0)

            stat = await fs.stat("/mnt/file.txt")
            assert stat.mtime == 1000000000.0

            # Real file should be unchanged
            assert real_file.stat().st_mtime == original_mtime

    @pytest.mark.asyncio
    async def test_utimes_nonexistent_file(self):
        """utimes() on a missing file should raise FileNotFoundError."""
        from phoenix.vendor.just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            with pytest.raises(FileNotFoundError):
                await fs.utimes("/mnt/nonexistent.txt", 1000000000.0, 1000000000.0)
