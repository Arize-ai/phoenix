"""
MountableFs Implementation

A filesystem that supports mounting multiple child filesystems at different paths.
Operations are routed to the appropriate filesystem based on the path.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

from ..types import FsStat, IFileSystem
from .in_memory_fs import InMemoryFs, DirentEntry


@dataclass
class MountConfig:
    """Configuration for a mount point."""

    mount_point: str
    """Virtual path where the filesystem is mounted."""

    filesystem: IFileSystem
    """The filesystem to mount."""


@dataclass
class MountableFsOptions:
    """Options for MountableFs."""

    base: Optional[IFileSystem] = None
    """Base filesystem for operations outside any mount. Defaults to InMemoryFs."""

    mounts: list[MountConfig] = field(default_factory=list)
    """Initial mounts to configure."""


class MountableFs:
    """
    Filesystem that supports mounting multiple child filesystems.

    Operations are routed to the appropriate filesystem based on path.
    The base filesystem handles paths outside any mount point.
    """

    def __init__(self, options: MountableFsOptions | None = None) -> None:
        """
        Initialize the mountable filesystem.

        Args:
            options: Configuration options
        """
        if options is None:
            options = MountableFsOptions()

        self._base = options.base if options.base is not None else InMemoryFs()
        self._mounts: dict[str, IFileSystem] = {}

        # Apply initial mounts
        for mount_config in options.mounts:
            self.mount(mount_config.mount_point, mount_config.filesystem)

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

    def mount(self, path: str, filesystem: IFileSystem) -> None:
        """
        Mount a filesystem at the given path.

        Args:
            path: Virtual path where the filesystem will be mounted
            filesystem: The filesystem to mount

        Raises:
            ValueError: If path is root, already mounted, or would create nested mounts
        """
        normalized = self._normalize_path(path)

        if normalized == "/":
            raise ValueError("Cannot mount at root '/'")

        if normalized in self._mounts:
            raise ValueError(f"Path '{path}' is already mounted")

        # Note: Nested mounts are allowed. The longest matching prefix is used
        # for path routing, so mounting /a/b/c under /a is valid and works as expected.

        self._mounts[normalized] = filesystem

    def unmount(self, path: str) -> None:
        """
        Unmount the filesystem at the given path.

        Args:
            path: Virtual path to unmount

        Raises:
            KeyError: If path is not mounted
        """
        normalized = self._normalize_path(path)
        if normalized not in self._mounts:
            raise KeyError(f"Path '{path}' is not mounted")
        del self._mounts[normalized]

    def get_mounts(self) -> list[str]:
        """Get list of all mount points."""
        return list(self._mounts.keys())

    def is_mount_point(self, path: str) -> bool:
        """Check if a path is a mount point."""
        normalized = self._normalize_path(path)
        return normalized in self._mounts

    def _route_path(self, path: str) -> tuple[IFileSystem, str, str | None]:
        """
        Route a path to the appropriate filesystem.

        Returns:
            Tuple of (filesystem, relative_path, mount_point or None for base)
        """
        normalized = self._normalize_path(path)

        # Find longest matching mount point
        best_mount: str | None = None
        best_length = 0

        for mount_point in self._mounts:
            if normalized == mount_point or normalized.startswith(mount_point + "/"):
                if len(mount_point) > best_length:
                    best_mount = mount_point
                    best_length = len(mount_point)

        if best_mount is not None:
            # Strip mount point to get relative path
            if normalized == best_mount:
                relative = "/"
            else:
                relative = normalized[len(best_mount):]
            return self._mounts[best_mount], relative, best_mount

        # Use base filesystem
        return self._base, normalized, None

    def _is_virtual_directory(self, path: str) -> bool:
        """Check if path is a virtual directory (parent of a mount point)."""
        normalized = self._normalize_path(path)

        for mount_point in self._mounts:
            if mount_point.startswith(normalized + "/"):
                return True

        return False

    def _get_virtual_children(self, path: str) -> list[str]:
        """Get virtual child directories from mount points."""
        normalized = self._normalize_path(path)
        prefix = normalized + "/" if normalized != "/" else "/"
        children: set[str] = set()

        for mount_point in self._mounts:
            if mount_point.startswith(prefix):
                # Extract the immediate child
                rest = mount_point[len(prefix):]
                child = rest.split("/")[0]
                if child:
                    children.add(child)

        return list(children)

    async def read_file(self, path: str, encoding: str = "utf-8") -> str:
        """Read file contents as string."""
        fs, rel_path, _ = self._route_path(path)
        return await fs.read_file(rel_path, encoding)

    async def read_file_bytes(self, path: str) -> bytes:
        """Read file contents as bytes."""
        fs, rel_path, _ = self._route_path(path)
        return await fs.read_file_bytes(rel_path)

    async def write_file(
        self,
        path: str,
        content: str | bytes,
        encoding: str = "utf-8",
    ) -> None:
        """Write content to file."""
        fs, rel_path, _ = self._route_path(path)
        await fs.write_file(rel_path, content, encoding)

    async def append_file(
        self,
        path: str,
        content: str | bytes,
        encoding: str = "utf-8",
    ) -> None:
        """Append content to file."""
        fs, rel_path, _ = self._route_path(path)
        # IFileSystem.append_file doesn't have encoding, so convert to bytes if needed
        if isinstance(content, str):
            content = content.encode(encoding)
        await fs.append_file(rel_path, content)

    async def exists(self, path: str) -> bool:
        """Check if path exists."""
        normalized = self._normalize_path(path)

        # Check if it's a mount point
        if normalized in self._mounts:
            return True

        # Check if it's a virtual parent of a mount
        if self._is_virtual_directory(normalized):
            return True

        fs, rel_path, _ = self._route_path(path)
        return await fs.exists(rel_path)

    async def is_file(self, path: str) -> bool:
        """Check if path is a file."""
        normalized = self._normalize_path(path)

        # Mount points and virtual parents are directories
        if normalized in self._mounts or self._is_virtual_directory(normalized):
            return False

        fs, rel_path, _ = self._route_path(path)
        return await fs.is_file(rel_path)

    async def is_directory(self, path: str) -> bool:
        """Check if path is a directory."""
        normalized = self._normalize_path(path)

        # Mount points are directories
        if normalized in self._mounts:
            return True

        # Virtual parents of mounts are directories
        if self._is_virtual_directory(normalized):
            return True

        fs, rel_path, _ = self._route_path(path)
        return await fs.is_directory(rel_path)

    async def stat(self, path: str) -> FsStat:
        """Get file/directory stats."""
        normalized = self._normalize_path(path)

        # Mount points are directories
        if normalized in self._mounts:
            return FsStat(
                is_file=False,
                is_directory=True,
                is_symbolic_link=False,
                mode=0o755,
                size=0,
                mtime=time.time(),
            )

        # Virtual parents of mounts are directories
        if self._is_virtual_directory(normalized):
            return FsStat(
                is_file=False,
                is_directory=True,
                is_symbolic_link=False,
                mode=0o755,
                size=0,
                mtime=time.time(),
            )

        fs, rel_path, _ = self._route_path(path)
        return await fs.stat(rel_path)

    async def lstat(self, path: str) -> FsStat:
        """Get file/directory stats (does not follow final symlink)."""
        normalized = self._normalize_path(path)

        if normalized in self._mounts or self._is_virtual_directory(normalized):
            return FsStat(
                is_file=False,
                is_directory=True,
                is_symbolic_link=False,
                mode=0o755,
                size=0,
                mtime=time.time(),
            )

        fs, rel_path, _ = self._route_path(path)
        # Try lstat if available, fall back to stat
        if hasattr(fs, "lstat"):
            result: FsStat = await fs.lstat(rel_path)
            return result
        return await fs.stat(rel_path)

    async def mkdir(self, path: str, recursive: bool = False) -> None:
        """Create a directory."""
        normalized = self._normalize_path(path)

        # Can't mkdir a mount point
        if normalized in self._mounts:
            if recursive:
                return  # Silently succeed
            raise OSError(f"EEXIST: mount point already exists, mkdir '{path}'")

        fs, rel_path, _ = self._route_path(path)
        await fs.mkdir(rel_path, recursive)

    async def readdir(self, path: str) -> list[str]:
        """List directory contents."""
        entries = await self.readdir_with_file_types(path)
        return [e.name for e in entries]

    async def readdir_with_file_types(self, path: str) -> list[DirentEntry]:
        """List directory contents with type information."""
        normalized = self._normalize_path(path)

        # Collect entries from base/mount and virtual children
        entries_map: dict[str, DirentEntry] = {}

        # Get virtual children (mount point names or intermediate directories)
        virtual_children = self._get_virtual_children(normalized)
        for child in virtual_children:
            child_path = f"{normalized}/{child}" if normalized != "/" else f"/{child}"
            # Determine if it's a mount point or just a virtual directory
            is_mount = child_path in self._mounts
            entries_map[child] = DirentEntry(
                name=child,
                is_file=False,
                is_directory=True,
                is_symbolic_link=False,
            )

        # Get entries from the filesystem at this path
        fs, rel_path, mount_point = self._route_path(normalized)

        try:
            if hasattr(fs, "readdir_with_file_types"):
                fs_entries = await fs.readdir_with_file_types(rel_path)
                for entry in fs_entries:
                    if entry.name not in entries_map:
                        entries_map[entry.name] = entry
            else:
                names = await fs.readdir(rel_path)
                for name in names:
                    if name not in entries_map:
                        # Need to stat to get type info
                        full_path = f"{normalized}/{name}" if normalized != "/" else f"/{name}"
                        entries_map[name] = DirentEntry(
                            name=name,
                            is_file=await self.is_file(full_path),
                            is_directory=await self.is_directory(full_path),
                            is_symbolic_link=False,
                        )
        except (FileNotFoundError, NotADirectoryError):
            # Path doesn't exist in the filesystem but might have virtual children
            if not entries_map:
                raise

        return sorted(entries_map.values(), key=lambda e: e.name)

    async def rm(
        self, path: str, recursive: bool = False, force: bool = False
    ) -> None:
        """Remove a file or directory."""
        normalized = self._normalize_path(path)

        # Can't remove mount points
        if normalized in self._mounts:
            raise OSError(f"EBUSY: cannot remove mount point, rm '{path}'")

        # Can't remove virtual parents of mounts
        if self._is_virtual_directory(normalized):
            raise OSError(f"EBUSY: cannot remove virtual mount parent, rm '{path}'")

        fs, rel_path, _ = self._route_path(path)
        await fs.rm(rel_path, recursive, force)

    async def cp(self, src: str, dest: str, recursive: bool = False) -> None:
        """Copy a file or directory."""
        src_fs, src_rel, src_mount = self._route_path(src)
        dest_fs, dest_rel, dest_mount = self._route_path(dest)

        # If same filesystem, delegate if cp method exists
        if src_mount == dest_mount and hasattr(src_fs, "cp"):
            await src_fs.cp(src_rel, dest_rel, recursive)
            return

        # Cross-filesystem copy: read from source, write to dest
        if await self.is_directory(src):
            if not recursive:
                raise IsADirectoryError(f"EISDIR: is a directory, cp '{src}'")
            await dest_fs.mkdir(dest_rel, recursive=True)
            for child in await self.readdir(src):
                src_child = f"{self._normalize_path(src)}/{child}"
                dest_child = f"{self._normalize_path(dest)}/{child}"
                await self.cp(src_child, dest_child, recursive=True)
        else:
            content = await src_fs.read_file_bytes(src_rel)
            await dest_fs.write_file(dest_rel, content)

    async def mv(self, src: str, dest: str) -> None:
        """Move a file or directory."""
        await self.cp(src, dest, recursive=True)
        await self.rm(src, recursive=True)

    async def chmod(self, path: str, mode: int) -> None:
        """Change file/directory permissions."""
        fs, rel_path, _ = self._route_path(path)
        await fs.chmod(rel_path, mode)

    async def utimes(self, path: str, atime: float, mtime: float) -> None:
        """Set access and modification times for a file."""
        fs, rel_path, _ = self._route_path(path)
        await fs.utimes(rel_path, atime, mtime)

    async def symlink(self, target: str, link_path: str) -> None:
        """Create a symbolic link."""
        fs, rel_path, _ = self._route_path(link_path)
        await fs.symlink(target, rel_path)

    async def link(self, existing_path: str, new_path: str) -> None:
        """Create a hard link (must be within same filesystem)."""
        _, _, existing_mount = self._route_path(existing_path)
        _, _, new_mount = self._route_path(new_path)

        if existing_mount != new_mount:
            raise OSError(
                f"EXDEV: cross-device link not permitted, link '{existing_path}' -> '{new_path}'"
            )

        fs, existing_rel, _ = self._route_path(existing_path)
        _, new_rel, _ = self._route_path(new_path)
        if hasattr(fs, "link"):
            await fs.link(existing_rel, new_rel)
        else:
            raise NotImplementedError(f"Filesystem does not support hard links")

    async def readlink(self, path: str) -> str:
        """Read the target of a symbolic link."""
        fs, rel_path, _ = self._route_path(path)
        return await fs.readlink(rel_path)

    def resolve_path(self, base: str, path: str) -> str:
        """Resolve a path relative to a base."""
        if path.startswith("/"):
            return self._normalize_path(path)
        combined = f"/{path}" if base == "/" else f"{base}/{path}"
        return self._normalize_path(combined)

    def get_all_paths(self) -> list[str]:
        """Get all paths in the filesystem."""
        paths: set[str] = set()

        # Get paths from base
        if hasattr(self._base, "get_all_paths"):
            for p in self._base.get_all_paths():
                # Skip paths that would be under mounts
                is_under_mount = False
                for mount in self._mounts:
                    if p == mount or p.startswith(mount + "/"):
                        is_under_mount = True
                        break
                if not is_under_mount:
                    paths.add(p)

        # Get paths from each mount
        for mount_point, fs in self._mounts.items():
            paths.add(mount_point)
            if hasattr(fs, "get_all_paths"):
                for p in fs.get_all_paths():
                    if p == "/":
                        continue
                    paths.add(f"{mount_point}{p}")

        # Add virtual parent directories
        for mount_point in self._mounts:
            parts = mount_point.split("/")
            for i in range(1, len(parts)):
                parent = "/".join(parts[:i]) or "/"
                if parent != "/":
                    paths.add(parent)

        return sorted(paths)
