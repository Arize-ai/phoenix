"""Core types for just-bash."""

from dataclasses import dataclass, field
from typing import Protocol, Callable, Awaitable, Optional, Any


@dataclass
class ExecResult:
    """Result of executing a command or script."""

    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    env: dict[str, str] = field(default_factory=dict)


@dataclass
class BashExecResult(ExecResult):
    """Extended result with environment state."""

    pass


# Convenience constants
OK = ExecResult(stdout="", stderr="", exit_code=0)
FAIL = ExecResult(stdout="", stderr="", exit_code=1)


@dataclass
class ExecutionLimits:
    """Configurable execution limits for security."""

    max_call_depth: int = 100
    max_command_count: int = 100_000
    max_loop_iterations: int = 10_000
    max_awk_iterations: int = 10_000
    max_sed_iterations: int = 10_000
    timeout_seconds: float = 5.0


@dataclass
class RequestTransform:
    """Headers to inject at the network boundary for an allowed URL."""

    headers: dict[str, str]


@dataclass
class AllowedUrl:
    """Allowed URL prefix with optional request transforms."""

    url: str
    transform: list[RequestTransform] = field(default_factory=list)


@dataclass
class NetworkConfig:
    """Network access configuration."""

    allowed_url_prefixes: list[str | AllowedUrl | dict[str, Any]] = field(default_factory=list)
    allowed_methods: list[str] = field(default_factory=lambda: ["GET", "HEAD"])
    max_redirects: int = 20
    timeout_ms: int = 30_000
    max_response_size: int = 10_485_760
    deny_private_ranges: bool = False
    dangerously_allow_full_internet_access: bool = False


SecureFetch = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]


class IFileSystem(Protocol):
    """Abstract filesystem interface."""

    async def read_file(self, path: str, encoding: str = "utf-8") -> str:
        """Read file contents as string."""
        ...

    async def read_file_bytes(self, path: str) -> bytes:
        """Read file contents as bytes."""
        ...

    async def write_file(
        self, path: str, content: str | bytes, encoding: str = "utf-8"
    ) -> None:
        """Write content to file."""
        ...

    async def append_file(self, path: str, content: str | bytes) -> None:
        """Append content to file."""
        ...

    async def exists(self, path: str) -> bool:
        """Check if path exists."""
        ...

    async def is_file(self, path: str) -> bool:
        """Check if path is a file."""
        ...

    async def is_directory(self, path: str) -> bool:
        """Check if path is a directory."""
        ...

    async def mkdir(self, path: str, recursive: bool = False) -> None:
        """Create directory."""
        ...

    async def readdir(self, path: str) -> list[str]:
        """List directory contents."""
        ...

    async def rm(self, path: str, recursive: bool = False, force: bool = False) -> None:
        """Remove file or directory."""
        ...

    async def stat(self, path: str) -> "FsStat":
        """Get file/directory stats."""
        ...

    async def chmod(self, path: str, mode: int) -> None:
        """Change file mode."""
        ...

    async def symlink(self, target: str, link_path: str) -> None:
        """Create symbolic link."""
        ...

    async def readlink(self, path: str) -> str:
        """Read symbolic link target."""
        ...

    async def utimes(self, path: str, atime: float, mtime: float) -> None:
        """Set access and modification times for a file."""
        ...

    async def realpath(self, path: str) -> str:
        """Resolve path to absolute canonical path (resolve all symlinks)."""
        ...

    def resolve_path(self, base: str, path: str) -> str:
        """Resolve path relative to base."""
        ...


@dataclass
class FsStat:
    """File/directory statistics."""

    is_file: bool = False
    is_directory: bool = False
    is_symbolic_link: bool = False
    mode: int = 0o644
    size: int = 0
    mtime: float = 0.0
    nlink: int = 1


@dataclass
class CommandExecOptions:
    """Options for exec calls within commands."""

    cwd: str
    """Working directory for the exec."""

    env: dict[str, str] | None = None
    """Environment variables to merge."""


@dataclass
class CommandContext:
    """Context provided to command execution."""

    fs: IFileSystem
    """Virtual filesystem interface."""

    cwd: str
    """Current working directory."""

    env: dict[str, str]
    """Environment variables."""

    stdin: str = ""
    """Standard input content."""

    limits: ExecutionLimits | None = None
    """Execution limits configuration."""

    exec: Optional[Callable[[str, dict[str, Any]], Awaitable[ExecResult]]] = None
    """Execute a subcommand (for xargs, bash -c, etc.)."""

    fetch: Optional[Any] = None
    """Secure fetch function for network requests (for curl)."""

    get_registered_commands: Optional[Callable[[], list[str]]] = None
    """Returns names of all registered commands (for help)."""

    sleep: Optional[Callable[[float], Awaitable[None]]] = None
    """Custom sleep implementation for testing."""

    fd_contents: dict[int, str] = field(default_factory=dict)
    """Contents of custom file descriptors (3+), for commands like read -u."""


class Command(Protocol):
    """Protocol for command implementations."""

    name: str

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the command with given arguments and context."""
        ...
