"""
OverlayFs Implementation

A copy-on-write overlay filesystem. Reads fall back to the real filesystem,
but all writes go to an in-memory layer. The real filesystem is never modified.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Union

import aiofiles  # type: ignore[import-untyped]

from ..types import FsStat


@dataclass
class FileEntry:
    """A file in the memory layer."""

    type: Literal["file"] = "file"
    content: bytes = b""
    mode: int = 0o644
    mtime: float = field(default_factory=time.time)


@dataclass
class DirectoryEntry:
    """A directory in the memory layer."""

    type: Literal["directory"] = "directory"
    mode: int = 0o755
    mtime: float = field(default_factory=time.time)


@dataclass
class SymlinkEntry:
    """A symbolic link in the memory layer."""

    type: Literal["symlink"] = "symlink"
    target: str = ""
    mode: int = 0o777
    mtime: float = field(default_factory=time.time)


MemoryEntry = Union[FileEntry, DirectoryEntry, SymlinkEntry]


@dataclass
class DirentEntry:
    """Directory entry information."""

    name: str
    is_file: bool = False
    is_directory: bool = False
    is_symbolic_link: bool = False


@dataclass
class OverlayFsOptions:
    """Options for OverlayFs."""

    root: str
    """Root directory on the real filesystem to overlay."""

    mount_point: str = "/home/user/project"
    """Virtual path where the overlay is mounted."""

    read_only: bool = False
    """If True, all write operations raise EROFS error."""


class OverlayFs:
    """
    Copy-on-write overlay filesystem.

    Reads fall back to the real filesystem (under root), but all writes
    go to an in-memory layer. The real filesystem is never modified.

    Files can be "deleted" which marks them as non-existent in the overlay
    even though they still exist on disk.
    """

    def __init__(self, options: OverlayFsOptions) -> None:
        """
        Initialize the overlay filesystem.

        Args:
            options: Configuration options

        Raises:
            FileNotFoundError: If root directory does not exist
            NotADirectoryError: If root is not a directory
        """
        root_path = Path(options.root)

        if not root_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, root '{options.root}'"
            )

        if not root_path.is_dir():
            raise NotADirectoryError(
                f"ENOTDIR: not a directory, root '{options.root}'"
            )

        self._root = root_path.resolve()
        self._mount_point = self._normalize_path(options.mount_point)
        self._read_only = options.read_only

        # Memory layer: virtual path -> entry
        self._memory: dict[str, MemoryEntry] = {}

        # Deleted paths: paths that should appear as non-existent
        self._deleted: set[str] = set()

        # Create the mount point directory in memory
        self._memory[self._mount_point] = DirectoryEntry()

    def get_mount_point(self) -> str:
        """Get the virtual mount point path."""
        return self._mount_point

    def _normalize_path(self, path: str) -> str:
        """Normalize a virtual path (resolve ., .., trailing slashes)."""
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

    def _is_under_mount(self, path: str) -> bool:
        """Check if a normalized path is under the mount point."""
        # Special case: root mount point means all paths are under it
        if self._mount_point == "/":
            return True
        return path == self._mount_point or path.startswith(self._mount_point + "/")

    def _to_real_path(self, virtual_path: str) -> Path | None:
        """
        Convert a virtual path to a real filesystem path.

        Returns None if the path is not under the mount point.
        """
        normalized = self._normalize_path(virtual_path)

        if not self._is_under_mount(normalized):
            return None

        if normalized == self._mount_point:
            return self._root

        # Strip mount point prefix
        # Special case: when mount_point is "/", just strip the leading "/"
        if self._mount_point == "/":
            relative = normalized[1:]  # Just strip the leading /
        else:
            relative = normalized[len(self._mount_point) + 1:]  # +1 for the /
        return self._root / relative

    def _is_deleted(self, path: str) -> bool:
        """Check if a path or any of its parents are marked deleted."""
        normalized = self._normalize_path(path)

        # Check the path itself
        if normalized in self._deleted:
            return True

        # Check all parent paths
        parts = normalized.split("/")
        for i in range(1, len(parts)):
            parent = "/".join(parts[:i]) or "/"
            if parent in self._deleted:
                return True

        return False

    def _assert_writable(self, operation: str) -> None:
        """Raise EROFS error if in read-only mode."""
        if self._read_only:
            raise OSError(f"EROFS: read-only file system, {operation}")

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
        """Ensure all parent directories exist in memory."""
        dir_path = self._dirname(path)
        if dir_path == "/" or dir_path == self._mount_point:
            return

        if dir_path not in self._memory:
            self._ensure_parent_dirs(dir_path)
            self._memory[dir_path] = DirectoryEntry()

        # Remove from deleted if it was deleted
        if dir_path in self._deleted:
            self._deleted.discard(dir_path)

    def _resolve_symlink(self, symlink_path: str, target: str) -> str:
        """Resolve a symlink target to an absolute virtual path."""
        if target.startswith("/"):
            return self._normalize_path(target)
        dir_path = self._dirname(symlink_path)
        if dir_path == "/":
            return self._normalize_path("/" + target)
        return self._normalize_path(dir_path + "/" + target)

    def _resolve_path_with_symlinks(self, path: str, max_loops: int = 40) -> str:
        """Resolve all symlinks in a path, including intermediate components."""
        normalized = self._normalize_path(path)
        if normalized == "/":
            return "/"

        parts = normalized[1:].split("/")  # Skip leading /
        resolved_path = ""
        seen: set[str] = set()

        for part in parts:
            resolved_path = f"{resolved_path}/{part}"

            # Check if deleted
            if self._is_deleted(resolved_path):
                return resolved_path  # Return as-is, caller will handle ENOENT

            # Check memory first, then real fs for symlinks
            entry = self._memory.get(resolved_path)
            loop_count = 0

            while entry and entry.type == "symlink" and loop_count < max_loops:
                if resolved_path in seen:
                    raise OSError(
                        f"ELOOP: too many levels of symbolic links, open '{path}'"
                    )
                seen.add(resolved_path)
                resolved_path = self._resolve_symlink(resolved_path, entry.target)

                # Check if the resolved target is under mount and valid
                if self._is_deleted(resolved_path):
                    return resolved_path

                entry = self._memory.get(resolved_path)
                loop_count += 1

            if loop_count >= max_loops:
                raise OSError(
                    f"ELOOP: too many levels of symbolic links, open '{path}'"
                )

        return resolved_path

    async def _get_entry(self, path: str) -> tuple[MemoryEntry | None, bool]:
        """
        Get entry for a path.

        Returns (entry, is_from_memory).
        """
        normalized = self._normalize_path(path)

        # Check if deleted
        if self._is_deleted(normalized):
            return None, False

        # Check memory first
        if normalized in self._memory:
            return self._memory[normalized], True

        # Fall back to real fs
        real_path = self._to_real_path(normalized)
        if real_path is None:
            return None, False

        if not real_path.exists():
            return None, False

        # Create a transient entry representing the real file
        if real_path.is_symlink():
            # Handle real symlinks - need to check if target is safe
            try:
                target = real_path.readlink()
                if target.is_absolute():
                    # Check if target is under our root
                    try:
                        target.relative_to(self._root)
                    except ValueError:
                        # Symlink points outside - treat as non-existent
                        return None, False
            except OSError:
                return None, False
            return SymlinkEntry(target=str(target)), False
        elif real_path.is_dir():
            return DirectoryEntry(mode=real_path.stat().st_mode & 0o777), False
        elif real_path.is_file():
            stat = real_path.stat()
            return FileEntry(
                content=b"",  # Content loaded on demand
                mode=stat.st_mode & 0o777,
                mtime=stat.st_mtime,
            ), False

        return None, False

    async def read_file(self, path: str, encoding: str = "utf-8") -> str:
        """Read file contents as string."""
        content = await self.read_file_bytes(path)
        return content.decode(encoding)

    async def read_file_bytes(self, path: str) -> bytes:
        """Read file contents as bytes."""
        resolved = self._resolve_path_with_symlinks(path)
        normalized = self._normalize_path(resolved)

        # Check if deleted
        if self._is_deleted(normalized):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, open '{path}'"
            )

        # Check memory first
        if normalized in self._memory:
            entry = self._memory[normalized]
            if entry.type == "directory":
                raise IsADirectoryError(
                    f"EISDIR: illegal operation on a directory, read '{path}'"
                )
            if entry.type == "symlink":
                # Resolve and read target
                target = self._resolve_symlink(normalized, entry.target)
                return await self.read_file_bytes(target)
            return entry.content

        # Fall back to real fs
        real_path = self._to_real_path(normalized)
        if real_path is None or not real_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, open '{path}'"
            )

        if real_path.is_dir():
            raise IsADirectoryError(
                f"EISDIR: illegal operation on a directory, read '{path}'"
            )

        if real_path.is_symlink():
            # Follow symlink but validate it stays within bounds
            target_path = real_path.readlink()
            if target_path.is_absolute():
                try:
                    target_path.relative_to(self._root)
                except ValueError:
                    raise FileNotFoundError(
                        f"ENOENT: no such file or directory, open '{path}'"
                    )

        async with aiofiles.open(real_path, "rb") as f:
            content: bytes = await f.read()
            return content

    async def write_file(
        self,
        path: str,
        content: str | bytes,
        encoding: str = "utf-8",
    ) -> None:
        """Write content to file (in memory only)."""
        self._assert_writable("write")

        normalized = self._normalize_path(path)

        # Ensure path is under mount point or just store in memory
        self._ensure_parent_dirs(normalized)

        # Remove from deleted set
        self._deleted.discard(normalized)

        # Convert to bytes
        if isinstance(content, str):
            content_bytes = content.encode(encoding)
        else:
            content_bytes = content

        self._memory[normalized] = FileEntry(content=content_bytes)

    async def append_file(
        self,
        path: str,
        content: str | bytes,
        encoding: str = "utf-8",
    ) -> None:
        """Append content to file (copy-on-write)."""
        self._assert_writable("append")

        normalized = self._normalize_path(path)

        # Get existing content
        try:
            existing = await self.read_file_bytes(normalized)
        except FileNotFoundError:
            existing = b""

        # Convert new content to bytes
        if isinstance(content, str):
            new_bytes = content.encode(encoding)
        else:
            new_bytes = content

        # Write combined content
        await self.write_file(path, existing + new_bytes)

    async def exists(self, path: str) -> bool:
        """Check if path exists."""
        try:
            normalized = self._resolve_path_with_symlinks(path)
        except OSError:
            return False

        if self._is_deleted(normalized):
            return False

        if normalized in self._memory:
            return True

        real_path = self._to_real_path(normalized)
        if real_path is None:
            return False

        return real_path.exists()

    async def is_file(self, path: str) -> bool:
        """Check if path is a file."""
        try:
            normalized = self._resolve_path_with_symlinks(path)
        except OSError:
            return False

        if self._is_deleted(normalized):
            return False

        if normalized in self._memory:
            return self._memory[normalized].type == "file"

        real_path = self._to_real_path(normalized)
        if real_path is None:
            return False

        return real_path.is_file()

    async def is_directory(self, path: str) -> bool:
        """Check if path is a directory."""
        try:
            normalized = self._resolve_path_with_symlinks(path)
        except OSError:
            return False

        if self._is_deleted(normalized):
            return False

        if normalized in self._memory:
            return self._memory[normalized].type == "directory"

        real_path = self._to_real_path(normalized)
        if real_path is None:
            return False

        return real_path.is_dir()

    async def stat(self, path: str) -> FsStat:
        """Get file/directory stats (follows symlinks)."""
        resolved = self._resolve_path_with_symlinks(path)
        normalized = self._normalize_path(resolved)

        if self._is_deleted(normalized):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, stat '{path}'"
            )

        # Check memory first
        if normalized in self._memory:
            entry = self._memory[normalized]
            if entry.type == "symlink":
                # Follow symlink
                target = self._resolve_symlink(normalized, entry.target)
                return await self.stat(target)

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

        # Fall back to real fs
        real_path = self._to_real_path(normalized)
        if real_path is None or not real_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, stat '{path}'"
            )

        stat_result = real_path.stat()
        return FsStat(
            is_file=real_path.is_file(),
            is_directory=real_path.is_dir(),
            is_symbolic_link=False,
            mode=stat_result.st_mode & 0o777,
            size=stat_result.st_size,
            mtime=stat_result.st_mtime,
        )

    async def lstat(self, path: str) -> FsStat:
        """Get file/directory stats (does not follow final symlink)."""
        normalized = self._normalize_path(path)

        if self._is_deleted(normalized):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, lstat '{path}'"
            )

        # Check memory first
        if normalized in self._memory:
            entry = self._memory[normalized]
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

        # Fall back to real fs
        real_path = self._to_real_path(normalized)
        if real_path is None or not (real_path.exists() or real_path.is_symlink()):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, lstat '{path}'"
            )

        stat_result = real_path.lstat()
        is_symlink = real_path.is_symlink()

        return FsStat(
            is_file=not is_symlink and real_path.is_file(),
            is_directory=not is_symlink and real_path.is_dir(),
            is_symbolic_link=is_symlink,
            mode=stat_result.st_mode & 0o777,
            size=stat_result.st_size,
            mtime=stat_result.st_mtime,
        )

    async def mkdir(self, path: str, recursive: bool = False) -> None:
        """Create a directory (in memory only)."""
        self._assert_writable("mkdir")

        normalized = self._normalize_path(path)

        # Check if already exists
        if await self.exists(normalized):
            if await self.is_file(normalized):
                raise OSError(f"EEXIST: file already exists, mkdir '{path}'")
            if not recursive:
                raise OSError(f"EEXIST: directory already exists, mkdir '{path}'")
            return

        # Check parent
        parent = self._dirname(normalized)
        if not await self.exists(parent):
            if recursive:
                await self.mkdir(parent, recursive=True)
            else:
                raise OSError(f"ENOENT: no such file or directory, mkdir '{path}'")

        # Remove from deleted
        self._deleted.discard(normalized)

        # Create directory in memory
        self._memory[normalized] = DirectoryEntry()

    async def readdir(self, path: str) -> list[str]:
        """List directory contents."""
        entries = await self.readdir_with_file_types(path)
        return [e.name for e in entries]

    async def readdir_with_file_types(self, path: str) -> list[DirentEntry]:
        """List directory contents with type information."""
        normalized = self._normalize_path(path)

        if self._is_deleted(normalized):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, scandir '{path}'"
            )

        # Check if it's a directory
        if not await self.is_directory(normalized):
            if await self.exists(normalized):
                raise NotADirectoryError(
                    f"ENOTDIR: not a directory, scandir '{path}'"
                )
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, scandir '{path}'"
            )

        entries_map: dict[str, DirentEntry] = {}
        prefix = normalized + "/" if normalized != "/" else "/"

        # Get entries from memory
        for p, entry in self._memory.items():
            if p.startswith(prefix) and p != normalized:
                rest = p[len(prefix):]
                name = rest.split("/")[0]
                if name and "/" not in rest[len(name):] and name not in entries_map:
                    # Skip if deleted
                    full_path = f"{prefix}{name}" if normalized != "/" else f"/{name}"
                    if not self._is_deleted(full_path):
                        entries_map[name] = DirentEntry(
                            name=name,
                            is_file=entry.type == "file",
                            is_directory=entry.type == "directory",
                            is_symbolic_link=entry.type == "symlink",
                        )

        # Get entries from real fs (if under mount point)
        real_path = self._to_real_path(normalized)
        if real_path is not None and real_path.exists() and real_path.is_dir():
            for item in real_path.iterdir():
                name = item.name
                if name not in entries_map:
                    full_path = f"{prefix}{name}" if normalized != "/" else f"/{name}"
                    if not self._is_deleted(full_path):
                        entries_map[name] = DirentEntry(
                            name=name,
                            is_file=item.is_file(),
                            is_directory=item.is_dir(),
                            is_symbolic_link=item.is_symlink(),
                        )

        return sorted(entries_map.values(), key=lambda e: e.name)

    async def rm(
        self, path: str, recursive: bool = False, force: bool = False
    ) -> None:
        """Remove a file or directory (marks as deleted, doesn't touch disk)."""
        self._assert_writable("rm")

        normalized = self._normalize_path(path)

        if not await self.exists(normalized):
            if force:
                return
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, rm '{path}'"
            )

        # If directory, check if we need recursive
        if await self.is_directory(normalized):
            children = await self.readdir(normalized)
            if children:
                if not recursive:
                    raise OSError(f"ENOTEMPTY: directory not empty, rm '{path}'")
                # Mark all children as deleted
                for child in children:
                    child_path = f"{normalized}/{child}"
                    await self.rm(child_path, recursive=recursive, force=force)

        # Remove from memory if present
        if normalized in self._memory:
            del self._memory[normalized]

        # Mark as deleted
        self._deleted.add(normalized)

    async def cp(self, src: str, dest: str, recursive: bool = False) -> None:
        """Copy a file or directory (to memory layer)."""
        self._assert_writable("cp")

        src_norm = self._normalize_path(src)
        dest_norm = self._normalize_path(dest)

        if not await self.exists(src_norm):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, cp '{src}'"
            )

        if await self.is_directory(src_norm):
            if not recursive:
                raise IsADirectoryError(f"EISDIR: is a directory, cp '{src}'")
            await self.mkdir(dest_norm, recursive=True)
            for child in await self.readdir(src_norm):
                await self.cp(f"{src_norm}/{child}", f"{dest_norm}/{child}", recursive=True)
        else:
            content = await self.read_file_bytes(src_norm)
            await self.write_file(dest_norm, content)

    async def mv(self, src: str, dest: str) -> None:
        """Move a file or directory."""
        self._assert_writable("mv")

        await self.cp(src, dest, recursive=True)
        await self.rm(src, recursive=True)

    async def chmod(self, path: str, mode: int) -> None:
        """Change file/directory permissions (in memory)."""
        self._assert_writable("chmod")

        normalized = self._normalize_path(path)

        if not await self.exists(normalized):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, chmod '{path}'"
            )

        # If in memory, update it
        if normalized in self._memory:
            entry = self._memory[normalized]
            if entry.type == "file":
                self._memory[normalized] = FileEntry(
                    content=entry.content,
                    mode=mode,
                    mtime=entry.mtime,
                )
            elif entry.type == "directory":
                self._memory[normalized] = DirectoryEntry(
                    mode=mode,
                    mtime=entry.mtime,
                )
            elif entry.type == "symlink":
                self._memory[normalized] = SymlinkEntry(
                    target=entry.target,
                    mode=mode,
                    mtime=entry.mtime,
                )
        else:
            # Copy from real fs to memory with new mode
            if await self.is_file(normalized):
                content = await self.read_file_bytes(normalized)
                self._memory[normalized] = FileEntry(content=content, mode=mode)
            elif await self.is_directory(normalized):
                self._memory[normalized] = DirectoryEntry(mode=mode)

    async def utimes(self, path: str, atime: float, mtime: float) -> None:
        """Set access and modification times (in memory)."""
        self._assert_writable("utimes")

        normalized = self._normalize_path(path)

        if not await self.exists(normalized):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, utimes '{path}'"
            )

        # If in memory, update it
        if normalized in self._memory:
            entry = self._memory[normalized]
            if entry.type == "file":
                self._memory[normalized] = FileEntry(
                    content=entry.content,
                    mode=entry.mode,
                    mtime=mtime,
                )
            elif entry.type == "directory":
                self._memory[normalized] = DirectoryEntry(
                    mode=entry.mode,
                    mtime=mtime,
                )
            elif entry.type == "symlink":
                self._memory[normalized] = SymlinkEntry(
                    target=entry.target,
                    mode=entry.mode,
                    mtime=mtime,
                )
        else:
            # Copy from real fs to memory with new mtime
            stat = await self.stat(normalized)
            if await self.is_file(normalized):
                content = await self.read_file_bytes(normalized)
                self._memory[normalized] = FileEntry(
                    content=content, mode=stat.mode, mtime=mtime
                )
            elif await self.is_directory(normalized):
                self._memory[normalized] = DirectoryEntry(mode=stat.mode, mtime=mtime)

    async def symlink(self, target: str, link_path: str) -> None:
        """Create a symbolic link (in memory)."""
        self._assert_writable("symlink")

        link_norm = self._normalize_path(link_path)

        if await self.exists(link_norm):
            raise FileExistsError(
                f"EEXIST: file already exists, symlink '{link_path}'"
            )

        self._ensure_parent_dirs(link_norm)
        self._deleted.discard(link_norm)
        self._memory[link_norm] = SymlinkEntry(target=target)

    async def link(self, existing_path: str, new_path: str) -> None:
        """Create a hard link (copies content to memory)."""
        self._assert_writable("link")

        existing_norm = self._normalize_path(existing_path)
        new_norm = self._normalize_path(new_path)

        if not await self.exists(existing_norm):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, link '{existing_path}'"
            )

        if not await self.is_file(existing_norm):
            raise PermissionError(
                f"EPERM: operation not permitted, link '{existing_path}'"
            )

        if await self.exists(new_norm):
            raise FileExistsError(
                f"EEXIST: file already exists, link '{new_path}'"
            )

        # Read content and copy
        content = await self.read_file_bytes(existing_norm)
        self._ensure_parent_dirs(new_norm)
        self._deleted.discard(new_norm)
        self._memory[new_norm] = FileEntry(content=content)

    async def readlink(self, path: str) -> str:
        """Read the target of a symbolic link."""
        normalized = self._normalize_path(path)

        if self._is_deleted(normalized):
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, readlink '{path}'"
            )

        # Check memory
        if normalized in self._memory:
            entry = self._memory[normalized]
            if entry.type != "symlink":
                raise OSError(f"EINVAL: invalid argument, readlink '{path}'")
            return entry.target

        # Check real fs
        real_path = self._to_real_path(normalized)
        if real_path is None or not real_path.is_symlink():
            if real_path is not None and real_path.exists():
                raise OSError(f"EINVAL: invalid argument, readlink '{path}'")
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, readlink '{path}'"
            )

        target = real_path.readlink()
        # Convert absolute real paths back to virtual paths to prevent leaking
        if target.is_absolute():
            # Resolve the target to handle symlinks in the path
            # (e.g., macOS /var -> /private/var)
            import os
            resolved_target = Path(os.path.realpath(str(target)))
            try:
                relative = resolved_target.relative_to(self._root)
                if self._mount_point == "/":
                    return f"/{relative}"
                return f"{self._mount_point}/{relative}"
            except ValueError:
                # Target is outside the overlay root
                pass
        return str(target)

    def resolve_path(self, base: str, path: str) -> str:
        """Resolve a path relative to a base."""
        if path.startswith("/"):
            return self._normalize_path(path)
        combined = f"/{path}" if base == "/" else f"{base}/{path}"
        return self._normalize_path(combined)

    def get_all_paths(self) -> list[str]:
        """Get all paths in the overlay (memory + real fs)."""
        paths: set[str] = set(self._memory.keys())

        # Add real fs paths under mount
        if self._root.exists():
            for root_str, dirs, files in os.walk(self._root):
                root_path = Path(root_str)
                rel = root_path.relative_to(self._root)
                if str(rel) == ".":
                    virtual_base = self._mount_point
                else:
                    virtual_base = f"{self._mount_point}/{rel}"

                if virtual_base not in self._deleted:
                    paths.add(virtual_base)

                for d in dirs:
                    vpath = f"{virtual_base}/{d}"
                    if vpath not in self._deleted:
                        paths.add(vpath)
                for f in files:
                    vpath = f"{virtual_base}/{f}"
                    if vpath not in self._deleted:
                        paths.add(vpath)

        # Remove deleted paths
        paths -= self._deleted

        return sorted(paths)
