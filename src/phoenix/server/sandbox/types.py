from __future__ import annotations

import importlib.util
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Protocol


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    error: Exception | None = None
    timed_out: bool = False


class SandboxBackend(Protocol):
    async def execute(
        self, code: str, timeout: float = 30.0, *, session_key: str | None = None
    ) -> ExecutionResult: ...
    async def start_session(self, session_key: str) -> None: ...
    async def stop_session(self, session_key: str) -> None: ...
    async def close(self) -> None: ...


class BaseNoSessionBackend:
    """Mixin providing no-op start_session/stop_session for stateless backends."""

    async def start_session(self, session_key: str) -> None:
        pass

    async def stop_session(self, session_key: str) -> None:
        pass


@dataclass(frozen=True)
class EnvVarSpec:
    """Describes an environment variable used by a sandbox adapter."""

    name: str
    required: bool = True
    description: str = ""


@dataclass(frozen=True)
class ConfigFieldSpec:
    """Describes a user-configurable field for a sandbox adapter."""

    key: str
    label: str
    placeholder: str = ""
    description: str = ""


class SandboxAdapter(ABC):
    """Abstract base class for sandbox adapter metadata and factory.

    Subclasses declare static metadata as class-level attributes and implement
    ``create_backend`` to produce a ``SandboxBackend`` instance.
    """

    _key: str
    label: str
    description: str
    python_packages: list[str] = []
    env_vars: list[EnvVarSpec] = []
    config_fields: list[ConfigFieldSpec] = []
    config_required: bool = False
    setup_instructions: list[str] = []
    supported_languages: list[str] = ["PYTHON"]

    def is_installed(self) -> bool:
        """Check if this adapter's dependencies are available."""
        return all(importlib.util.find_spec(pkg) is not None for pkg in self.python_packages)

    @abstractmethod
    def create_backend(self, config: dict[str, str], credentials: dict[str, str]) -> SandboxBackend:
        """Create and return a configured SandboxBackend instance."""
        ...
