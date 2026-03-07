from __future__ import annotations

import importlib.util
import os
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
    async def execute(self, code: str, timeout: float = 30.0) -> ExecutionResult: ...
    async def close(self) -> None: ...
    def environment_hash(self) -> str: ...


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
    has_session_mode: bool = False
    setup_instructions: list[str] = []

    def is_installed(self) -> bool:
        """Check if this adapter's dependencies are available."""
        return all(
            importlib.util.find_spec(pkg) is not None for pkg in self.python_packages
        )

    def has_credentials(self) -> bool:
        """Check if all required environment variables are set."""
        return all(
            os.getenv(var.name) for var in self.env_vars if var.required
        )

    @abstractmethod
    def create_backend(self, config: dict, credentials: dict) -> SandboxBackend:
        """Create and return a configured SandboxBackend instance."""
        ...
