"""Security tests for OverlayFs."""

import pytest
import tempfile
from pathlib import Path


class TestPathTraversal:
    """Test protection against path traversal attacks."""

    @pytest.mark.asyncio
    async def test_block_traversal_above_mount(self):
        """Paths traversing above mount point should be blocked."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a file we shouldn't be able to access
            secret = Path(tmpdir).parent / "secret.txt"
            # Don't actually create the secret, but test the path would be blocked

            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # Try to traverse above mount point
            with pytest.raises(FileNotFoundError):
                await fs.read_file("/mnt/../../../etc/passwd")

    @pytest.mark.asyncio
    async def test_normalized_traversal_blocked(self):
        """Various path traversal attempts should be normalized and blocked."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # Various traversal attempts - all should fail or be safely normalized
            traversal_attempts = [
                "/mnt/../../../etc/passwd",
                "/mnt/dir/../../../../../../etc/passwd",
                "/mnt/./dir/../../../etc/shadow",
            ]

            for path in traversal_attempts:
                # Should not be able to access anything outside mount
                assert await fs.exists(path) is False

    @pytest.mark.asyncio
    async def test_write_traversal_blocked(self):
        """Writing via path traversal should be blocked."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # Even if this somehow succeeded, it should write to memory not disk
            # and should be within the overlay's scope
            await fs.write_file("/mnt/../../../tmp/malicious.txt", "bad")

            # The file should NOT exist at the system /tmp
            assert not Path("/tmp/malicious.txt").exists()


class TestSymlinkEscape:
    """Test protection against symlink-based escapes."""

    @pytest.mark.asyncio
    async def test_symlink_to_outside_blocked(self):
        """Symlinks pointing outside the overlay should not allow escape."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # Create symlink pointing outside
            await fs.symlink("/etc/passwd", "/mnt/escape_link")

            # Reading through this link should fail safely
            # (it points outside our mount/overlay)
            with pytest.raises(FileNotFoundError):
                await fs.read_file("/mnt/escape_link")

    @pytest.mark.asyncio
    async def test_real_symlink_escape_blocked(self):
        """Real symlinks on disk pointing outside should be blocked."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a real symlink pointing outside
            link_path = Path(tmpdir) / "escape"
            try:
                link_path.symlink_to("/etc/passwd")

                fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

                # Following this symlink should fail - it escapes the overlay
                with pytest.raises(FileNotFoundError):
                    await fs.read_file("/mnt/escape")
            finally:
                if link_path.is_symlink():
                    link_path.unlink()


class TestRootIsolation:
    """Test that operations are properly isolated to the configured root."""

    @pytest.mark.asyncio
    async def test_root_stays_within_bounds(self):
        """All operations should stay within the configured root."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir) / "sandbox"
            subdir.mkdir()
            (subdir / "allowed.txt").write_text("allowed")

            # Create file outside sandbox (in parent)
            outside = Path(tmpdir) / "outside.txt"
            outside.write_text("outside")

            # OverlayFs rooted at the subdir
            fs = OverlayFs(OverlayFsOptions(root=str(subdir), mount_point="/mnt"))

            # Should be able to read the allowed file
            content = await fs.read_file("/mnt/allowed.txt")
            assert content == "allowed"

            # Should NOT be able to access the outside file via traversal
            assert await fs.exists("/mnt/../outside.txt") is False

    @pytest.mark.asyncio
    async def test_absolute_paths_still_rooted(self):
        """Absolute paths in the virtual fs should still be rooted."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = OverlayFs(OverlayFsOptions(root=tmpdir, mount_point="/mnt"))

            # These paths look absolute but should be handled as virtual paths
            assert await fs.exists("/etc/passwd") is False
            assert await fs.exists("/bin/sh") is False
