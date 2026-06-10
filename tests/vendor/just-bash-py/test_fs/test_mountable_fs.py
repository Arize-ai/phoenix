"""Tests for the MountableFs (multi-mount filesystem)."""

import pytest
import tempfile
from pathlib import Path


class TestMountOperations:
    """Test mount/unmount operations."""

    @pytest.mark.asyncio
    async def test_mount_filesystem(self):
        """mount() should add a filesystem at a path."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        child_fs = InMemoryFs(initial_files={"/file.txt": "content"})

        fs.mount("/mnt", child_fs)

        content = await fs.read_file("/mnt/file.txt")
        assert content == "content"

    @pytest.mark.asyncio
    async def test_unmount_filesystem(self):
        """unmount() should remove a filesystem."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        child_fs = InMemoryFs(initial_files={"/file.txt": "content"})

        fs.mount("/mnt", child_fs)
        assert await fs.exists("/mnt/file.txt")

        fs.unmount("/mnt")
        assert await fs.exists("/mnt/file.txt") is False

    @pytest.mark.asyncio
    async def test_get_mounts(self):
        """get_mounts() should return all mount points."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt1", InMemoryFs())
        fs.mount("/mnt2", InMemoryFs())

        mounts = fs.get_mounts()
        assert "/mnt1" in mounts
        assert "/mnt2" in mounts

    @pytest.mark.asyncio
    async def test_is_mount_point(self):
        """is_mount_point() should identify mount points."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", InMemoryFs())

        assert fs.is_mount_point("/mnt") is True
        assert fs.is_mount_point("/other") is False


class TestMountValidation:
    """Test mount validation."""

    @pytest.mark.asyncio
    async def test_prevent_root_mount(self):
        """Mounting at root should raise error."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())

        with pytest.raises(ValueError):
            fs.mount("/", InMemoryFs())

    @pytest.mark.asyncio
    async def test_nested_mounts_allowed(self):
        """Nested mounts should be allowed and route to the most specific mount."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        outer = InMemoryFs(initial_files={"/file.txt": "outer"})
        inner = InMemoryFs(initial_files={"/file.txt": "inner"})

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", outer)
        fs.mount("/mnt/nested", inner)

        # Access through outer mount
        content = await fs.read_file("/mnt/file.txt")
        assert content == "outer"

        # Access through inner mount (more specific)
        content = await fs.read_file("/mnt/nested/file.txt")
        assert content == "inner"

    @pytest.mark.asyncio
    async def test_parent_mount_of_existing_allowed(self):
        """Mounting a parent of an existing mount should be allowed."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs(initial_files={"/file.txt": "child"})
        parent = InMemoryFs(initial_files={"/file.txt": "parent"})

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt/child", child)
        fs.mount("/mnt", parent)

        # Child mount should still work (more specific)
        content = await fs.read_file("/mnt/child/file.txt")
        assert content == "child"

        # Parent mount should work for its own files
        content = await fs.read_file("/mnt/file.txt")
        assert content == "parent"

    @pytest.mark.asyncio
    async def test_prevent_duplicate_mount(self):
        """Mounting at an already-mounted path should raise error."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", InMemoryFs())

        with pytest.raises(ValueError):
            fs.mount("/mnt", InMemoryFs())


class TestPathRouting:
    """Test path routing to correct filesystem."""

    @pytest.mark.asyncio
    async def test_routes_to_correct_filesystem(self):
        """Paths should be routed to the correct mounted filesystem."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs1 = InMemoryFs(initial_files={"/file.txt": "fs1"})
        fs2 = InMemoryFs(initial_files={"/file.txt": "fs2"})

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt1", fs1)
        fs.mount("/mnt2", fs2)

        assert await fs.read_file("/mnt1/file.txt") == "fs1"
        assert await fs.read_file("/mnt2/file.txt") == "fs2"

    @pytest.mark.asyncio
    async def test_longest_prefix_match(self):
        """Should use longest matching mount point."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        short = InMemoryFs(initial_files={"/file.txt": "short"})
        long = InMemoryFs(initial_files={"/file.txt": "long"})

        fs = MountableFs(MountableFsOptions())
        fs.mount("/a", short)
        fs.mount("/a/b/c", long)

        # /a/b/c/file.txt should match /a/b/c mount
        assert await fs.read_file("/a/b/c/file.txt") == "long"

        # /a/file.txt should match /a mount
        assert await fs.read_file("/a/file.txt") == "short"

    @pytest.mark.asyncio
    async def test_write_to_mounted_fs(self):
        """Writes should go to the correct mounted filesystem."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs()

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", child)

        await fs.write_file("/mnt/new.txt", "content")

        # Should be readable through mount
        assert await fs.read_file("/mnt/new.txt") == "content"

        # Should also be in the child fs
        assert await child.read_file("/new.txt") == "content"


class TestBaseFilesystem:
    """Test operations on the base filesystem."""

    @pytest.mark.asyncio
    async def test_operations_outside_mounts_use_base(self):
        """Operations outside mounts should use base fs."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        base = InMemoryFs(initial_files={"/base.txt": "base content"})
        child = InMemoryFs()

        fs = MountableFs(MountableFsOptions(base=base))
        fs.mount("/mnt", child)

        # Read from base
        content = await fs.read_file("/base.txt")
        assert content == "base content"

    @pytest.mark.asyncio
    async def test_write_to_base(self):
        """Writing outside mounts should write to base fs."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        base = InMemoryFs()
        fs = MountableFs(MountableFsOptions(base=base))

        await fs.write_file("/outside.txt", "content")

        # Should be in base fs
        assert await base.read_file("/outside.txt") == "content"

    @pytest.mark.asyncio
    async def test_default_base_is_in_memory(self):
        """Default base should be InMemoryFs."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions

        fs = MountableFs(MountableFsOptions())

        await fs.write_file("/test.txt", "content")
        content = await fs.read_file("/test.txt")
        assert content == "content"


class TestReaddir:
    """Test directory listing with mounts."""

    @pytest.mark.asyncio
    async def test_readdir_shows_mount_points(self):
        """readdir should show mount points as directories."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        base = InMemoryFs()
        fs = MountableFs(MountableFsOptions(base=base))
        fs.mount("/mnt", InMemoryFs())

        await base.write_file("/file.txt", "content")

        entries = await fs.readdir("/")
        assert "mnt" in entries
        assert "file.txt" in entries

    @pytest.mark.asyncio
    async def test_readdir_merges_base_and_mount(self):
        """readdir should merge entries from base and child mount."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        base = InMemoryFs(initial_files={"/dir/base.txt": "base"})
        child = InMemoryFs(initial_files={"/child.txt": "child"})

        fs = MountableFs(MountableFsOptions(base=base))
        fs.mount("/dir/mnt", child)

        entries = await fs.readdir("/dir")
        assert "base.txt" in entries
        assert "mnt" in entries

    @pytest.mark.asyncio
    async def test_readdir_inside_mount(self):
        """readdir inside a mount should list mount's contents."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs(initial_files={
            "/a.txt": "a",
            "/b.txt": "b",
        })

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", child)

        entries = await fs.readdir("/mnt")
        assert "a.txt" in entries
        assert "b.txt" in entries


class TestCrossMountOperations:
    """Test operations across mount boundaries."""

    @pytest.mark.asyncio
    async def test_cp_across_mounts(self):
        """cp across mounts should work (read from one, write to other)."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        src_fs = InMemoryFs(initial_files={"/file.txt": "content"})
        dest_fs = InMemoryFs()

        fs = MountableFs(MountableFsOptions())
        fs.mount("/src", src_fs)
        fs.mount("/dest", dest_fs)

        await fs.cp("/src/file.txt", "/dest/file.txt")

        # Both should have the file
        assert await src_fs.read_file("/file.txt") == "content"
        assert await dest_fs.read_file("/file.txt") == "content"

    @pytest.mark.asyncio
    async def test_mv_across_mounts(self):
        """mv across mounts should copy and delete."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        src_fs = InMemoryFs(initial_files={"/file.txt": "content"})
        dest_fs = InMemoryFs()

        fs = MountableFs(MountableFsOptions())
        fs.mount("/src", src_fs)
        fs.mount("/dest", dest_fs)

        await fs.mv("/src/file.txt", "/dest/file.txt")

        # Source should be deleted
        assert await src_fs.exists("/file.txt") is False
        # Dest should have the file
        assert await dest_fs.read_file("/file.txt") == "content"


class TestHardLinkRestriction:
    """Test hard link restrictions across mounts."""

    @pytest.mark.asyncio
    async def test_link_within_same_mount_works(self):
        """Hard links within the same mount should work."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs(initial_files={"/original.txt": "content"})

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", child)

        await fs.link("/mnt/original.txt", "/mnt/link.txt")

        content = await fs.read_file("/mnt/link.txt")
        assert content == "content"

    @pytest.mark.asyncio
    async def test_link_across_mounts_raises_exdev(self):
        """Hard links across mounts should raise EXDEV error."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs1 = InMemoryFs(initial_files={"/file.txt": "content"})
        fs2 = InMemoryFs()

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt1", fs1)
        fs.mount("/mnt2", fs2)

        with pytest.raises(OSError) as excinfo:
            await fs.link("/mnt1/file.txt", "/mnt2/link.txt")
        assert "EXDEV" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_link_mount_to_base_raises_exdev(self):
        """Hard links from mount to base should raise EXDEV."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs(initial_files={"/file.txt": "content"})

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", child)

        with pytest.raises(OSError) as excinfo:
            await fs.link("/mnt/file.txt", "/link.txt")
        assert "EXDEV" in str(excinfo.value)


class TestVirtualDirectories:
    """Test virtual directories for mount point parents."""

    @pytest.mark.asyncio
    async def test_mount_point_parent_is_directory(self):
        """Parent directories of mount points should appear as directories."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        fs.mount("/a/b/c/mnt", InMemoryFs())

        assert await fs.is_directory("/a") is True
        assert await fs.is_directory("/a/b") is True
        assert await fs.is_directory("/a/b/c") is True

    @pytest.mark.asyncio
    async def test_readdir_shows_virtual_parent(self):
        """readdir should show virtual parent directories."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        fs.mount("/a/b/mnt", InMemoryFs())

        entries = await fs.readdir("/")
        assert "a" in entries

        entries = await fs.readdir("/a")
        assert "b" in entries


class TestMountConfig:
    """Test initial mount configuration."""

    @pytest.mark.asyncio
    async def test_initial_mounts(self):
        """MountConfig should set up initial mounts."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, MountConfig, InMemoryFs

        child1 = InMemoryFs(initial_files={"/file1.txt": "one"})
        child2 = InMemoryFs(initial_files={"/file2.txt": "two"})

        fs = MountableFs(MountableFsOptions(
            mounts=[
                MountConfig(mount_point="/mnt1", filesystem=child1),
                MountConfig(mount_point="/mnt2", filesystem=child2),
            ]
        ))

        assert await fs.read_file("/mnt1/file1.txt") == "one"
        assert await fs.read_file("/mnt2/file2.txt") == "two"


class TestStat:
    """Test stat operations."""

    @pytest.mark.asyncio
    async def test_stat_file_in_mount(self):
        """stat should work for files in mounts."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs(initial_files={"/file.txt": "hello"})
        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", child)

        stat = await fs.stat("/mnt/file.txt")
        assert stat.is_file is True
        assert stat.size == 5

    @pytest.mark.asyncio
    async def test_stat_mount_point(self):
        """stat on mount point should show directory."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", InMemoryFs())

        stat = await fs.stat("/mnt")
        assert stat.is_directory is True


class TestMkdir:
    """Test mkdir operations."""

    @pytest.mark.asyncio
    async def test_mkdir_in_mount(self):
        """mkdir in mount should create in child fs."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs()
        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", child)

        await fs.mkdir("/mnt/newdir")

        assert await child.is_directory("/newdir")

    @pytest.mark.asyncio
    async def test_mkdir_in_base(self):
        """mkdir outside mounts should create in base fs."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        base = InMemoryFs()
        fs = MountableFs(MountableFsOptions(base=base))

        await fs.mkdir("/newdir")

        assert await base.is_directory("/newdir")


class TestRm:
    """Test rm operations."""

    @pytest.mark.asyncio
    async def test_rm_in_mount(self):
        """rm in mount should delete from child fs."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs(initial_files={"/file.txt": "content"})
        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", child)

        await fs.rm("/mnt/file.txt")

        assert await child.exists("/file.txt") is False

    @pytest.mark.asyncio
    async def test_cannot_rm_mount_point(self):
        """Attempting to rm a mount point should fail."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", InMemoryFs())

        # Trying to remove the mount point itself should fail
        with pytest.raises(OSError):
            await fs.rm("/mnt")


class TestSymlinks:
    """Test symlink operations."""

    @pytest.mark.asyncio
    async def test_symlink_in_mount(self):
        """symlink in mount should work."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        child = InMemoryFs(initial_files={"/target.txt": "content"})
        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", child)

        await fs.symlink("/target.txt", "/mnt/link.txt")

        content = await fs.read_file("/mnt/link.txt")
        assert content == "content"


class TestResolve:
    """Test path resolution."""

    @pytest.mark.asyncio
    async def test_resolve_path(self):
        """resolve_path should work correctly."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions

        fs = MountableFs(MountableFsOptions())

        result = fs.resolve_path("/dir", "file.txt")
        assert result == "/dir/file.txt"

        result = fs.resolve_path("/dir", "/other/file.txt")
        assert result == "/other/file.txt"


class TestUtimes:
    """Test utimes() delegation to mounted filesystems (issue #6)."""

    @pytest.mark.asyncio
    async def test_utimes_routes_to_mount(self):
        """utimes() should delegate to the mounted filesystem."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        child_fs = InMemoryFs(initial_files={"/file.txt": "content"})
        fs.mount("/mnt", child_fs)

        await fs.utimes("/mnt/file.txt", 1000000000.0, 1000000000.0)

        stat = await fs.stat("/mnt/file.txt")
        assert stat.mtime == 1000000000.0

    @pytest.mark.asyncio
    async def test_utimes_nonexistent_file(self):
        """utimes() on a missing file should raise FileNotFoundError."""
        from phoenix.vendor.just_bash.fs import MountableFs, MountableFsOptions, InMemoryFs

        fs = MountableFs(MountableFsOptions())
        fs.mount("/mnt", InMemoryFs())

        with pytest.raises(FileNotFoundError):
            await fs.utimes("/mnt/nonexistent.txt", 1000000000.0, 1000000000.0)
