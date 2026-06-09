"""File command implementation - determine file type."""

from ...types import CommandContext, ExecResult


class FileCommand:
    """The file command - determine file type."""

    name = "file"

    # Magic bytes for common file types (ordered by specificity - longer prefixes first)
    MAGIC_BYTES: list[tuple[bytes, str]] = [
        # Images
        (b"\x89PNG\r\n\x1a\n", "PNG image data"),
        (b"GIF87a", "GIF image data, version 87a"),
        (b"GIF89a", "GIF image data, version 89a"),
        (b"\xff\xd8\xff", "JPEG image data"),
        (b"RIFF", "RIFF data"),
        (b"BM", "PC bitmap"),
        (b"\x00\x00\x01\x00", "MS Windows icon resource"),
        (b"\x00\x00\x02\x00", "MS Windows cursor resource"),

        # Archives
        (b"PK\x03\x04", "Zip archive data"),
        (b"PK\x05\x06", "Zip archive data (empty)"),
        (b"Rar!\x1a\x07", "RAR archive data"),
        (b"7z\xbc\xaf\x27\x1c", "7-zip archive data"),

        # Compressed
        (b"\x1f\x8b", "gzip compressed data"),
        (b"BZh", "bzip2 compressed data"),
        (b"\xfd7zXZ\x00", "XZ compressed data"),

        # Documents
        (b"%PDF", "PDF document"),

        # Executables
        (b"\x7fELF", "ELF"),
        (b"MZ", "DOS/Windows executable"),
        (b"\xca\xfe\xba\xbe", "Mach-O universal binary"),
        (b"\xfe\xed\xfa\xce", "Mach-O 32-bit executable"),
        (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit executable"),
        (b"\xcf\xfa\xed\xfe", "Mach-O 64-bit executable"),
        (b"\xce\xfa\xed\xfe", "Mach-O 32-bit executable"),

        # Databases
        (b"SQLite format 3", "SQLite 3.x database"),

        # Audio/Video
        (b"ID3", "Audio file with ID3 tag"),
        (b"\xff\xfb", "MPEG ADTS, layer III (MP3)"),
        (b"\xff\xfa", "MPEG ADTS, layer III (MP3)"),
        (b"OggS", "Ogg data"),
        (b"fLaC", "FLAC audio"),

        # Web/Data
        (b"<!DOCTYPE html", "HTML document"),
        (b"<!doctype html", "HTML document"),
        (b"<html", "HTML document"),
        (b"<?xml", "XML document"),
    ]

    MIME_TYPES = {
        "PNG image data": "image/png",
        "GIF image data, version 87a": "image/gif",
        "GIF image data, version 89a": "image/gif",
        "GIF image data": "image/gif",
        "JPEG image data": "image/jpeg",
        "Zip archive data": "application/zip",
        "Zip archive data (empty)": "application/zip",
        "PDF document": "application/pdf",
        "gzip compressed data": "application/gzip",
        "bzip2 compressed data": "application/x-bzip2",
        "ASCII text": "text/plain",
        "directory": "inode/directory",
        "empty": "inode/x-empty",
        "JSON text data": "application/json",
        "ELF": "application/x-executable",
        "Mach-O 64-bit executable": "application/x-mach-binary",
        "Mach-O 32-bit executable": "application/x-mach-binary",
        "Mach-O universal binary": "application/x-mach-binary",
        "SQLite 3.x database": "application/x-sqlite3",
        "XML document": "text/xml",
        "HTML document": "text/html",
    }

    # Extension-based detection
    EXTENSION_MAP: dict[str, tuple[str, str]] = {
        # Programming languages
        ".py": ("Python script", "text/x-python"),
        ".js": ("JavaScript source", "text/javascript"),
        ".ts": ("TypeScript source", "text/typescript"),
        ".jsx": ("JavaScript JSX source", "text/jsx"),
        ".tsx": ("TypeScript JSX source", "text/tsx"),
        ".rb": ("Ruby script", "text/x-ruby"),
        ".go": ("Go source", "text/x-go"),
        ".rs": ("Rust source", "text/x-rust"),
        ".c": ("C source", "text/x-c"),
        ".cpp": ("C++ source", "text/x-c++"),
        ".h": ("C header", "text/x-c"),
        ".java": ("Java source", "text/x-java"),
        ".kt": ("Kotlin source", "text/x-kotlin"),
        ".swift": ("Swift source", "text/x-swift"),
        ".php": ("PHP script", "text/x-php"),
        ".pl": ("Perl script", "text/x-perl"),
        ".sh": ("Bourne-Again shell script", "text/x-shellscript"),
        ".bash": ("Bourne-Again shell script", "text/x-shellscript"),
        ".zsh": ("Zsh script", "text/x-shellscript"),

        # Data formats
        ".json": ("JSON text data", "application/json"),
        ".yaml": ("YAML document", "text/yaml"),
        ".yml": ("YAML document", "text/yaml"),
        ".xml": ("XML document", "text/xml"),
        ".csv": ("CSV text", "text/csv"),
        ".toml": ("TOML document", "text/toml"),

        # Documentation
        ".md": ("Markdown document", "text/markdown"),
        ".rst": ("reStructuredText document", "text/x-rst"),
        ".txt": ("ASCII text", "text/plain"),

        # Config
        ".ini": ("INI configuration", "text/plain"),
        ".conf": ("Configuration file", "text/plain"),
        ".cfg": ("Configuration file", "text/plain"),
        ".env": ("Environment file", "text/plain"),

        # Web
        ".html": ("HTML document", "text/html"),
        ".htm": ("HTML document", "text/html"),
        ".css": ("CSS stylesheet", "text/css"),
        ".scss": ("Sass stylesheet", "text/x-scss"),
        ".less": ("Less stylesheet", "text/x-less"),
        ".svg": ("SVG image", "image/svg+xml"),
    }

    # Shebang interpreter detection
    SHEBANG_MAP = {
        "python": "Python script",
        "python3": "Python script",
        "python2": "Python script",
        "node": "Node.js script",
        "nodejs": "Node.js script",
        "bash": "Bourne-Again shell script",
        "sh": "POSIX shell script",
        "zsh": "Zsh script",
        "ruby": "Ruby script",
        "perl": "Perl script",
        "php": "PHP script",
    }

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the file command."""
        mime_mode = False
        brief_mode = False
        paths: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg in ("-i", "--mime"):
                mime_mode = True
            elif arg in ("-b", "--brief"):
                brief_mode = True
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: file [OPTION...] [FILE...]\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg.startswith("-"):
                pass  # Ignore unknown options
            else:
                paths.append(arg)
            i += 1

        if not paths:
            return ExecResult(
                stdout="",
                stderr="file: missing file operand\n",
                exit_code=1,
            )

        output_lines = []
        exit_code = 0

        for path in paths:
            try:
                resolved = ctx.fs.resolve_path(ctx.cwd, path)
                stat = await ctx.fs.stat(resolved)

                if stat.is_directory:
                    file_type = "directory"
                else:
                    content = await ctx.fs.read_file(resolved)
                    # Check for empty file
                    if len(content) == 0:
                        file_type = "empty"
                    else:
                        file_type = self._detect_type(path, content)

                if mime_mode:
                    mime = self.MIME_TYPES.get(file_type, "application/octet-stream")
                    if file_type == "ASCII text":
                        mime += "; charset=us-ascii"
                    result = mime
                else:
                    result = file_type

                if brief_mode:
                    output_lines.append(result)
                else:
                    output_lines.append(f"{path}: {result}")

            except FileNotFoundError:
                output_lines.append(f"{path}: cannot open (No such file or directory)")
                exit_code = 1
            except Exception as e:
                output_lines.append(f"{path}: cannot open ({e})")
                exit_code = 1

        return ExecResult(
            stdout="\n".join(output_lines) + "\n",
            stderr="",
            exit_code=exit_code,
        )

    def _detect_type(self, path: str, content: str) -> str:
        """Detect file type from content."""
        # Try binary detection first (magic bytes)
        try:
            content_bytes = content.encode("latin-1")

            for magic, file_type in self.MAGIC_BYTES:
                if content_bytes.startswith(magic):
                    return file_type
        except Exception:
            pass

        # Check for shebang
        if content.startswith("#!"):
            first_line = content.split("\n")[0]
            # Parse the interpreter from shebang
            shebang = first_line[2:].strip()
            parts = shebang.split()
            if parts:
                # Handle /usr/bin/env <interpreter>
                interpreter = parts[0].rsplit("/", 1)[-1]
                if interpreter == "env" and len(parts) > 1:
                    interpreter = parts[1].rsplit("/", 1)[-1]

                # Check against SHEBANG_MAP
                for key, script_type in self.SHEBANG_MAP.items():
                    if interpreter.startswith(key):
                        return f"{script_type}, ASCII text executable"

                # Fallback for unknown interpreters
                return "script, ASCII text executable"

        # Check extension using EXTENSION_MAP
        if "." in path:
            ext = "." + path.rsplit(".", 1)[-1].lower()
            if ext in self.EXTENSION_MAP:
                return self.EXTENSION_MAP[ext][0]

        # Check for text
        try:
            content.encode("ascii")
            if "\r\n" in content:
                return "ASCII text, with CRLF line terminators"
            return "ASCII text"
        except UnicodeEncodeError:
            return "UTF-8 Unicode text"
