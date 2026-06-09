"""Tests for tar command."""

import pytest
from just_bash import Bash


class TestTarBasic:
    """Test basic tar functionality."""

    @pytest.mark.asyncio
    async def test_tar_create(self):
        """Create archive with -c."""
        bash = Bash(files={
            "/dir/a.txt": "aaa\n",
            "/dir/b.txt": "bbb\n",
        })
        result = await bash.exec("tar -cf /archive.tar /dir")
        assert result.exit_code == 0
        assert await bash.fs.exists("/archive.tar")

    @pytest.mark.asyncio
    async def test_tar_list(self):
        """List archive contents with -t."""
        bash = Bash(files={
            "/dir/a.txt": "aaa\n",
            "/dir/b.txt": "bbb\n",
        })
        await bash.exec("tar -cf /archive.tar /dir")
        result = await bash.exec("tar -tf /archive.tar")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_tar_extract(self):
        """Extract archive with -x."""
        bash = Bash(files={"/dir/test.txt": "content\n"})
        await bash.exec("tar -cf /archive.tar /dir")
        await bash.exec("rm -rf /dir")
        result = await bash.exec("tar -xf /archive.tar")
        assert result.exit_code == 0
        assert await bash.fs.exists("/dir/test.txt")

    @pytest.mark.asyncio
    async def test_tar_verbose(self):
        """Verbose output with -v."""
        bash = Bash(files={"/dir/a.txt": "aaa\n"})
        result = await bash.exec("tar -cvf /archive.tar /dir")
        assert result.exit_code == 0
        # Should show files being added (verbose goes to stderr)
        assert "a.txt" in result.stderr or "dir" in result.stderr


class TestTarCompression:
    """Test compression options."""

    @pytest.mark.asyncio
    async def test_tar_gzip(self):
        """Create gzip archive with -z."""
        bash = Bash(files={"/dir/test.txt": "content\n"})
        result = await bash.exec("tar -czf /archive.tar.gz /dir")
        assert result.exit_code == 0
        assert await bash.fs.exists("/archive.tar.gz")

    @pytest.mark.asyncio
    async def test_tar_extract_gzip(self):
        """Extract gzip archive with -z."""
        bash = Bash(files={"/dir/test.txt": "content\n"})
        await bash.exec("tar -czf /archive.tar.gz /dir")
        await bash.exec("rm -rf /dir")
        result = await bash.exec("tar -xzf /archive.tar.gz")
        assert result.exit_code == 0


class TestTarOptions:
    """Test additional tar options."""

    @pytest.mark.asyncio
    async def test_tar_exclude(self):
        """Exclude files with --exclude."""
        bash = Bash(files={
            "/dir/keep.txt": "keep\n",
            "/dir/skip.log": "skip\n",
        })
        result = await bash.exec("tar -cf /archive.tar --exclude='*.log' /dir")
        assert result.exit_code == 0
        list_result = await bash.exec("tar -tf /archive.tar")
        assert "keep.txt" in list_result.stdout
        assert "skip.log" not in list_result.stdout

    @pytest.mark.asyncio
    async def test_tar_strip_components(self):
        """Strip path components with --strip-components."""
        bash = Bash(files={"/a/b/c/file.txt": "content\n"})
        await bash.exec("tar -cf /archive.tar /a")
        result = await bash.exec("tar -xf /archive.tar --strip-components=2 -C /out")
        # With strip=2, /a/b/c/file.txt becomes c/file.txt
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tar_change_dir(self):
        """Change directory with -C."""
        bash = Bash(files={"/src/file.txt": "content\n"})
        await bash.exec("mkdir -p /dest")
        await bash.exec("tar -cf /archive.tar -C /src file.txt")
        result = await bash.exec("tar -tf /archive.tar")
        assert result.exit_code == 0
        # Should be file.txt, not /src/file.txt
        assert "file.txt" in result.stdout


class TestTarExtractFlags:
    """Test tar extraction flags (-O, -k, -m, -p)."""

    @pytest.mark.asyncio
    async def test_tar_extract_to_stdout(self):
        """Test -O extracts file contents to stdout instead of files."""
        bash = Bash(files={
            "/dir/file1.txt": "content1\n",
            "/dir/file2.txt": "content2\n",
        })
        await bash.exec("tar -cf /archive.tar /dir")
        await bash.exec("rm -rf /dir")

        # Extract to stdout with -O
        result = await bash.exec("tar -xOf /archive.tar")
        assert result.exit_code == 0
        # Content should appear in stdout
        assert "content1" in result.stdout
        assert "content2" in result.stdout
        # Files should NOT be created
        assert not await bash.fs.exists("/dir/file1.txt")

    @pytest.mark.asyncio
    async def test_tar_extract_to_stdout_specific_file(self):
        """Test -O with specific file extracts only that file to stdout."""
        bash = Bash(files={
            "/src/file1.txt": "content1\n",
            "/src/file2.txt": "content2\n",
        })
        # Create archive using -C to change directory, storing relative paths
        await bash.exec("tar -cf /archive.tar -C /src file1.txt file2.txt")
        await bash.exec("rm -rf /src")

        # Extract specific file to stdout
        result = await bash.exec("tar -xOf /archive.tar file1.txt")
        assert result.exit_code == 0
        assert "content1" in result.stdout
        assert "content2" not in result.stdout

    @pytest.mark.asyncio
    async def test_tar_keep_old_files(self):
        """Test -k doesn't overwrite existing files."""
        bash = Bash(files={"/dir/file.txt": "original\n"})
        await bash.exec("tar -cf /archive.tar /dir")

        # Modify the file
        await bash.exec("echo 'modified' > /dir/file.txt")

        # Extract with -k (should keep existing)
        result = await bash.exec("tar -xkf /archive.tar")
        assert result.exit_code == 0

        # File should still have modified content
        content = await bash.fs.read_file("/dir/file.txt")
        assert "modified" in content

    @pytest.mark.asyncio
    async def test_tar_keep_old_files_extracts_new(self):
        """Test -k still extracts files that don't exist."""
        bash = Bash(files={
            "/dir/existing.txt": "existing\n",
            "/dir/new.txt": "new\n",
        })
        await bash.exec("tar -cf /archive.tar /dir")
        await bash.exec("rm /dir/new.txt")
        await bash.exec("echo 'modified' > /dir/existing.txt")

        # Extract with -k
        result = await bash.exec("tar -xkf /archive.tar")
        assert result.exit_code == 0

        # existing.txt should be unchanged (modified content)
        content = await bash.fs.read_file("/dir/existing.txt")
        assert "modified" in content

        # new.txt should be extracted
        assert await bash.fs.exists("/dir/new.txt")
        content = await bash.fs.read_file("/dir/new.txt")
        assert "new" in content

    @pytest.mark.asyncio
    async def test_tar_no_extract_mtime(self):
        """Test -m doesn't restore modification time."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        await bash.exec("tar -cf /archive.tar /dir")
        await bash.exec("rm -rf /dir")

        # Extract with -m (don't restore mtime)
        result = await bash.exec("tar -xmf /archive.tar")
        assert result.exit_code == 0
        assert await bash.fs.exists("/dir/file.txt")
        # The file should be extracted (mtime behavior is implementation-specific)

    @pytest.mark.asyncio
    async def test_tar_preserve_permissions(self):
        """Test -p preserves file permissions."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        # Set specific permissions
        await bash.exec("chmod 755 /dir/file.txt")
        await bash.exec("tar -cf /archive.tar /dir")
        await bash.exec("rm -rf /dir")

        # Extract with -p
        result = await bash.exec("tar -xpf /archive.tar")
        assert result.exit_code == 0

        # Check permissions are preserved
        stat = await bash.fs.stat("/dir/file.txt")
        assert stat.mode & 0o777 == 0o755


class TestTarAutoCompress:
    """Test tar auto-compression detection with -a flag."""

    @pytest.mark.asyncio
    async def test_tar_auto_compress_gz(self):
        """Test -a detects .tar.gz extension for gzip compression."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        result = await bash.exec("tar -caf /archive.tar.gz /dir")
        assert result.exit_code == 0
        assert await bash.fs.exists("/archive.tar.gz")

        # Verify it's actually gzip compressed
        data = await bash.fs.read_file_bytes("/archive.tar.gz")
        assert data[0] == 0x1F and data[1] == 0x8B  # gzip magic bytes

    @pytest.mark.asyncio
    async def test_tar_auto_compress_tgz(self):
        """Test -a detects .tgz extension for gzip compression."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        result = await bash.exec("tar -caf /archive.tgz /dir")
        assert result.exit_code == 0

        # Verify it's gzip compressed
        data = await bash.fs.read_file_bytes("/archive.tgz")
        assert data[0] == 0x1F and data[1] == 0x8B

    @pytest.mark.asyncio
    async def test_tar_auto_compress_bz2(self):
        """Test -a detects .tar.bz2 extension for bzip2 compression."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        result = await bash.exec("tar -caf /archive.tar.bz2 /dir")
        assert result.exit_code == 0

        # Verify it's bzip2 compressed (magic: BZ)
        data = await bash.fs.read_file_bytes("/archive.tar.bz2")
        assert data[0:2] == b"BZ"

    @pytest.mark.asyncio
    async def test_tar_auto_compress_xz(self):
        """Test -a detects .tar.xz extension for xz compression."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        result = await bash.exec("tar -caf /archive.tar.xz /dir")
        assert result.exit_code == 0

        # Verify it's xz compressed (magic: 0xFD377A585A00)
        data = await bash.fs.read_file_bytes("/archive.tar.xz")
        assert data[0:6] == b"\xfd7zXZ\x00"

    @pytest.mark.asyncio
    async def test_tar_auto_compress_plain(self):
        """Test -a with .tar extension creates uncompressed archive."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        result = await bash.exec("tar -caf /archive.tar /dir")
        assert result.exit_code == 0

        # Verify it's not compressed (no gzip magic)
        data = await bash.fs.read_file_bytes("/archive.tar")
        assert not (data[0] == 0x1F and data[1] == 0x8B)


class TestTarFileList:
    """Test tar file list features (-T, -X)."""

    @pytest.mark.asyncio
    async def test_tar_files_from(self):
        """Test -T reads file list from a file."""
        bash = Bash(files={
            "/src/a.txt": "aaa\n",
            "/src/b.txt": "bbb\n",
            "/src/c.txt": "ccc\n",
            "/filelist.txt": "a.txt\nb.txt\n",
        })
        # Create archive using -T to read file list
        result = await bash.exec("tar -cf /archive.tar -C /src -T /filelist.txt")
        assert result.exit_code == 0

        # Check archive contents
        list_result = await bash.exec("tar -tf /archive.tar")
        assert "a.txt" in list_result.stdout
        assert "b.txt" in list_result.stdout
        assert "c.txt" not in list_result.stdout  # Not in file list

    @pytest.mark.asyncio
    async def test_tar_files_from_long(self):
        """Test --files-from reads file list from a file."""
        bash = Bash(files={
            "/src/a.txt": "aaa\n",
            "/src/b.txt": "bbb\n",
            "/filelist.txt": "a.txt\n",
        })
        result = await bash.exec("tar -cf /archive.tar -C /src --files-from=/filelist.txt")
        assert result.exit_code == 0

        list_result = await bash.exec("tar -tf /archive.tar")
        assert "a.txt" in list_result.stdout
        assert "b.txt" not in list_result.stdout

    @pytest.mark.asyncio
    async def test_tar_exclude_from(self):
        """Test -X reads exclude patterns from a file."""
        bash = Bash(files={
            "/src/keep.txt": "keep\n",
            "/src/skip.log": "skip\n",
            "/src/temp.tmp": "temp\n",
            "/exclude.txt": "*.log\n*.tmp\n",
        })
        result = await bash.exec("tar -cf /archive.tar -C /src -X /exclude.txt .")
        assert result.exit_code == 0

        list_result = await bash.exec("tar -tf /archive.tar")
        assert "keep.txt" in list_result.stdout
        assert "skip.log" not in list_result.stdout
        assert "temp.tmp" not in list_result.stdout

    @pytest.mark.asyncio
    async def test_tar_exclude_from_long(self):
        """Test --exclude-from reads exclude patterns from a file."""
        bash = Bash(files={
            "/src/a.txt": "aaa\n",
            "/src/b.log": "bbb\n",
            "/exclude.txt": "*.log\n",
        })
        result = await bash.exec("tar -cf /archive.tar -C /src --exclude-from=/exclude.txt .")
        assert result.exit_code == 0

        list_result = await bash.exec("tar -tf /archive.tar")
        assert "a.txt" in list_result.stdout
        assert "b.log" not in list_result.stdout


class TestTarAppendUpdate:
    """Test tar append and update modes (-r, -u)."""

    @pytest.mark.asyncio
    async def test_tar_append(self):
        """Test -r appends files to existing archive."""
        bash = Bash(files={
            "/src/a.txt": "aaa\n",
            "/src/b.txt": "bbb\n",
        })
        # Create archive with first file
        await bash.exec("tar -cf /archive.tar -C /src a.txt")

        # Append second file
        result = await bash.exec("tar -rf /archive.tar -C /src b.txt")
        assert result.exit_code == 0

        # Check both files are in archive
        list_result = await bash.exec("tar -tf /archive.tar")
        assert "a.txt" in list_result.stdout
        assert "b.txt" in list_result.stdout

    @pytest.mark.asyncio
    async def test_tar_append_long(self):
        """Test --append appends files to existing archive."""
        bash = Bash(files={
            "/src/a.txt": "aaa\n",
            "/src/b.txt": "bbb\n",
        })
        await bash.exec("tar -cf /archive.tar -C /src a.txt")
        result = await bash.exec("tar --append -f /archive.tar -C /src b.txt")
        assert result.exit_code == 0

        list_result = await bash.exec("tar -tf /archive.tar")
        assert "a.txt" in list_result.stdout
        assert "b.txt" in list_result.stdout

    @pytest.mark.asyncio
    async def test_tar_update_newer_file(self):
        """Test -u updates archive with newer files only."""
        bash = Bash(files={"/src/a.txt": "original\n"})

        # Create archive
        await bash.exec("tar -cf /archive.tar -C /src a.txt")

        # Update file content (simulating newer version)
        await bash.exec("echo 'updated' > /src/a.txt")

        # Use -u to update archive
        result = await bash.exec("tar -uf /archive.tar -C /src a.txt")
        assert result.exit_code == 0

        # Extract to a different location and check we get the updated content
        await bash.exec("mkdir -p /out")
        await bash.exec("tar -xf /archive.tar -C /out")
        content = await bash.fs.read_file("/out/a.txt")
        assert "updated" in content

    @pytest.mark.asyncio
    async def test_tar_update_adds_new_files(self):
        """Test -u adds new files to archive."""
        bash = Bash(files={
            "/src/a.txt": "aaa\n",
        })
        # Create archive with first file
        await bash.exec("tar -cf /archive.tar -C /src a.txt")

        # Add a new file
        await bash.exec("echo 'bbb' > /src/b.txt")

        # Update archive
        result = await bash.exec("tar -uf /archive.tar -C /src b.txt")
        assert result.exit_code == 0

        # Check both files are in archive
        list_result = await bash.exec("tar -tf /archive.tar")
        assert "a.txt" in list_result.stdout
        assert "b.txt" in list_result.stdout


class TestTarBzip2:
    """Test bzip2 compression with -j flag."""

    @pytest.mark.asyncio
    async def test_tar_bzip2_create(self):
        """Test -j creates bzip2 compressed archive."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        result = await bash.exec("tar -cjf /archive.tar.bz2 /dir")
        assert result.exit_code == 0
        assert await bash.fs.exists("/archive.tar.bz2")

        # Verify it's bzip2 compressed (magic: BZ)
        data = await bash.fs.read_file_bytes("/archive.tar.bz2")
        assert data[0:2] == b"BZ"

    @pytest.mark.asyncio
    async def test_tar_bzip2_extract(self):
        """Test -j extracts bzip2 compressed archive."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        await bash.exec("tar -cjf /archive.tar.bz2 /dir")
        await bash.exec("rm -rf /dir")

        result = await bash.exec("tar -xjf /archive.tar.bz2")
        assert result.exit_code == 0
        assert await bash.fs.exists("/dir/file.txt")

        content = await bash.fs.read_file("/dir/file.txt")
        assert "content" in content

    @pytest.mark.asyncio
    async def test_tar_bzip2_list(self):
        """Test -j lists bzip2 compressed archive."""
        bash = Bash(files={
            "/dir/a.txt": "aaa\n",
            "/dir/b.txt": "bbb\n",
        })
        await bash.exec("tar -cjf /archive.tar.bz2 /dir")

        result = await bash.exec("tar -tjf /archive.tar.bz2")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout


class TestTarXz:
    """Test xz compression with -J flag."""

    @pytest.mark.asyncio
    async def test_tar_xz_create(self):
        """Test -J creates xz compressed archive."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        result = await bash.exec("tar -cJf /archive.tar.xz /dir")
        assert result.exit_code == 0
        assert await bash.fs.exists("/archive.tar.xz")

        # Verify it's xz compressed (magic: 0xFD377A585A00)
        data = await bash.fs.read_file_bytes("/archive.tar.xz")
        assert data[0:6] == b"\xfd7zXZ\x00"

    @pytest.mark.asyncio
    async def test_tar_xz_extract(self):
        """Test -J extracts xz compressed archive."""
        bash = Bash(files={"/dir/file.txt": "content\n"})
        await bash.exec("tar -cJf /archive.tar.xz /dir")
        await bash.exec("rm -rf /dir")

        result = await bash.exec("tar -xJf /archive.tar.xz")
        assert result.exit_code == 0
        assert await bash.fs.exists("/dir/file.txt")

        content = await bash.fs.read_file("/dir/file.txt")
        assert "content" in content

    @pytest.mark.asyncio
    async def test_tar_xz_list(self):
        """Test -J lists xz compressed archive."""
        bash = Bash(files={
            "/dir/a.txt": "aaa\n",
            "/dir/b.txt": "bbb\n",
        })
        await bash.exec("tar -cJf /archive.tar.xz /dir")

        result = await bash.exec("tar -tJf /archive.tar.xz")
        assert result.exit_code == 0
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout
