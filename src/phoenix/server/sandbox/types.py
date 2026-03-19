"""
Core types for the sandbox backend system.

Zero runtime dependencies — stdlib only (D2 design decision). Safe to import
unconditionally regardless of optional extras.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class ExecutionResult:
    """Result returned by a sandbox execution."""

    stdout: str
    stderr: str
    return_value: Any = None
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return self.error is None


@dataclass
class EnvVarSpec:
    """Specification for an environment variable required by a sandbox adapter."""

    name: str
    description: str
    required: bool = True
    secret: bool = False


@dataclass
class ConfigFieldSpec:
    """Specification for a configuration field on a sandbox adapter."""

    name: str
    description: str
    required: bool = False
    default: Any = None


class SandboxBackend(ABC):
    """
    Protocol for sandbox backends.

    Surface: execute + start_session + stop_session + close.
    Session reuse is controlled by the caller-provided session_key passed to
    execute(). start_session/stop_session manage the lifecycle explicitly.
    """

    @abstractmethod
    async def start_session(self, session_key: str) -> None:
        """Start (or reuse) a sandbox session identified by session_key."""
        ...

    @abstractmethod
    async def stop_session(self, session_key: str) -> None:
        """Stop and clean up the sandbox session identified by session_key."""
        ...

    @abstractmethod
    async def execute(
        self,
        code: str,
        session_key: str,
        env: Optional[dict[str, str]] = None,
    ) -> ExecutionResult:
        """Execute code in the sandbox session identified by session_key."""
        ...

    @abstractmethod
    async def close(self) -> None:
        """Release all resources held by this backend."""
        ...


class BaseNoSessionBackend(SandboxBackend):
    """
    Mixin for stateless sandbox backends (e.g. WASM, Vercel).

    Provides no-op start_session and stop_session implementations.
    Subclasses only need to implement execute() and close().
    """

    async def start_session(self, session_key: str) -> None:
        pass

    async def stop_session(self, session_key: str) -> None:
        pass


class SandboxAdapter(ABC):
    """
    Abstract base class for sandbox adapters.

    An adapter bridges a SandboxConfig (DB row) and a SandboxBackend instance.
    It owns credential resolution and backend construction.
    """

    #: Unique key identifying this adapter (matches backend_type in sandbox_providers).
    key: str

    #: Human-readable name for display in the UI.
    display_name: str

    #: Languages this adapter supports (must match Language.name values in DB).
    supported_languages: list[str]

    #: Environment variable specs required by this adapter.
    env_var_specs: list[EnvVarSpec]

    #: Config field specs accepted by this adapter.
    config_field_specs: list[ConfigFieldSpec]

    @abstractmethod
    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        """Construct and return a SandboxBackend from the provided config."""
        ...
