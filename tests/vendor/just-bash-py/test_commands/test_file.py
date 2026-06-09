"""Tests for file command."""

import pytest
from just_bash import Bash


class TestFileBasic:
    """Test basic file type detection."""

    @pytest.mark.asyncio
    async def test_file_text(self):
        """Detect plain text file."""
        bash = Bash(files={"/test.txt": "Hello, world!\n"})
        result = await bash.exec("file /test.txt")
        assert result.exit_code == 0
        assert "text" in result.stdout.lower() or "ascii" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_empty(self):
        """Detect empty file."""
        bash = Bash(files={"/empty.txt": ""})
        result = await bash.exec("file /empty.txt")
        assert result.exit_code == 0
        assert "empty" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_script(self):
        """Detect shell script."""
        bash = Bash(files={"/script.sh": "#!/bin/bash\necho hello\n"})
        result = await bash.exec("file /script.sh")
        assert result.exit_code == 0
        assert "script" in result.stdout.lower() or "bash" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_python(self):
        """Detect Python script."""
        bash = Bash(files={"/script.py": "#!/usr/bin/env python3\nprint('hello')\n"})
        result = await bash.exec("file /script.py")
        assert result.exit_code == 0
        assert "python" in result.stdout.lower() or "script" in result.stdout.lower()


class TestFileMagic:
    """Test magic byte detection."""

    @pytest.mark.asyncio
    async def test_file_xml(self):
        """Detect XML file."""
        bash = Bash(files={"/test.xml": '<?xml version="1.0"?>\n<root></root>\n'})
        result = await bash.exec("file /test.xml")
        assert result.exit_code == 0
        assert "xml" in result.stdout.lower() or "text" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_pdf(self):
        """Detect PDF by content."""
        bash = Bash(files={"/test.pdf": "%PDF-1.4\ntest content\n"})
        result = await bash.exec("file /test.pdf")
        assert result.exit_code == 0
        assert "pdf" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_json(self):
        """Detect JSON file."""
        bash = Bash(files={"/data.json": '{"key": "value"}\n'})
        result = await bash.exec("file /data.json")
        assert result.exit_code == 0
        assert "json" in result.stdout.lower() or "text" in result.stdout.lower()


class TestFileOptions:
    """Test file command options."""

    @pytest.mark.asyncio
    async def test_file_brief(self):
        """Brief output with -b."""
        bash = Bash(files={"/test.txt": "Hello\n"})
        result = await bash.exec("file -b /test.txt")
        assert result.exit_code == 0
        # Brief mode should not include filename
        assert "/test.txt" not in result.stdout

    @pytest.mark.asyncio
    async def test_file_multiple(self):
        """Check multiple files."""
        bash = Bash(files={
            "/a.txt": "text\n",
            "/b.txt": "more text\n",
        })
        result = await bash.exec("file /a.txt /b.txt")
        assert result.exit_code == 0
        assert "/a.txt" in result.stdout
        assert "/b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_file_nonexistent(self):
        """Error on nonexistent file."""
        bash = Bash()
        result = await bash.exec("file /nonexistent")
        assert result.exit_code != 0 or "cannot open" in result.stdout.lower() or "no such" in result.stdout.lower()


class TestFileMagicBytes:
    """Test magic byte detection for various file types."""

    @pytest.mark.asyncio
    async def test_file_png(self):
        """Test PNG detection via magic bytes."""
        png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        bash = Bash(files={"/image.png": png_header.decode("latin-1")})
        result = await bash.exec("file /image.png")
        assert "PNG" in result.stdout

    @pytest.mark.asyncio
    async def test_file_elf(self):
        """Test ELF binary detection."""
        elf_header = b"\x7fELF" + b"\x00" * 100
        bash = Bash(files={"/binary": elf_header.decode("latin-1")})
        result = await bash.exec("file /binary")
        assert "ELF" in result.stdout

    @pytest.mark.asyncio
    async def test_file_sqlite(self):
        """Test SQLite database detection."""
        sqlite_header = b"SQLite format 3\x00" + b"\x00" * 100
        bash = Bash(files={"/data.db": sqlite_header.decode("latin-1")})
        result = await bash.exec("file /data.db")
        assert "SQLite" in result.stdout

    @pytest.mark.asyncio
    async def test_file_mach_o_64(self):
        """Test Mach-O 64-bit executable detection."""
        # Little-endian Mach-O 64-bit magic
        macho_header = b"\xcf\xfa\xed\xfe" + b"\x00" * 100
        bash = Bash(files={"/binary": macho_header.decode("latin-1")})
        result = await bash.exec("file /binary")
        assert "Mach-O" in result.stdout

    @pytest.mark.asyncio
    async def test_file_gzip(self):
        """Test gzip detection via magic bytes."""
        gzip_header = b"\x1f\x8b\x08" + b"\x00" * 100
        bash = Bash(files={"/archive.gz": gzip_header.decode("latin-1")})
        result = await bash.exec("file /archive.gz")
        assert "gzip" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_zip(self):
        """Test Zip detection via magic bytes."""
        zip_header = b"PK\x03\x04" + b"\x00" * 100
        bash = Bash(files={"/archive.zip": zip_header.decode("latin-1")})
        result = await bash.exec("file /archive.zip")
        assert "Zip" in result.stdout or "zip" in result.stdout.lower()


class TestFileShebang:
    """Test shebang-based script detection."""

    @pytest.mark.asyncio
    async def test_file_shebang_ruby(self):
        """Test Ruby shebang detection."""
        bash = Bash(files={"/script": "#!/usr/bin/ruby\nputs 'hello'"})
        result = await bash.exec("file /script")
        assert "Ruby" in result.stdout or "script" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_shebang_env_python(self):
        """Test /usr/bin/env python shebang detection."""
        bash = Bash(files={"/script": "#!/usr/bin/env python3\nprint('hello')"})
        result = await bash.exec("file /script")
        assert "Python" in result.stdout or "python" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_shebang_perl(self):
        """Test Perl shebang detection."""
        bash = Bash(files={"/script": "#!/usr/bin/perl\nprint 'hello';"})
        result = await bash.exec("file /script")
        assert "Perl" in result.stdout or "perl" in result.stdout.lower() or "script" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_shebang_sh(self):
        """Test POSIX shell shebang detection."""
        bash = Bash(files={"/script": "#!/bin/sh\necho hello"})
        result = await bash.exec("file /script")
        assert "shell" in result.stdout.lower() or "script" in result.stdout.lower()


class TestFileExtension:
    """Test extension-based file type detection."""

    @pytest.mark.asyncio
    async def test_file_extension_typescript(self):
        """Test TypeScript detection by extension."""
        bash = Bash(files={"/app.ts": "const x: number = 1;"})
        result = await bash.exec("file /app.ts")
        assert "TypeScript" in result.stdout

    @pytest.mark.asyncio
    async def test_file_extension_yaml(self):
        """Test YAML detection by extension."""
        bash = Bash(files={"/config.yaml": "key: value\n"})
        result = await bash.exec("file /config.yaml")
        assert "YAML" in result.stdout or "yaml" in result.stdout.lower() or "text" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_extension_markdown(self):
        """Test Markdown detection by extension."""
        bash = Bash(files={"/readme.md": "# Title\n\nSome text"})
        result = await bash.exec("file /readme.md")
        assert "Markdown" in result.stdout or "markdown" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_extension_go(self):
        """Test Go source detection by extension."""
        bash = Bash(files={"/main.go": "package main\n\nfunc main() {}"})
        result = await bash.exec("file /main.go")
        assert "Go" in result.stdout or "text" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_file_extension_rust(self):
        """Test Rust source detection by extension."""
        bash = Bash(files={"/main.rs": "fn main() {}"})
        result = await bash.exec("file /main.rs")
        assert "Rust" in result.stdout or "text" in result.stdout.lower()


class TestFileMime:
    """Test MIME type output."""

    @pytest.mark.asyncio
    async def test_file_mime_json(self):
        """Test -i flag returns MIME type for JSON."""
        bash = Bash(files={"/data.json": '{"key": "value"}'})
        result = await bash.exec("file -i /data.json")
        assert "application/json" in result.stdout

    @pytest.mark.asyncio
    async def test_file_mime_png(self):
        """Test -i flag returns MIME type for PNG."""
        png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        bash = Bash(files={"/image.png": png_header.decode("latin-1")})
        result = await bash.exec("file -i /image.png")
        assert "image/png" in result.stdout

    @pytest.mark.asyncio
    async def test_file_mime_empty(self):
        """Test -i flag returns correct MIME type for empty file."""
        bash = Bash(files={"/empty": ""})
        result = await bash.exec("file -i /empty")
        assert "inode/x-empty" in result.stdout or "application/x-empty" in result.stdout
