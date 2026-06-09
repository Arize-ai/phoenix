"""
In-Memory Filesystem Implementation

A complete virtual filesystem that stores all files and directories in memory.
Designed for sandboxed execution without touching the real filesystem.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Union, Optional, Literal
from ..types import FsStat


@dataclass
class FileEntry:
    """A file in the virtual filesystem."""

    type: Literal["file"] = "file"
    content: bytes = b""
    mode: int = 0o644
    mtime: float = field(default_factory=time.time)


@dataclass
class DirectoryEntry:
    """A directory in the virtual filesystem."""

    type: Literal["directory"] = "directory"
    mode: int = 0o755
    mtime: float = field(default_factory=time.time)


@dataclass
class SymlinkEntry:
    """A symbolic link in the virtual filesystem."""

    type: Literal["symlink"] = "symlink"
    target: str = ""
    mode: int = 0o777
    mtime: float = field(default_factory=time.time)


FsEntry = Union[FileEntry, DirectoryEntry, SymlinkEntry]


@dataclass
class DirentEntry:
    """Directory entry information."""

    name: str
    is_file: bool = False
    is_directory: bool = False
    is_symbolic_link: bool = False


class InMemoryFs:
    """In-memory filesystem implementation."""

    def __init__(self, initial_files: dict[str, str | bytes] | None = None) -> None:
        """
        Initialize the filesystem.

        Args:
            initial_files: Optional dict mapping paths to file contents
        """
        self._data: dict[str, FsEntry] = {}

        # Create root directory
        self._data["/"] = DirectoryEntry()

        # Create default directory structure
        self._create_default_structure()

        # Add initial files
        if initial_files:
            for path, content in initial_files.items():
                self._write_file_sync(path, content)

    def _create_default_structure(self) -> None:
        """Create default Unix-like directory structure."""
        default_dirs = [
            "/home",
            "/home/user",
            "/tmp",
            "/bin",
            "/usr",
            "/usr/bin",
        ]
        for dir_path in default_dirs:
            self._mkdir_sync(dir_path, recursive=True)

    def _normalize_path(self, path: str) -> str:
        """Normalize a path (resolve ., .., trailing slashes)."""
        if not path or path == "/":
            return "/"

        # Remove trailing slash
        if path.endswith("/") and path != "/":
            path = path[:-1]

        # Ensure starts with /
        if not path.startswith("/"):
            path = "/" + path

        # Resolve . and ..
        parts = path.split("/")
        resolved: list[str] = []

        for part in parts:
            if part == "" or part == ".":
                continue
            elif part == "..":
                if resolved:
                    resolved.pop()
            else:
                resolved.append(part)

        return "/" + "/".join(resolved) if resolved else "/"

    def _dirname(self, path: str) -> str:
        """Get the directory name of a path."""
        normalized = self._normalize_path(path)
        if normalized == "/":
            return "/"
        last_slash = normalized.rfind("/")
        return "/" if last_slash == 0 else normalized[:last_slash]

    def _basename(self, path: str) -> str:
        """Get the base name of a path."""
        normalized = self._normalize_path(path)
        if normalized == "/":
            return ""
        return normalized.rsplit("/", 1)[-1]

    def _ensure_parent_dirs(self, path: str) -> None:
        """Ensure all parent directories exist."""
        dir_path = self._dirname(path)
        if dir_path == "/":
            return

        if dir_path not in self._data:
            self._ensure_parent_dirs(dir_path)
            self._data[dir_path] = DirectoryEntry()

    def _resolve_symlink(self, symlink_path: str, target: str) -> str:
        """Resolve a symlink target to an absolute path."""
        if target.startswith("/"):
            return self._normalize_path(target)
        # Relative target: resolve from symlink's directory
        dir_path = self._dirname(symlink_path)
        if dir_path == "/":
            return self._normalize_path("/" + target)
        return self._normalize_path(dir_path + "/" + target)

    def _resolve_path_with_symlinks(self, path: str, max_loops: int = 40) -> str:
        """
        Resolve all symlinks in a path, including intermediate components.
        """
        normalized = self._normalize_path(path)
        if normalized == "/":
            return "/"

        parts = normalized[1:].split("/")  # Skip leading /
        resolved_path = ""
        seen: set[str] = set()

        for part in parts:
            resolved_path = f"{resolved_path}/{part}"

            # Check if this path component is a symlink
            entry = self._data.get(resolved_path)
            loop_count = 0

            while entry and entry.type == "symlink" and loop_count < max_loops:
                if resolved_path in seen:
                    raise OSError(
                        f"ELOOP: too many levels of symbolic links, open '{path}'"
                    )
                seen.add(resolved_path)
                resolved_path = self._resolve_symlink(resolved_path, entry.target)
                entry = self._data.get(resolved_path)
                loop_count += 1

            if loop_count >= max_loops:
                raise OSError(
                    f"ELOOP: too many levels of symbolic links, open '{path}'"
                )

        return resolved_path

    def _resolve_intermediate_symlinks(self, path: str, max_loops: int = 40) -> str:
        """
        Resolve symlinks in intermediate path components only (not the final).
        Used by lstat which should not follow the final symlink.
        """
        normalized = self._normalize_path(path)
        if normalized == "/":
            return "/"

        parts = normalized[1:].split("/")
        if len(parts) <= 1:
            return normalized

        resolved_path = ""
        seen: set[str] = set()

        # Process all but the last component
        for i in range(len(parts) - 1):
            part = parts[i]
            resolved_path = f"{resolved_path}/{part}"

            entry = self._data.get(resolved_path)
            loop_count = 0

            while entry and entry.type == "symlink" and loop_count < max_loops:
                if resolved_path in seen:
                    raise OSError(
                        f"ELOOP: too many levels of symbolic links, lstat '{path}'"
                    )
                seen.add(resolved_path)
                resolved_path = self._resolve_symlink(resolved_path, entry.target)
                entry = self._data.get(resolved_path)
                loop_count += 1

            if loop_count >= max_loops:
                raise OSError(
                    f"ELOOP: too many levels of symbolic links, lstat '{path}'"
                )

        # Append the final component without resolving
        return f"{resolved_path}/{parts[-1]}"

    # =========================================================================
    # Sync methods (internal)
    # =========================================================================

    def _write_file_sync(
        self,
        path: str,
        content: str | bytes,
        encoding: str = "utf-8",
    ) -> None:
        """Synchronously write a file."""
        normalized = self._normalize_path(path)
        self._ensure_parent_dirs(normalized)

        # Convert content to bytes
        if isinstance(content, str):
            content_bytes = content.encode(encoding)
        else:
            content_bytes = content

        self._data[normalized] = FileEntry(content=content_bytes)

    def _mkdir_sync(self, path: str, recursive: bool = False) -> None:
        """Synchronously create a directory."""
        normalized = self._normalize_path(path)

        if normalized in self._data:
            entry = self._data[normalized]
            if entry.type == "file":
                raise OSError(f"EEXIST: file already exists, mkdir '{path}'")
            if not recursive:
                raise OSError(f"EEXIST: directory already exists, mkdir '{path}'")
            return  # With recursive, silently succeed if directory exists

        parent = self._dirname(normalized)
        if parent != "/" and parent not in self._data:
            if recursive:
                self._mkdir_sync(parent, recursive=True)
            else:
                raise OSError(f"ENOENT: no such file or directory, mkdir '{path}'")

        self._data[normalized] = DirectoryEntry()

    # =========================================================================
    # Async public API
    # =========================================================================

    async def read_file(self, path: str, encoding: str = "utf-8") -> str:
        """Read file contents as string."""
        buffer = await self.read_file_bytes(path)
        return buffer.decode(encoding)

    async def read_file_bytes(self, path: str) -> bytes:
        """Read file contents as bytes."""
        resolved_path = self._resolve_path_with_symlinks(path)
        entry = self._data.get(resolved_path)

        if entry is None:
            raise FileNotFoundError(f"ENOENT: no such file or directory, open '{path}'")
        if entry.type != "file":
            raise IsADirectoryError(
                f"EISDIR: illegal operation on a directory, read '{path}'"
            )

        return entry.content

    async def write_file(
        self,
        path: str,
        content: str | bytes,
        encoding: str = "utf-8",
    ) -> None:
        """Write content to file."""
        self._write_file_sync(path, content, encoding)

    async def append_file(
        self,
        path: str,
        content: str | bytes,
        encoding: str = "utf-8",
    ) -> None:
        """Append content to file."""
        normalized = self._normalize_path(path)
        existing = self._data.get(normalized)

        if existing and existing.type == "directory":
            raise IsADirectoryError(
                f"EISDIR: illegal operation on a directory, write '{path}'"
            )

        # Convert content to bytes
        if isinstance(content, str):
            new_bytes = content.encode(encoding)
        else:
            new_bytes = content

        if existing and existing.type == "file":
            combined = existing.content + new_bytes
            self._data[normalized] = FileEntry(
                content=combined,
                mode=existing.mode,
            )
        else:
            self._write_file_sync(path, content, encoding)

    async def exists(self, path: str) -> bool:
        """Check if path exists."""
        try:
            resolved_path = self._resolve_path_with_symlinks(path)
            return resolved_path in self._data
        except OSError:
            # Path resolution failed (e.g., broken symlink)
            return False

    async def is_file(self, path: str) -> bool:
        """Check if path is a file."""
        try:
            resolved_path = self._resolve_path_with_symlinks(path)
            entry = self._data.get(resolved_path)
            return entry is not None and entry.type == "file"
        except OSError:
            return False

    async def is_directory(self, path: str) -> bool:
        """Check if path is a directory."""
        try:
            resolved_path = self._resolve_path_with_symlinks(path)
            entry = self._data.get(resolved_path)
            return entry is not None and entry.type == "directory"
        except OSError:
            return False

    async def stat(self, path: str) -> FsStat:
        """Get file/directory stats (follows symlinks)."""
        resolved_path = self._resolve_path_with_symlinks(path)
        entry = self._data.get(resolved_path)

        if entry is None:
            raise FileNotFoundError(f"ENOENT: no such file or directory, stat '{path}'")

        size = 0
        if entry.type == "file":
            size = len(entry.content)

        return FsStat(
            is_file=entry.type == "file",
            is_directory=entry.type == "directory",
            is_symbolic_link=False,  # stat follows symlinks
            mode=entry.mode,
            size=size,
            mtime=entry.mtime,
        )

    async def lstat(self, path: str) -> FsStat:
        """Get file/directory stats (does not follow final symlink)."""
        resolved_path = self._resolve_intermediate_symlinks(path)
        entry = self._data.get(resolved_path)

        if entry is None:
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, lstat '{path}'"
            )

        if entry.type == "symlink":
            return FsStat(
                is_file=False,
                is_directory=False,
                is_symbolic_link=True,
                mode=entry.mode,
                size=len(entry.target),
                mtime=entry.mtime,
            )

        size = 0
        if entry.type == "file":
            size = len(entry.content)

        return FsStat(
            is_file=entry.type == "file",
            is_directory=entry.type == "directory",
            is_symbolic_link=False,
            mode=entry.mode,
            size=size,
            mtime=entry.mtime,
        )

    async def mkdir(self, path: str, recursive: bool = False) -> None:
        """Create a directory."""
        self._mkdir_sync(path, recursive=recursive)

    async def readdir(self, path: str) -> list[str]:
        """List directory contents."""
        entries = await self.readdir_with_file_types(path)
        return [e.name for e in entries]

    async def readdir_with_file_types(self, path: str) -> list[DirentEntry]:
        """List directory contents with type information."""
        normalized = self._normalize_path(path)
        entry = self._data.get(normalized)

        if entry is None:
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, scandir '{path}'"
            )

        # Follow symlinks to get to the actual directory
        seen: set[str] = set()
        while entry and entry.type == "symlink":
            if normalized in seen:
                raise OSError(
                    f"ELOOP: too many levels of symbolic links, scandir '{path}'"
                )
            seen.add(normalized)
            normalized = self._resolve_symlink(normalized, entry.target)
            entry = self._data.get(normalized)

        if entry is None:
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, scandir '{path}'"
            )
        if entry.type != "directory":
            raise NotADirectoryError(f"ENOTDIR: not a directory, scandir '{path}'")

        prefix = "/" if normalized == "/" else f"{normalized}/"
        entries_map: dict[str, DirentEntry] = {}

        for p, fs_entry in self._data.items():
            if p == normalized:
                continue
            if p.startswith(prefix):
                rest = p[len(prefix) :]
                name = rest.split("/")[0]
                # Only add direct children
                if name and "/" not in rest[len(name) :] and name not in entries_map:
                    entries_map[name] = DirentEntry(
                        name=name,
                        is_file=fs_entry.type == "file",
                        is_directory=fs_entry.type == "directory",
                        is_symbolic_link=fs_entry.type == "symlink",
                    )

        # Sort by name
        return sorted(entries_map.values(), key=lambda e: e.name)

    async def rm(
        self, path: str, recursive: bool = False, force: bool = False
    ) -> None:
        """Remove a file or directory."""
        normalized = self._normalize_path(path)
        entry = self._data.get(normalized)

        if entry is None:
            if force:
                return
            raise FileNotFoundError(f"ENOENT: no such file or directory, rm '{path}'")

        if entry.type == "directory":
            children = await self.readdir(normalized)
            if children:
                if not recursive:
                    raise OSError(f"ENOTEMPTY: directory not empty, rm '{path}'")
                for child in children:
                    child_path = (
                        f"/{child}" if normalized == "/" else f"{normalized}/{child}"
                    )
                    await self.rm(child_path, recursive=recursive, force=force)

        del self._data[normalized]

    async def cp(self, src: str, dest: str, recursive: bool = False) -> None:
        """Copy a file or directory."""
        src_norm = self._normalize_path(src)
        dest_norm = self._normalize_path(dest)
        src_entry = self._data.get(src_norm)

        if src_entry is None:
            raise FileNotFoundError(f"ENOENT: no such file or directory, cp '{src}'")

        if src_entry.type == "file":
            self._ensure_parent_dirs(dest_norm)
            self._data[dest_norm] = FileEntry(
                content=src_entry.content,
                mode=src_entry.mode,
            )
        elif src_entry.type == "directory":
            if not recursive:
                raise IsADirectoryError(f"EISDIR: is a directory, cp '{src}'")
            await self.mkdir(dest_norm, recursive=True)
            children = await self.readdir(src_norm)
            for child in children:
                src_child = (
                    f"/{child}" if src_norm == "/" else f"{src_norm}/{child}"
                )
                dest_child = (
                    f"/{child}" if dest_norm == "/" else f"{dest_norm}/{child}"
                )
                await self.cp(src_child, dest_child, recursive=recursive)

    async def mv(self, src: str, dest: str) -> None:
        """Move a file or directory."""
        await self.cp(src, dest, recursive=True)
        await self.rm(src, recursive=True)

    async def chmod(self, path: str, mode: int) -> None:
        """Change file/directory permissions."""
        normalized = self._normalize_path(path)
        entry = self._data.get(normalized)

        if entry is None:
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, chmod '{path}'"
            )

        # Create a new entry with updated mode (since FsEntry is a dataclass)
        if entry.type == "file":
            self._data[normalized] = FileEntry(
                content=entry.content, mode=mode, mtime=entry.mtime
            )
        elif entry.type == "directory":
            self._data[normalized] = DirectoryEntry(mode=mode, mtime=entry.mtime)
        elif entry.type == "symlink":
            self._data[normalized] = SymlinkEntry(
                target=entry.target, mode=mode, mtime=entry.mtime
            )

    async def symlink(self, target: str, link_path: str) -> None:
        """Create a symbolic link."""
        normalized = self._normalize_path(link_path)

        if normalized in self._data:
            raise FileExistsError(f"EEXIST: file already exists, symlink '{link_path}'")

        self._ensure_parent_dirs(normalized)
        self._data[normalized] = SymlinkEntry(target=target)

    async def link(self, existing_path: str, new_path: str) -> None:
        """Create a hard link."""
        existing_norm = self._normalize_path(existing_path)
        new_norm = self._normalize_path(new_path)

        entry = self._data.get(existing_norm)
        if entry is None:
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, link '{existing_path}'"
            )

        if entry.type != "file":
            raise PermissionError(
                f"EPERM: operation not permitted, link '{existing_path}'"
            )

        if new_norm in self._data:
            raise FileExistsError(f"EEXIST: file already exists, link '{new_path}'")

        self._ensure_parent_dirs(new_norm)
        # For hard links, we create a copy (simulating inode sharing)
        self._data[new_norm] = FileEntry(
            content=entry.content,
            mode=entry.mode,
            mtime=entry.mtime,
        )

    async def readlink(self, path: str) -> str:
        """Read the target of a symbolic link."""
        normalized = self._normalize_path(path)
        entry = self._data.get(normalized)

        if entry is None:
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, readlink '{path}'"
            )

        if entry.type != "symlink":
            raise OSError(f"EINVAL: invalid argument, readlink '{path}'")

        return entry.target

    async def utimes(self, path: str, atime: float, mtime: float) -> None:
        """Set access and modification times for a file."""
        resolved = self._resolve_path_with_symlinks(path)
        entry = self._data.get(resolved)
        if entry is None:
            raise FileNotFoundError(f"No such file or directory: {path}")
        # Update mtime (we only track mtime, atime is ignored)
        if entry.type == "file":
            self._data[resolved] = FileEntry(
                content=entry.content, mode=entry.mode, mtime=mtime
            )
        elif entry.type == "directory":
            self._data[resolved] = DirectoryEntry(mode=entry.mode, mtime=mtime)
        elif entry.type == "symlink":
            self._data[resolved] = SymlinkEntry(
                target=entry.target, mode=entry.mode, mtime=mtime
            )

    async def realpath(self, path: str) -> str:
        """Resolve path to absolute canonical path (resolve all symlinks)."""
        return self._resolve_path_with_symlinks(path)

    def resolve_path(self, base: str, path: str) -> str:
        """Resolve a path relative to a base."""
        if path.startswith("/"):
            return self._normalize_path(path)
        combined = f"/{path}" if base == "/" else f"{base}/{path}"
        return self._normalize_path(combined)

    def get_all_paths(self) -> list[str]:
        """Get all paths in the filesystem (useful for debugging/glob)."""
        return list(self._data.keys())
