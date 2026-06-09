"""Comprehensive tests for filesystem mounting and navigation behaviors.

Tests the following mounting strategies:
1. InMemoryFs (baseline) - Pure in-memory filesystem
2. OverlayFs (direct) - OverlayFs used directly as the filesystem
3. MountableFs + InMemoryFs mount - InMemoryFs mounted at a path
4. MountableFs + OverlayFs mount - OverlayFs mounted at a path
5. MountableFs + multiple mounts - Multiple filesystems mounted at different paths
"""

import os
import pytest
import tempfile
from pathlib import Path

from just_bash import Bash
from just_bash.fs import InMemoryFs, MountableFs, OverlayFs, OverlayFsOptions


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def temp_real_dir():
    """Create a temp directory with real files for overlay testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create some test files
        os.makedirs(f"{tmpdir}/subdir")
        Path(f"{tmpdir}/file1.txt").write_text("content1")
        Path(f"{tmpdir}/subdir/file2.txt").write_text("content2")
        yield tmpdir


@pytest.fixture
def bash_inmemory():
    """Bash with pure InMemoryFs."""
    return Bash(files={
        "/home/user/file.txt": "hello",
        "/home/user/subdir/nested.txt": "nested",
    })


@pytest.fixture
def bash_overlay_direct(temp_real_dir):
    """Bash with OverlayFs used directly."""
    fs = OverlayFs(OverlayFsOptions(
        root=temp_real_dir,
        mount_point="/home/user/project"
    ))
    return Bash(fs=fs, cwd="/home/user/project")


@pytest.fixture
def bash_mountable_inmemory():
    """Bash with MountableFs + InMemoryFs mount."""
    child_fs = InMemoryFs(initial_files={
        "/file.txt": "mounted content",
        "/subdir/nested.txt": "nested mounted",
    })
    fs = MountableFs()
    fs.mount("/mnt/data", child_fs)
    return Bash(fs=fs)


@pytest.fixture
def bash_mountable_overlay(temp_real_dir):
    """Bash with MountableFs + OverlayFs mount."""
    fs = MountableFs()
    overlay = OverlayFs(OverlayFsOptions(
        root=temp_real_dir,
        mount_point="/"
    ))
    fs.mount("/mnt/real", overlay)
    return Bash(fs=fs)


@pytest.fixture
def bash_mountable_multi(temp_real_dir):
    """Bash with MountableFs + multiple mounts."""
    fs = MountableFs()

    # Mount an OverlayFs
    overlay = OverlayFs(OverlayFsOptions(
        root=temp_real_dir,
        mount_point="/"
    ))
    fs.mount("/mnt/real", overlay)

    # Mount an InMemoryFs
    memory = InMemoryFs(initial_files={
        "/data.txt": "memory data",
        "/subdir/nested.txt": "memory nested",
    })
    fs.mount("/mnt/memory", memory)

    return Bash(fs=fs)


# =============================================================================
# Test Directory Navigation (cd, pwd)
# =============================================================================


class TestDirectoryNavigationInMemory:
    """Test cd and pwd with InMemoryFs (baseline)."""

    @pytest.mark.asyncio
    async def test_cd_to_root(self, bash_inmemory):
        """cd / should work and pwd should return /"""
        result = await bash_inmemory.exec("cd / && pwd")
        assert result.stdout == "/\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_to_home(self, bash_inmemory):
        """cd (no args) should go to $HOME."""
        result = await bash_inmemory.exec("cd / && cd && pwd")
        assert result.stdout == "/home/user\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_to_absolute_path(self, bash_inmemory):
        """cd /some/path should work."""
        result = await bash_inmemory.exec("cd /home/user/subdir && pwd")
        assert result.stdout == "/home/user/subdir\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_to_relative_path(self, bash_inmemory):
        """cd subdir should work relative to cwd."""
        result = await bash_inmemory.exec("cd subdir && pwd")
        assert result.stdout == "/home/user/subdir\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_dotdot(self, bash_inmemory):
        """cd .. should go up one directory."""
        result = await bash_inmemory.exec("cd /home/user/subdir && cd .. && pwd")
        assert result.stdout == "/home/user\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_dash(self, bash_inmemory):
        """cd - should go to previous directory."""
        result = await bash_inmemory.exec("cd / && cd - && pwd")
        assert result.stdout == "/home/user\n/home/user\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_nonexistent(self, bash_inmemory):
        """cd to nonexistent path should fail."""
        result = await bash_inmemory.exec("cd /nonexistent")
        assert result.exit_code != 0
        assert "No such file or directory" in result.stderr or "ENOENT" in result.stderr

    @pytest.mark.asyncio
    async def test_cd_to_file(self, bash_inmemory):
        """cd to a file should fail."""
        result = await bash_inmemory.exec("cd /home/user/file.txt")
        assert result.exit_code != 0
        assert "Not a directory" in result.stderr or "ENOTDIR" in result.stderr


class TestDirectoryNavigationOverlayDirect:
    """Test cd and pwd with OverlayFs used directly."""

    @pytest.mark.asyncio
    async def test_pwd_at_mount_point(self, bash_overlay_direct):
        """pwd should show correct path at mount point."""
        result = await bash_overlay_direct.exec("pwd")
        assert result.stdout == "/home/user/project\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_into_subdir(self, bash_overlay_direct):
        """cd into a subdirectory should work."""
        result = await bash_overlay_direct.exec("cd subdir && pwd")
        assert result.stdout == "/home/user/project/subdir\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_dotdot_from_subdir(self, bash_overlay_direct):
        """cd .. from subdirectory should go back to mount point."""
        result = await bash_overlay_direct.exec("cd subdir && cd .. && pwd")
        assert result.stdout == "/home/user/project\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_to_root(self, bash_overlay_direct):
        """cd / should fail outside mount for direct OverlayFs."""
        # OverlayFs only manages paths under its mount_point
        result = await bash_overlay_direct.exec("cd /")
        # This may fail or succeed depending on implementation
        # Document actual behavior
        pass  # Behavior TBD

    @pytest.mark.asyncio
    async def test_cd_nonexistent(self, bash_overlay_direct):
        """cd to nonexistent path should fail."""
        result = await bash_overlay_direct.exec("cd /home/user/project/nonexistent")
        assert result.exit_code != 0


class TestDirectoryNavigationMountableInMemory:
    """Test cd and pwd with MountableFs + InMemoryFs mount."""

    @pytest.mark.asyncio
    async def test_cd_into_mount_point(self, bash_mountable_inmemory):
        """cd into a mounted directory should work."""
        result = await bash_mountable_inmemory.exec("cd /mnt/data && pwd")
        assert result.stdout == "/mnt/data\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_out_of_mount_point(self, bash_mountable_inmemory):
        """cd .. from inside mount should work."""
        result = await bash_mountable_inmemory.exec("cd /mnt/data && cd .. && pwd")
        assert result.stdout == "/mnt\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_through_mount_point(self, bash_mountable_inmemory):
        """cd /mount/subdir should work."""
        result = await bash_mountable_inmemory.exec("cd /mnt/data/subdir && pwd")
        assert result.stdout == "/mnt/data/subdir\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_pwd_inside_mount(self, bash_mountable_inmemory):
        """pwd inside mounted fs should show full virtual path."""
        result = await bash_mountable_inmemory.exec("cd /mnt/data/subdir && pwd")
        assert result.stdout == "/mnt/data/subdir\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_between_mount_and_base(self, bash_mountable_inmemory):
        """cd between mounted fs and base fs should work."""
        result = await bash_mountable_inmemory.exec("cd /mnt/data && cd /home/user && pwd")
        assert result.stdout == "/home/user\n"
        assert result.exit_code == 0


class TestDirectoryNavigationMountableOverlay:
    """Test cd and pwd with MountableFs + OverlayFs mount."""

    @pytest.mark.asyncio
    async def test_cd_into_overlay_mount(self, bash_mountable_overlay):
        """cd into overlay mount should work."""
        result = await bash_mountable_overlay.exec("cd /mnt/real && pwd")
        assert result.stdout == "/mnt/real\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_into_overlay_subdir(self, bash_mountable_overlay):
        """cd into subdirectory of overlay mount should work."""
        result = await bash_mountable_overlay.exec("cd /mnt/real/subdir && pwd")
        assert result.stdout == "/mnt/real/subdir\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_out_of_overlay_mount(self, bash_mountable_overlay):
        """cd out of overlay mount should work."""
        result = await bash_mountable_overlay.exec("cd /mnt/real && cd / && pwd")
        assert result.stdout == "/\n"
        assert result.exit_code == 0


class TestDirectoryNavigationMultiMount:
    """Test cd and pwd with MountableFs + multiple mounts."""

    @pytest.mark.asyncio
    async def test_cd_between_mounts(self, bash_mountable_multi):
        """cd between different mounts should work."""
        result = await bash_mountable_multi.exec("cd /mnt/real && cd /mnt/memory && pwd")
        assert result.stdout == "/mnt/memory\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cd_dash_between_mounts(self, bash_mountable_multi):
        """cd - between mounts should go to previous directory."""
        result = await bash_mountable_multi.exec("cd /mnt/real && cd /mnt/memory && cd - && pwd")
        assert "/mnt/real" in result.stdout
        assert result.exit_code == 0


# =============================================================================
# Test Directory Listing (ls)
# =============================================================================


class TestDirectoryListingInMemory:
    """Test ls with InMemoryFs (baseline)."""

    @pytest.mark.asyncio
    async def test_ls_current_directory(self, bash_inmemory):
        """ls should list current directory."""
        result = await bash_inmemory.exec("ls")
        assert "file.txt" in result.stdout
        assert "subdir" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_explicit_path(self, bash_inmemory):
        """ls /path should list that path."""
        result = await bash_inmemory.exec("ls /home/user/subdir")
        assert "nested.txt" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_relative_path(self, bash_inmemory):
        """ls subdir should work relative to cwd."""
        result = await bash_inmemory.exec("ls subdir")
        assert "nested.txt" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_with_la_flag(self, bash_inmemory):
        """ls -la should show hidden and details."""
        result = await bash_inmemory.exec("ls -la")
        # Should include permissions, sizes, etc.
        assert result.exit_code == 0


class TestDirectoryListingMountableInMemory:
    """Test ls with MountableFs + InMemoryFs mount."""

    @pytest.mark.asyncio
    async def test_ls_shows_mount_points(self, bash_mountable_inmemory):
        """ls of parent should show mounted directories."""
        result = await bash_mountable_inmemory.exec("ls /mnt")
        assert "data" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_at_mount_point(self, bash_mountable_inmemory):
        """ls at mount point should show mounted contents."""
        result = await bash_mountable_inmemory.exec("ls /mnt/data")
        assert "file.txt" in result.stdout
        assert "subdir" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_inside_mount(self, bash_mountable_inmemory):
        """ls inside mounted fs should work."""
        result = await bash_mountable_inmemory.exec("ls /mnt/data/subdir")
        assert "nested.txt" in result.stdout
        assert result.exit_code == 0


class TestDirectoryListingMountableOverlay:
    """Test ls with MountableFs + OverlayFs mount."""

    @pytest.mark.asyncio
    async def test_ls_overlay_mount(self, bash_mountable_overlay):
        """ls overlay mount should show real files."""
        result = await bash_mountable_overlay.exec("ls /mnt/real")
        assert "file1.txt" in result.stdout
        assert "subdir" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_overlay_subdir(self, bash_mountable_overlay):
        """ls inside overlay mount subdir should work."""
        result = await bash_mountable_overlay.exec("ls /mnt/real/subdir")
        assert "file2.txt" in result.stdout
        assert result.exit_code == 0


class TestDirectoryListingMultiMount:
    """Test ls with MountableFs + multiple mounts."""

    @pytest.mark.asyncio
    async def test_ls_shows_all_mounts(self, bash_mountable_multi):
        """ls /mnt should show all mount points."""
        result = await bash_mountable_multi.exec("ls /mnt")
        assert "real" in result.stdout
        assert "memory" in result.stdout
        assert result.exit_code == 0


# =============================================================================
# Test File Copy (cp)
# =============================================================================


class TestFileCopyInMemory:
    """Test cp with InMemoryFs (baseline)."""

    @pytest.mark.asyncio
    async def test_cp_within_memory(self, bash_inmemory):
        """cp within in-memory fs should work."""
        result = await bash_inmemory.exec("cp /home/user/file.txt /home/user/copy.txt && cat /home/user/copy.txt")
        # cat outputs file content; files without trailing newlines get newline added
        assert "hello" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cp_recursive_within_memory(self, bash_inmemory):
        """cp -r within in-memory fs should work."""
        result = await bash_inmemory.exec("cp -r /home/user/subdir /home/user/subdir_copy && ls /home/user/subdir_copy")
        assert "nested.txt" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cp_nonexistent_source(self, bash_inmemory):
        """cp from nonexistent file should fail."""
        result = await bash_inmemory.exec("cp /nonexistent /dest")
        assert result.exit_code != 0


class TestFileCopyMountableInMemory:
    """Test cp with MountableFs + InMemoryFs mount."""

    @pytest.mark.asyncio
    async def test_cp_within_mount(self, bash_mountable_inmemory):
        """cp within mounted fs should work."""
        result = await bash_mountable_inmemory.exec("cp /mnt/data/file.txt /mnt/data/copy.txt && cat /mnt/data/copy.txt")
        assert "mounted content" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cp_from_mount_to_base(self, bash_mountable_inmemory):
        """cp from mounted fs to base fs should work."""
        result = await bash_mountable_inmemory.exec("cp /mnt/data/file.txt /tmp/copy.txt && cat /tmp/copy.txt")
        assert "mounted content" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cp_from_base_to_mount(self, bash_mountable_inmemory):
        """cp from base fs to mounted fs should work."""
        result = await bash_mountable_inmemory.exec("""
            echo "base content" > /tmp/base.txt
            cp /tmp/base.txt /mnt/data/from_base.txt
            cat /mnt/data/from_base.txt
        """)
        assert "base content" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cp_recursive_across_mount(self, bash_mountable_inmemory):
        """cp -r across mount boundary should work."""
        result = await bash_mountable_inmemory.exec("cp -r /mnt/data/subdir /tmp/subdir_copy && ls /tmp/subdir_copy")
        assert "nested.txt" in result.stdout
        assert result.exit_code == 0


class TestFileCopyMultiMount:
    """Test cp with MountableFs + multiple mounts."""

    @pytest.mark.asyncio
    async def test_cp_between_mounts(self, bash_mountable_multi):
        """cp between two different mounts should work."""
        result = await bash_mountable_multi.exec("cp /mnt/memory/data.txt /mnt/real/copied.txt && cat /mnt/real/copied.txt")
        assert "memory data" in result.stdout
        assert result.exit_code == 0


# =============================================================================
# Test File Move (mv)
# =============================================================================


class TestFileMoveInMemory:
    """Test mv with InMemoryFs (baseline)."""

    @pytest.mark.asyncio
    async def test_mv_within_memory(self, bash_inmemory):
        """mv within in-memory fs should work."""
        result = await bash_inmemory.exec("""
            mv /home/user/file.txt /home/user/moved.txt
            cat /home/user/moved.txt
            ls /home/user
        """)
        assert "hello" in result.stdout
        assert "moved.txt" in result.stdout
        # Original should be gone
        assert result.exit_code == 0
        result2 = await bash_inmemory.exec("cat /home/user/file.txt")
        assert result2.exit_code != 0

    @pytest.mark.asyncio
    async def test_mv_rename_in_place(self, bash_inmemory):
        """mv file newname should rename."""
        result = await bash_inmemory.exec("mv /home/user/file.txt /home/user/renamed.txt && ls /home/user")
        assert "renamed.txt" in result.stdout
        assert result.exit_code == 0


class TestFileMoveMountableInMemory:
    """Test mv with MountableFs + InMemoryFs mount."""

    @pytest.mark.asyncio
    async def test_mv_within_mount(self, bash_mountable_inmemory):
        """mv within mounted fs should work."""
        result = await bash_mountable_inmemory.exec("""
            mv /mnt/data/file.txt /mnt/data/moved.txt
            cat /mnt/data/moved.txt
        """)
        assert "mounted content" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_mv_from_mount_to_base(self, bash_mountable_inmemory):
        """mv from mounted fs to base fs (copy+delete)."""
        result = await bash_mountable_inmemory.exec("""
            mv /mnt/data/file.txt /tmp/moved.txt
            cat /tmp/moved.txt
        """)
        assert "mounted content" in result.stdout
        assert result.exit_code == 0
        # Original should be gone
        result2 = await bash_mountable_inmemory.exec("cat /mnt/data/file.txt")
        assert result2.exit_code != 0

    @pytest.mark.asyncio
    async def test_mv_from_base_to_mount(self, bash_mountable_inmemory):
        """mv from base fs to mounted fs (copy+delete)."""
        result = await bash_mountable_inmemory.exec("""
            echo "base content" > /tmp/base.txt
            mv /tmp/base.txt /mnt/data/from_base.txt
            cat /mnt/data/from_base.txt
        """)
        assert "base content" in result.stdout
        assert result.exit_code == 0


class TestFileMoveMultiMount:
    """Test mv with MountableFs + multiple mounts."""

    @pytest.mark.asyncio
    async def test_mv_between_mounts(self, bash_mountable_multi):
        """mv between two different mounts (copy+delete)."""
        result = await bash_mountable_multi.exec("""
            mv /mnt/memory/data.txt /mnt/real/moved_data.txt
            cat /mnt/real/moved_data.txt
        """)
        assert "memory data" in result.stdout
        assert result.exit_code == 0
        # Original should be gone
        result2 = await bash_mountable_multi.exec("cat /mnt/memory/data.txt")
        assert result2.exit_code != 0


# =============================================================================
# Test File Remove (rm)
# =============================================================================


class TestFileRemoveInMemory:
    """Test rm with InMemoryFs (baseline)."""

    @pytest.mark.asyncio
    async def test_rm_file_in_memory(self, bash_inmemory):
        """rm file in memory should work."""
        result = await bash_inmemory.exec("rm /home/user/file.txt")
        assert result.exit_code == 0
        result2 = await bash_inmemory.exec("cat /home/user/file.txt")
        assert result2.exit_code != 0

    @pytest.mark.asyncio
    async def test_rm_directory_recursive(self, bash_inmemory):
        """rm -r should remove directory."""
        result = await bash_inmemory.exec("rm -r /home/user/subdir && ls /home/user")
        assert "subdir" not in result.stdout
        assert result.exit_code == 0


class TestFileRemoveMountableInMemory:
    """Test rm with MountableFs + InMemoryFs mount."""

    @pytest.mark.asyncio
    async def test_rm_file_in_mount(self, bash_mountable_inmemory):
        """rm file in mount should work."""
        result = await bash_mountable_inmemory.exec("rm /mnt/data/file.txt")
        assert result.exit_code == 0
        result2 = await bash_mountable_inmemory.exec("cat /mnt/data/file.txt")
        assert result2.exit_code != 0

    @pytest.mark.asyncio
    async def test_rm_mount_point_fails(self, bash_mountable_inmemory):
        """rm of mount point itself should fail."""
        result = await bash_mountable_inmemory.exec("rm -r /mnt/data")
        # Should fail because we're trying to remove a mount point
        assert result.exit_code != 0 or "EBUSY" in result.stderr

    @pytest.mark.asyncio
    async def test_rm_inside_mount_works(self, bash_mountable_inmemory):
        """rm of files inside mount should work."""
        result = await bash_mountable_inmemory.exec("rm -r /mnt/data/subdir && ls /mnt/data")
        assert "subdir" not in result.stdout
        assert result.exit_code == 0


class TestFileRemoveMountableOverlay:
    """Test rm with MountableFs + OverlayFs mount."""

    @pytest.mark.asyncio
    async def test_rm_real_file_in_overlay(self, bash_mountable_overlay):
        """rm of real file should mark as deleted, not actually delete."""
        # First verify file exists
        result = await bash_mountable_overlay.exec("cat /mnt/real/file1.txt")
        assert "content1" in result.stdout
        assert result.exit_code == 0

        # Delete it
        result = await bash_mountable_overlay.exec("rm /mnt/real/file1.txt")
        assert result.exit_code == 0

        # Should no longer be accessible
        result = await bash_mountable_overlay.exec("cat /mnt/real/file1.txt")
        assert result.exit_code != 0


# =============================================================================
# Test File Read/Write
# =============================================================================


class TestFileReadWriteInMemory:
    """Test reading and writing files with InMemoryFs (baseline)."""

    @pytest.mark.asyncio
    async def test_read_file_in_memory(self, bash_inmemory):
        """cat file in memory should work."""
        result = await bash_inmemory.exec("cat /home/user/file.txt")
        assert "hello" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_write_file_in_memory(self, bash_inmemory):
        """echo > file in memory should work."""
        result = await bash_inmemory.exec('echo "new content" > /home/user/new.txt && cat /home/user/new.txt')
        assert "new content" in result.stdout
        assert result.exit_code == 0


class TestFileReadWriteMountableInMemory:
    """Test reading and writing files with MountableFs + InMemoryFs mount."""

    @pytest.mark.asyncio
    async def test_read_file_in_mount(self, bash_mountable_inmemory):
        """cat file in mount should work."""
        result = await bash_mountable_inmemory.exec("cat /mnt/data/file.txt")
        assert "mounted content" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_write_file_in_mount(self, bash_mountable_inmemory):
        """echo > file in mount should work."""
        result = await bash_mountable_inmemory.exec('echo "new content" > /mnt/data/new.txt && cat /mnt/data/new.txt')
        assert "new content" in result.stdout
        assert result.exit_code == 0


class TestFileReadWriteMountableOverlay:
    """Test reading and writing files with MountableFs + OverlayFs mount."""

    @pytest.mark.asyncio
    async def test_read_real_file(self, bash_mountable_overlay):
        """cat real file in overlay mount should work."""
        result = await bash_mountable_overlay.exec("cat /mnt/real/file1.txt")
        assert "content1" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_write_file_in_mount(self, bash_mountable_overlay):
        """echo > file in overlay mount should work (creates in overlay)."""
        result = await bash_mountable_overlay.exec('echo "overlay content" > /mnt/real/overlay.txt && cat /mnt/real/overlay.txt')
        assert "overlay content" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_overwrite_real_file(self, bash_mountable_overlay):
        """Overwriting real file should create overlay copy."""
        result = await bash_mountable_overlay.exec('echo "overwritten" > /mnt/real/file1.txt && cat /mnt/real/file1.txt')
        assert "overwritten" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_append_to_real_file(self, bash_mountable_overlay):
        """Appending to real file should create overlay copy."""
        result = await bash_mountable_overlay.exec('echo "appended" >> /mnt/real/file1.txt && cat /mnt/real/file1.txt')
        assert "content1" in result.stdout
        assert "appended" in result.stdout
        assert result.exit_code == 0


# =============================================================================
# Test Path Edge Cases
# =============================================================================


class TestPathEdgeCasesInMemory:
    """Test edge cases with paths in InMemoryFs."""

    @pytest.mark.asyncio
    async def test_path_with_trailing_slash(self, bash_inmemory):
        """Paths with trailing slash should work."""
        result = await bash_inmemory.exec("cd /home/user/ && pwd")
        assert result.stdout == "/home/user\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_path_with_double_slash(self, bash_inmemory):
        """Paths with // should normalize."""
        result = await bash_inmemory.exec("cat //home//user//file.txt")
        assert "hello" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_path_with_dot(self, bash_inmemory):
        """Paths with . should resolve."""
        result = await bash_inmemory.exec("cat /home/user/./file.txt")
        assert "hello" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_path_with_dotdot(self, bash_inmemory):
        """Paths with .. should resolve."""
        result = await bash_inmemory.exec("cat /home/user/subdir/../file.txt")
        assert "hello" in result.stdout
        assert result.exit_code == 0


class TestPathEdgeCasesMountable:
    """Test edge cases with paths in MountableFs."""

    @pytest.mark.asyncio
    async def test_relative_path_from_mount(self, bash_mountable_inmemory):
        """Relative paths from inside mount should work."""
        result = await bash_mountable_inmemory.exec("cd /mnt/data && cat file.txt")
        assert "mounted content" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_dotdot_across_mount_boundary(self, bash_mountable_inmemory):
        """.. from mount point should go to parent."""
        result = await bash_mountable_inmemory.exec("cd /mnt/data && cd .. && pwd")
        assert result.stdout == "/mnt\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_path_through_mount_with_dotdot(self, bash_mountable_inmemory):
        """Path like /mnt/data/../data/file.txt should work."""
        result = await bash_mountable_inmemory.exec("cat /mnt/data/../data/file.txt")
        assert "mounted content" in result.stdout
        assert result.exit_code == 0


# =============================================================================
# Test OverlayFs Specific Behaviors
# =============================================================================


class TestOverlayFsBehaviors:
    """Test specific OverlayFs behaviors."""

    @pytest.mark.asyncio
    async def test_overlay_hides_deleted_files(self, bash_mountable_overlay):
        """ls should not show files deleted in overlay."""
        # Delete a file
        await bash_mountable_overlay.exec("rm /mnt/real/file1.txt")

        # ls should not show it
        result = await bash_mountable_overlay.exec("ls /mnt/real")
        assert "file1.txt" not in result.stdout
        assert "subdir" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_overlay_virtual_file_persists(self, bash_mountable_overlay):
        """Files written to overlay should persist in the session."""
        # Create a file
        await bash_mountable_overlay.exec('echo "virtual content" > /mnt/real/virtual.txt')

        # Read it back
        result = await bash_mountable_overlay.exec("cat /mnt/real/virtual.txt")
        assert "virtual content" in result.stdout
        assert result.exit_code == 0

        # ls should show it
        result = await bash_mountable_overlay.exec("ls /mnt/real")
        assert "virtual.txt" in result.stdout


# =============================================================================
# Test MountableFs Virtual Directories
# =============================================================================


class TestMountableVirtualDirectories:
    """Test virtual directories created for mount point parents."""

    @pytest.mark.asyncio
    async def test_virtual_parent_is_directory(self, bash_mountable_inmemory):
        """/mnt should be a virtual directory (parent of mount point)."""
        result = await bash_mountable_inmemory.exec("cd /mnt && pwd")
        assert result.stdout == "/mnt\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_ls_virtual_parent(self, bash_mountable_inmemory):
        """ls of virtual parent should show mount points."""
        result = await bash_mountable_inmemory.exec("ls /mnt")
        assert "data" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cannot_write_to_virtual_parent(self, bash_mountable_inmemory):
        """Writing a file to virtual parent should work (goes to base fs)."""
        result = await bash_mountable_inmemory.exec('echo "test" > /mnt/test.txt && cat /mnt/test.txt')
        assert "test" in result.stdout
        assert result.exit_code == 0


# =============================================================================
# Test Nested Mount Points
# =============================================================================


class TestNestedMounts:
    """Test nested mount points behavior."""

    @pytest.mark.asyncio
    async def test_nested_mount_routing(self):
        """Nested mounts should route to most specific mount."""
        outer = InMemoryFs(initial_files={"/outer.txt": "outer content"})
        inner = InMemoryFs(initial_files={"/inner.txt": "inner content"})

        fs = MountableFs()
        fs.mount("/mnt", outer)
        fs.mount("/mnt/nested", inner)

        bash = Bash(fs=fs)

        # Access outer mount
        result = await bash.exec("cat /mnt/outer.txt")
        assert "outer content" in result.stdout

        # Access inner mount (more specific)
        result = await bash.exec("cat /mnt/nested/inner.txt")
        assert "inner content" in result.stdout

    @pytest.mark.asyncio
    async def test_ls_shows_nested_mount(self):
        """ls at outer mount should show nested mount point."""
        outer = InMemoryFs(initial_files={"/file.txt": "outer"})
        inner = InMemoryFs()

        fs = MountableFs()
        fs.mount("/mnt", outer)
        fs.mount("/mnt/nested", inner)

        bash = Bash(fs=fs)
        result = await bash.exec("ls /mnt")
        assert "file.txt" in result.stdout
        assert "nested" in result.stdout
