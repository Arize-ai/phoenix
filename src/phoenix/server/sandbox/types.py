"""
Core types for the sandbox backend system.

Only depends on stdlib and pydantic (a core Phoenix dependency). Safe to
import unconditionally regardless of optional sandbox extras.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Annotated, Any, Literal, Optional, Type, Union

from pydantic import BaseModel, ConfigDict, Field


class UnsupportedOperation(Exception):
    """Raised when a sandbox backend does not support a requested operation."""


# ---------------------------------------------------------------------------
# Shared config shapes — imported by per-adapter configs that opt in.
# ---------------------------------------------------------------------------


class EnvVarLiteral(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["literal"]
    name: str
    value: str


class EnvVarSecretRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["secret_ref"]
    name: str
    secret_key: str


EnvVarEntry = Annotated[
    Union[EnvVarLiteral, EnvVarSecretRef],
    Field(discriminator="kind"),
]


class InternetAccessConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["deny", "allow"] = "allow"


class PythonDependenciesConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    packages: list[str] = Field(default_factory=list)
    lockfile: Optional[str] = None


class TypescriptDependenciesConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    packages: list[str] = Field(default_factory=list)
    lockfile: Optional[str] = None


@dataclass
class ConfigFieldSpec:
    """
    Describes a single key in SandboxConfig.config for a given adapter.

    Used to drive UI form rendering and server-side validation. Covers
    config keys only — not provider-level credentials (D8).
    """

    key: str
    display_name: str
    field_type: Literal["string", "integer", "boolean", "select"]
    required: bool = False
    description: str = ""
    choices: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Per-adapter pydantic config models.
# extra="allow" preserves unknown keys (D9 contract).
# All config fields are optional — adapters use defaults for missing keys.
# Field(title=...) drives ConfigFieldSpec.display_name derivation.
# ---------------------------------------------------------------------------


class E2BConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    template: str = Field(
        default="base",
        title="Template",
        description="E2B sandbox template ID. Defaults to 'base'.",
    )
    cwd: Optional[str] = Field(
        default=None,
        title="Working Directory",
        description="Working directory for code execution inside the sandbox.",
    )
    metadata: Optional[str] = Field(
        default=None,
        title="Metadata",
        description="Metadata string attached to the sandbox at creation time.",
    )
    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="User-defined environment variables injected at execution time.",
    )
    internet_access: Optional[InternetAccessConfig] = Field(
        default=None,
        title="Internet Access",
        description="Controls whether the sandbox can reach the internet.",
    )
    dependencies: Optional[PythonDependenciesConfig] = Field(
        default=None,
        title="Python Dependencies",
        description="Python packages to install before code execution.",
    )


class DaytonaPythonConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    server_url: str = Field(
        default="",
        title="Server URL",
        description="Daytona server URL. Leave empty to use the default.",
    )
    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="User-defined environment variables injected at execution time.",
    )
    internet_access: Optional[InternetAccessConfig] = Field(
        default=None,
        title="Internet Access",
        description="Controls whether the sandbox can reach the internet.",
    )
    dependencies: Optional[PythonDependenciesConfig] = Field(
        default=None,
        title="Python Dependencies",
        description="Python packages to install before code execution.",
    )


class DenoConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="User-defined environment variables injected at execution time.",
    )


class _VercelConfigBase(BaseModel):
    model_config = ConfigDict(extra="allow")

    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="User-defined environment variables injected at execution time.",
    )


class VercelPythonConfig(_VercelConfigBase):
    dependencies: Optional[PythonDependenciesConfig] = Field(
        default=None,
        title="Python Dependencies",
        description="Python packages to install before code execution.",
    )


class VercelTypescriptConfig(_VercelConfigBase):
    dependencies: Optional[TypescriptDependenciesConfig] = Field(
        default=None,
        title="TypeScript Dependencies",
        description="npm packages to install before code execution.",
    )


class WASMConfig(BaseModel):
    model_config = ConfigDict(extra="allow")


class ModalConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    app_name: str = Field(
        default="phoenix-sandbox",
        title="App Name",
        description="Modal app name. Created on first use if it does not exist.",
    )
    timeout: int = Field(
        default=600,
        title="Timeout (seconds)",
        description="Hard sandbox timeout in seconds.",
    )
    idle_timeout: int = Field(
        default=300,
        title="Idle Timeout (seconds)",
        description="Duration of idleness before a sandbox is terminated.",
    )
    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="User-defined environment variables injected at execution time.",
    )
    internet_access: Optional[InternetAccessConfig] = Field(
        default=None,
        title="Internet Access",
        description="Controls whether the sandbox can reach the internet.",
    )
    dependencies: Optional[PythonDependenciesConfig] = Field(
        default=None,
        title="Python Dependencies",
        description="Python packages to install before code execution.",
    )


@dataclass
class ExecutionResult:
    """Result returned by a sandbox execution."""

    stdout: str
    stderr: str
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return self.error is None


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
        timeout: Optional[int] = None,
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

    #: Language this adapter supports (must match Language.name values in DB).
    language: Literal["PYTHON", "TYPESCRIPT"]

    #: Pydantic model used for config validation. Subclasses override at class level.
    config_model: Type[BaseModel] = BaseModel

    #: Specs for config keys accepted by this adapter. Subclasses override at class level.
    config_field_specs: list["ConfigFieldSpec"] = []

    @abstractmethod
    def build_backend(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        """Construct and return a SandboxBackend from the provided config.

        user_env is a pre-resolved plaintext dict of user-supplied environment
        variables (name → value). It is passed as a sibling argument — NOT
        merged into config — to prevent collision with PHOENIX_SANDBOX_*
        credential keys that adapters read from config. Adapters that support
        env var injection (supports_env_vars=True) forward user_env to their
        SDK at execute-time or creation-time as appropriate. Adapters that do
        not support env var injection MUST raise UnsupportedOperation if
        user_env is non-empty.
        """
        ...

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Validate config via the adapter's pydantic config_model.

        Returns the validated config dict (unknown keys preserved per D9).
        Raises ValueError on constraint violations (D3).
        """
        from pydantic import ValidationError

        try:
            validated = self.config_model.model_validate(config)
        except ValidationError as exc:
            raise ValueError(str(exc)) from exc
        # model_dump preserves extra fields because models use extra="allow"
        return validated.model_dump()
