"""Interpreter types for just-bash."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Callable, Optional, Awaitable

if TYPE_CHECKING:
    import random
    from ..ast.types import FunctionDefNode, ScriptNode, StatementNode, CommandNode
    from ..types import ExecResult, IFileSystem, Command, ExecutionLimits


@dataclass
class VariableMetadata:
    """Per-variable metadata that can't be represented in the flat env dict."""

    attributes: set[str] = field(default_factory=set)
    """Variable attributes: r=readonly, x=export, i=integer, l=lowercase,
    u=uppercase, n=nameref, t=trace."""

    nameref_target: str | None = None
    """For namerefs (declare -n), the target variable name."""


class VariableStore(dict):
    """Dict subclass that adds metadata tracking for variables.

    Inherits from dict so all existing code that uses env as dict[str, str]
    continues to work unchanged. Adds a parallel _metadata dict for
    per-variable metadata (attributes, nameref targets) that can't be
    represented in the flat key-value store.
    """

    _metadata: dict[str, VariableMetadata]
    _local_meta_scopes: list[dict[str, VariableMetadata | None]]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._metadata = {}
        self._local_meta_scopes = []

    def get_metadata(self, name: str) -> VariableMetadata:
        """Get or create metadata for a variable."""
        if name not in self._metadata:
            self._metadata[name] = VariableMetadata()
        return self._metadata[name]

    def has_metadata(self, name: str) -> bool:
        """Check if a variable has metadata."""
        return name in self._metadata

    def resolve_nameref(self, name: str, max_depth: int = 10) -> str:
        """Resolve nameref chain, returning the final variable name.

        If name is not a nameref, returns name unchanged.
        Detects cycles and raises ValueError.
        """
        visited: set[str] = set()
        current = name
        for _ in range(max_depth):
            meta = self._metadata.get(current)
            if meta and "n" in meta.attributes and meta.nameref_target:
                if meta.nameref_target in visited:
                    raise ValueError(
                        f"{name}: circular name reference"
                    )
                visited.add(current)
                current = meta.nameref_target
            else:
                return current
        raise ValueError(f"{name}: nameref chain too long")

    def is_nameref(self, name: str) -> bool:
        """Check if a variable is a nameref."""
        meta = self._metadata.get(name)
        return meta is not None and "n" in meta.attributes

    def is_readonly(self, name: str) -> bool:
        """Check if a variable is readonly."""
        meta = self._metadata.get(name)
        return meta is not None and "r" in meta.attributes

    def set_attribute(self, name: str, attr: str) -> None:
        """Set an attribute on a variable."""
        self.get_metadata(name).attributes.add(attr)

    def remove_attribute(self, name: str, attr: str) -> None:
        """Remove an attribute from a variable."""
        meta = self._metadata.get(name)
        if meta:
            meta.attributes.discard(attr)

    def get_attributes(self, name: str) -> set[str]:
        """Get all attributes for a variable."""
        meta = self._metadata.get(name)
        return set(meta.attributes) if meta else set()

    def set_nameref(self, name: str, target: str) -> None:
        """Set a variable as a nameref pointing to target."""
        meta = self.get_metadata(name)
        meta.attributes.add("n")
        meta.nameref_target = target

    def clear_nameref(self, name: str) -> None:
        """Remove nameref from a variable."""
        meta = self._metadata.get(name)
        if meta:
            meta.attributes.discard("n")
            meta.nameref_target = None

    def push_local_meta_scope(self) -> None:
        """Push a new local metadata scope (for function calls)."""
        self._local_meta_scopes.append({})

    def pop_local_meta_scope(self) -> dict[str, VariableMetadata | None]:
        """Pop and return the top local metadata scope."""
        return self._local_meta_scopes.pop()

    def save_metadata_in_scope(self, name: str) -> None:
        """Save variable's current metadata in the current local scope."""
        if self._local_meta_scopes:
            scope = self._local_meta_scopes[-1]
            if name not in scope:
                meta = self._metadata.get(name)
                if meta:
                    scope[name] = VariableMetadata(
                        attributes=set(meta.attributes),
                        nameref_target=meta.nameref_target,
                    )
                else:
                    scope[name] = None

    def restore_metadata_from_scope(
        self, scope: dict[str, VariableMetadata | None]
    ) -> None:
        """Restore metadata from a saved local scope."""
        for name, saved_meta in scope.items():
            if saved_meta is None:
                self._metadata.pop(name, None)
            else:
                self._metadata[name] = saved_meta

    def copy(self) -> VariableStore:
        """Create a shallow copy that includes metadata."""
        new = VariableStore(super().copy())
        new._metadata = {
            k: VariableMetadata(
                attributes=set(v.attributes),
                nameref_target=v.nameref_target,
            )
            for k, v in self._metadata.items()
        }
        return new

    def to_env_dict(self) -> dict[str, str]:
        """Return a plain dict copy (for CommandContext, ExecResult)."""
        return dict(self)


@dataclass
class FDEntry:
    """A file descriptor entry in the FD table."""

    content: str = ""
    """Accumulated content for this FD."""

    mode: str = "r"
    """Mode: 'r' (read), 'w' (write), 'a' (append), 'rw' (read/write)."""

    path: str | None = None
    """If opened to a file, the path."""

    is_closed: bool = False
    """Whether this FD has been explicitly closed."""

    dup_of: int | None = None
    """If this FD was created by duplication, the source FD number."""


class FDTable:
    """File descriptor table for the interpreter.

    Manages FDs 0 (stdin), 1 (stdout), 2 (stderr), and custom FDs (3+).
    The FD table is persistent across commands and can be modified by
    exec redirections.
    """

    _fds: dict[int, FDEntry]

    def __init__(self):
        self._fds = {
            0: FDEntry(mode="r"),     # stdin
            1: FDEntry(mode="w"),     # stdout
            2: FDEntry(mode="w"),     # stderr
        }

    def open(self, fd: int, path: str, mode: str = "w") -> None:
        """Open a file descriptor to a path."""
        self._fds[fd] = FDEntry(mode=mode, path=path)

    def close(self, fd: int) -> None:
        """Close a file descriptor."""
        if fd in self._fds:
            self._fds[fd] = FDEntry(is_closed=True)

    def dup(self, src_fd: int, dst_fd: int) -> None:
        """Duplicate src_fd onto dst_fd (like 2>&1)."""
        if src_fd in self._fds:
            src = self._fds[src_fd]
            self._fds[dst_fd] = FDEntry(
                content=src.content,
                mode=src.mode,
                path=src.path,
                dup_of=src_fd,
            )

    def write(self, fd: int, data: str) -> None:
        """Write data to a file descriptor."""
        if fd not in self._fds:
            self._fds[fd] = FDEntry(mode="w")
        entry = self._fds[fd]
        if entry.mode == "a":
            entry.content += data
        else:
            entry.content = data

    def read(self, fd: int) -> str:
        """Read from a file descriptor."""
        if fd in self._fds:
            return self._fds[fd].content
        return ""

    def get_path(self, fd: int) -> str | None:
        """Get the file path for an FD, if any."""
        if fd in self._fds:
            return self._fds[fd].path
        return None

    def is_open(self, fd: int) -> bool:
        """Check if an FD is open."""
        return fd in self._fds and not self._fds[fd].is_closed

    def is_redirected(self, fd: int) -> bool:
        """Check if an FD has been redirected to a file."""
        return fd in self._fds and self._fds[fd].path is not None

    def clone(self) -> FDTable:
        """Create a deep copy of the FD table."""
        new = FDTable()
        new._fds = {
            fd: FDEntry(
                content=entry.content,
                mode=entry.mode,
                path=entry.path,
                is_closed=entry.is_closed,
            )
            for fd, entry in self._fds.items()
        }
        return new


@dataclass
class ShellOptions:
    """Shell options (set -e, etc.)."""

    errexit: bool = False
    """set -e: Exit immediately if a command exits with non-zero status."""

    pipefail: bool = False
    """set -o pipefail: Return exit status of last failing command in pipeline."""

    nounset: bool = False
    """set -u: Treat unset variables as an error when substituting."""

    xtrace: bool = False
    """set -x: Print commands and their arguments as they are executed."""

    verbose: bool = False
    """set -v: Print shell input lines as they are read."""

    noglob: bool = False
    """set -f: Disable filename expansion (globbing)."""

    noclobber: bool = False
    """set -C: Prevent output redirection from overwriting existing files."""

    nobraceexpand: bool = False
    """set +B: Disable brace expansion."""

    allexport: bool = False
    """set -a: Mark variables for export when they are set."""

    emacs: bool = False
    """set -o emacs: Use emacs-style line editing interface."""

    vi: bool = False
    """set -o vi: Use vi-style line editing interface."""


@dataclass
class InterpreterState:
    """Mutable state maintained by the interpreter."""

    env: VariableStore = field(default_factory=VariableStore)
    """Environment variables (VariableStore is a dict subclass)."""

    cwd: str = "/home/user"
    """Current working directory."""

    previous_dir: str = ""
    """Previous directory (for cd -). Empty string means OLDPWD not set."""

    functions: dict[str, "FunctionDefNode"] = field(default_factory=dict)
    """Defined functions."""

    local_scopes: list[dict[str, Optional[str]]] = field(default_factory=list)
    """Stack of local variable scopes for function calls."""

    call_depth: int = 0
    """Current function call depth."""

    source_depth: int = 0
    """Current source script nesting depth."""

    command_count: int = 0
    """Total commands executed (for limits)."""

    last_exit_code: int = 0
    """Exit code of last command."""

    last_arg: str = ""
    """Last argument of previous command (for $_)."""

    start_time: float = 0.0
    """Time when shell started (for $SECONDS)."""

    seconds_reset_time: Optional[float] = None
    """Time when SECONDS was reset (for SECONDS=n assignment)."""

    last_background_pid: int = 0
    """PID of last background job (for $!)."""

    current_line: int = 0
    """Current line number being executed (for $LINENO)."""

    options: ShellOptions = field(default_factory=ShellOptions)
    """Shell options."""

    in_condition: bool = False
    """True when executing condition for if/while/until."""

    loop_depth: int = 0
    """Current loop nesting depth (for break/continue)."""

    parent_has_loop_context: bool = False
    """True if spawned from within a loop context."""

    group_stdin: Optional[str] = None
    """Stdin for commands in compound commands."""

    dir_stack: list[str] = field(default_factory=list)
    """Directory stack for pushd/popd/dirs."""

    readonly_vars: set[str] = field(default_factory=lambda: {"SHELLOPTS", "BASHOPTS", "UID", "EUID", "PPID"})
    """Set of readonly variable names."""

    expansion_exit_code: Optional[int] = None
    """Exit code from expansion errors."""

    expansion_stderr: str = ""
    """Stderr from expansion errors."""

    associative_arrays: set[str] = field(default_factory=set)
    """Set of associative array variable names."""

    fd_table: FDTable = field(default_factory=FDTable)
    """File descriptor table for persistent FD redirections."""

    random_generator: Optional["random.Random"] = field(default=None, repr=False)
    """Random number generator for $RANDOM (seeded when RANDOM=n is assigned)."""


@dataclass
class InterpreterContext:
    """Context provided to interpreter methods."""

    state: InterpreterState
    """Mutable interpreter state."""

    fs: "IFileSystem"
    """Filesystem interface."""

    commands: dict[str, "Command"]
    """Command registry."""

    limits: "ExecutionLimits"
    """Execution limits."""

    exec_fn: Callable[[str, Optional[dict[str, str]], Optional[str]], Awaitable["ExecResult"]]
    """Function to execute a script string."""

    execute_script: Callable[["ScriptNode"], Awaitable["ExecResult"]]
    """Function to execute a script AST."""

    execute_statement: Callable[["StatementNode"], Awaitable["ExecResult"]]
    """Function to execute a statement AST."""

    execute_command: Callable[["CommandNode", str], Awaitable["ExecResult"]]
    """Function to execute a command AST."""

    fetch: Optional[Callable[[str], Awaitable[bytes]]] = None
    """Optional secure fetch function for network commands."""

    sleep: Optional[Callable[[float], Awaitable[None]]] = None
    """Optional sleep function for testing with mock clocks."""
