"""
ReadWriteFs Implementation

A filesystem wrapper that provides direct access to the real filesystem.
All operations are delegated to the actual OS filesystem with path translation.
"""

from __future__ import annotations

import os
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import aiofiles  # type: ignore[import-untyped]
import aiofiles.os  # type: ignore[import-untyped]

from ..types import FsStat


@dataclass
class DirentEntry:
    """Directory entry information."""

    name: str
    is_file: bool = False
    is_directory: bool = False
    is_symbolic_link: bool = False


@dataclass
class ReadWriteFsOptions:
    """Options for ReadWriteFs."""

    root: str
    """Root directory on the real filesystem. All operations are relative to this."""


class ReadWriteFs:
    """
    Direct wrapper around the real filesystem.

    Provides an IFileSystem-compatible interface that operates on actual files.
    All virtual paths are translated to real paths under the configured root.
    """

    def __init__(self, options: ReadWriteFsOptions) -> None:
        """
        Initialize the filesystem.

        Args:
            options: Configuration options including the root directory

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

    def _to_real_path(self, virtual_path: str) -> Path:
        """Convert a virtual path to a real filesystem path."""
        normalized = self._normalize_path(virtual_path)

        if normalized == "/":
            return self._root

        # Strip leading / and join with root
        relative = normalized[1:]  # Remove leading /
        return self._root / relative

    def _dirname(self, path: str) -> str:
        """Get the directory name of a path."""
        normalized = self._normalize_path(path)
        if normalized == "/":
            return "/"
        last_slash = normalized.rfind("/")
        return "/" if last_slash == 0 else normalized[:last_slash]

    def _ensure_parent_dirs(self, path: str) -> None:
        """Ensure all parent directories exist on the real filesystem."""
        real_path = self._to_real_path(path)
        real_path.parent.mkdir(parents=True, exist_ok=True)

    async def read_file(self, path: str, encoding: str = "utf-8") -> str:
        """Read file contents as string."""
        real_path = self._to_real_path(path)

        if not real_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, open '{path}'"
            )

        if real_path.is_dir():
            raise IsADirectoryError(
                f"EISDIR: illegal operation on a directory, read '{path}'"
            )

        async with aiofiles.open(real_path, "r", encoding=encoding) as f:
            content: str = await f.read()
            return content

    async def read_file_bytes(self, path: str) -> bytes:
        """Read file contents as bytes."""
        real_path = self._to_real_path(path)

        if not real_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, open '{path}'"
            )

        if real_path.is_dir():
            raise IsADirectoryError(
                f"EISDIR: illegal operation on a directory, read '{path}'"
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
        """Write content to file."""
        self._ensure_parent_dirs(path)
        real_path = self._to_real_path(path)

        if isinstance(content, str):
            async with aiofiles.open(real_path, "w", encoding=encoding) as f:
                await f.write(content)
        else:
            async with aiofiles.open(real_path, "wb") as f:
                await f.write(content)

    async def append_file(
        self,
        path: str,
        content: str | bytes,
        encoding: str = "utf-8",
    ) -> None:
        """Append content to file."""
        self._ensure_parent_dirs(path)
        real_path = self._to_real_path(path)

        if isinstance(content, str):
            async with aiofiles.open(real_path, "a", encoding=encoding) as f:
                await f.write(content)
        else:
            async with aiofiles.open(real_path, "ab") as f:
                await f.write(content)

    async def exists(self, path: str) -> bool:
        """Check if path exists."""
        real_path = self._to_real_path(path)
        return real_path.exists()

    async def is_file(self, path: str) -> bool:
        """Check if path is a file."""
        real_path = self._to_real_path(path)
        return real_path.is_file()

    async def is_directory(self, path: str) -> bool:
        """Check if path is a directory."""
        real_path = self._to_real_path(path)
        return real_path.is_dir()

    async def stat(self, path: str) -> FsStat:
        """Get file/directory stats (follows symlinks)."""
        real_path = self._to_real_path(path)

        if not real_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, stat '{path}'"
            )

        stat_result = real_path.stat()

        return FsStat(
            is_file=real_path.is_file(),
            is_directory=real_path.is_dir(),
            is_symbolic_link=False,  # stat follows symlinks
            mode=stat_result.st_mode & 0o777,
            size=stat_result.st_size,
            mtime=stat_result.st_mtime,
            nlink=stat_result.st_nlink,
        )

    async def lstat(self, path: str) -> FsStat:
        """Get file/directory stats (does not follow final symlink)."""
        real_path = self._to_real_path(path)

        if not real_path.exists() and not real_path.is_symlink():
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
            nlink=stat_result.st_nlink,
        )

    async def mkdir(self, path: str, recursive: bool = False) -> None:
        """Create a directory."""
        real_path = self._to_real_path(path)

        if real_path.exists():
            if real_path.is_file():
                raise OSError(f"EEXIST: file already exists, mkdir '{path}'")
            if not recursive:
                raise OSError(f"EEXIST: directory already exists, mkdir '{path}'")
            return

        if recursive:
            real_path.mkdir(parents=True, exist_ok=True)
        else:
            if not real_path.parent.exists():
                raise OSError(f"ENOENT: no such file or directory, mkdir '{path}'")
            real_path.mkdir()

    async def readdir(self, path: str) -> list[str]:
        """List directory contents."""
        entries = await self.readdir_with_file_types(path)
        return [e.name for e in entries]

    async def readdir_with_file_types(self, path: str) -> list[DirentEntry]:
        """List directory contents with type information."""
        real_path = self._to_real_path(path)

        if not real_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, scandir '{path}'"
            )

        if not real_path.is_dir():
            raise NotADirectoryError(
                f"ENOTDIR: not a directory, scandir '{path}'"
            )

        entries: list[DirentEntry] = []
        for item in real_path.iterdir():
            entries.append(
                DirentEntry(
                    name=item.name,
                    is_file=item.is_file(),
                    is_directory=item.is_dir(),
                    is_symbolic_link=item.is_symlink(),
                )
            )

        return sorted(entries, key=lambda e: e.name)

    async def rm(
        self, path: str, recursive: bool = False, force: bool = False
    ) -> None:
        """Remove a file or directory."""
        real_path = self._to_real_path(path)

        if not real_path.exists():
            if force:
                return
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, rm '{path}'"
            )

        if real_path.is_dir():
            if recursive:
                shutil.rmtree(real_path)
            else:
                # Check if empty
                if any(real_path.iterdir()):
                    raise OSError(f"ENOTEMPTY: directory not empty, rm '{path}'")
                real_path.rmdir()
        else:
            real_path.unlink()

    async def cp(self, src: str, dest: str, recursive: bool = False) -> None:
        """Copy a file or directory."""
        src_real = self._to_real_path(src)
        dest_real = self._to_real_path(dest)

        if not src_real.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, cp '{src}'"
            )

        if src_real.is_dir():
            if not recursive:
                raise IsADirectoryError(f"EISDIR: is a directory, cp '{src}'")
            shutil.copytree(src_real, dest_real)
        else:
            self._ensure_parent_dirs(dest)
            shutil.copy2(src_real, dest_real)

    async def mv(self, src: str, dest: str) -> None:
        """Move a file or directory."""
        src_real = self._to_real_path(src)
        dest_real = self._to_real_path(dest)

        if not src_real.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, mv '{src}'"
            )

        self._ensure_parent_dirs(dest)
        shutil.move(str(src_real), str(dest_real))

    async def chmod(self, path: str, mode: int) -> None:
        """Change file/directory permissions."""
        real_path = self._to_real_path(path)

        if not real_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, chmod '{path}'"
            )

        real_path.chmod(mode)

    async def utimes(self, path: str, atime: float, mtime: float) -> None:
        """Set access and modification times for a file."""
        real_path = self._to_real_path(path)

        if not real_path.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, utimes '{path}'"
            )

        os.utime(real_path, (atime, mtime))

    async def symlink(self, target: str, link_path: str) -> None:
        """Create a symbolic link."""
        link_real = self._to_real_path(link_path)

        if link_real.exists() or link_real.is_symlink():
            raise FileExistsError(
                f"EEXIST: file already exists, symlink '{link_path}'"
            )

        self._ensure_parent_dirs(link_path)

        # Convert target to real path for the symlink
        target_real = self._to_real_path(target)
        link_real.symlink_to(target_real)

    async def link(self, existing_path: str, new_path: str) -> None:
        """Create a hard link."""
        existing_real = self._to_real_path(existing_path)
        new_real = self._to_real_path(new_path)

        if not existing_real.exists():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, link '{existing_path}'"
            )

        if not existing_real.is_file():
            raise PermissionError(
                f"EPERM: operation not permitted, link '{existing_path}'"
            )

        if new_real.exists():
            raise FileExistsError(
                f"EEXIST: file already exists, link '{new_path}'"
            )

        self._ensure_parent_dirs(new_path)
        new_real.hardlink_to(existing_real)

    async def readlink(self, path: str) -> str:
        """Read the target of a symbolic link."""
        real_path = self._to_real_path(path)

        if not real_path.exists() and not real_path.is_symlink():
            raise FileNotFoundError(
                f"ENOENT: no such file or directory, readlink '{path}'"
            )

        if not real_path.is_symlink():
            raise OSError(f"EINVAL: invalid argument, readlink '{path}'")

        # Get the target and convert back to virtual path
        target_real = real_path.readlink()

        # If target is relative, keep it relative
        if not target_real.is_absolute():
            return str(target_real)

        # If target is under our root, convert to virtual path
        try:
            relative = target_real.relative_to(self._root)
            return "/" + str(relative)
        except ValueError:
            # Target is outside root, return as-is
            return str(target_real)

    def resolve_path(self, base: str, path: str) -> str:
        """Resolve a path relative to a base."""
        if path.startswith("/"):
            return self._normalize_path(path)
        combined = f"/{path}" if base == "/" else f"{base}/{path}"
        return self._normalize_path(combined)

    def get_all_paths(self) -> list[str]:
        """Get all paths in the filesystem (useful for debugging/glob)."""
        paths: list[str] = ["/"]

        for root, dirs, files in os.walk(self._root):
            rel_root = Path(root).relative_to(self._root)
            virtual_root = "/" + str(rel_root) if str(rel_root) != "." else ""

            for d in dirs:
                paths.append(f"{virtual_root}/{d}")
            for f in files:
                paths.append(f"{virtual_root}/{f}")

        return paths
