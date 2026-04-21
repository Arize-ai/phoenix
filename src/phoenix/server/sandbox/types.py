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


@dataclass
class ProviderCredentialSpec:
    """Describes a provider credential env var required by a sandbox adapter.

    Used by _resolve_sandbox_credentials() for DB secret lookup and by
    setSandboxCredential/deleteSandboxCredential mutations for key validation.
    """

    key: str
    display_name: str
    description: str = ""


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
    internet_access: Optional[InternetAccessConfig] = Field(
        default=None,
        title="Internet Access",
        description="Controls whether the sandbox can reach the internet.",
    )


class _VercelConfigBase(BaseModel):
    model_config = ConfigDict(extra="allow")

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
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Execute code in the sandbox session identified by session_key.

        User-supplied environment variables are set at build_backend() time
        via the `user_env` argument and carried by the adapter for the life
        of the session. There is no per-call env override by design.
        """
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


# ---------------------------------------------------------------------------
# Section-level semantic equality helpers for capability-gate bypass logic.
# Used by _enforce_capability_gates to determine whether a submitted section
# is an unchanged carry-forward of the stored baseline.
# ---------------------------------------------------------------------------


def _normalize_env_var(entry: Any) -> dict[str, Any]:
    """Return a stable dict representation of a single env_var entry."""
    if isinstance(entry, dict):
        return dict(entry)
    # pydantic model instance — use model_dump for canonical representation
    if hasattr(entry, "model_dump"):
        result: dict[str, Any] = entry.model_dump(mode="json")
        return result
    return {
        "kind": getattr(entry, "kind", ""),
        "name": getattr(entry, "name", ""),
        "value": getattr(entry, "value", ""),
        "secret_key": getattr(entry, "secret_key", ""),
    }


def _env_vars_equal(a: Any, b: Any) -> bool:
    """Return True if two env_vars lists are semantically equal (order-independent).

    Uses Counter over canonical tuple representations so duplicate entries in
    one list are not collapsed — [X, X] != [X].
    """
    from collections import Counter

    if not a and not b:
        return True
    if not a or not b:
        return False

    def _to_tuple(entry: Any) -> tuple[str, ...]:
        d = _normalize_env_var(entry)
        return (d.get("kind", ""), d.get("name", ""), d.get("value", ""), d.get("secret_key", ""))

    return Counter(_to_tuple(e) for e in a) == Counter(_to_tuple(e) for e in b)


def _normalize_section(value: Any, model_cls: Type[BaseModel]) -> dict[str, Any]:
    """Normalize a config section through pydantic model_dump so comparisons track the schema."""
    if value is None:
        return {}
    if isinstance(value, dict):
        dumped: dict[str, Any] = model_cls.model_validate(value).model_dump(
            mode="json", exclude_defaults=False
        )
        return dumped
    if hasattr(value, "model_dump"):
        dumped = value.model_dump(mode="json", exclude_defaults=False)
        return dumped
    return {}


def _internet_access_equal(a: Any, b: Any) -> bool:
    """Return True if two internet_access values are semantically equal.

    Canonicalizes through InternetAccessConfig.model_dump so future fields
    are automatically included rather than silently dropped.
    """
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return _normalize_section(a, InternetAccessConfig) == _normalize_section(
        b, InternetAccessConfig
    )


def _packages_equal(a: Any, b: Any) -> bool:
    """Return True if two dependencies sections are semantically equal.

    Canonicalizes through PythonDependenciesConfig.model_dump so the lockfile
    field is included — set(packages) alone is insufficient. Package list order
    is not semantically meaningful, so packages are sorted before comparison.
    """
    if not a and not b:
        return True
    if not a or not b:
        return False

    def _canonical(value: Any) -> dict[str, Any]:
        d = _normalize_section(value, PythonDependenciesConfig)
        d["packages"] = sorted(d.get("packages") or [])
        return d

    return _canonical(a) == _canonical(b)


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

    #: Specs for provider credential env vars required by this adapter.
    credential_specs: list["ProviderCredentialSpec"] = []

    @abstractmethod
    def build_backend(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        """Construct and return a SandboxBackend from the provided config.

        The canonical capability contract is defined on AdapterMetadata
        (phoenix.server.sandbox.AdapterMetadata). Each flag on that class
        specifies the runtime obligation for this method:

        - supports_env_vars: if True, forward user_env to the backend at
          execute-time or creation-time as appropriate. If False, MUST raise
          UnsupportedOperation when user_env is non-empty.
        - internet_access_capability: if "none", MUST raise UnsupportedOperation
          when config.get("internet_access") resolves to a non-"none" mode.
        - dependencies_language: if None, MUST raise UnsupportedOperation when
          config.get("dependencies") contains non-empty packages.

        user_env is a pre-resolved plaintext dict of user-supplied environment
        variables (name → value). It is passed as a sibling argument — NOT
        merged into config — to prevent collision with PHOENIX_SANDBOX_*
        credential keys that adapters read from config.
        """
        ...

    def validate_config(
        self,
        config: dict[str, Any],
        stored_config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Validate config via the adapter's pydantic config_model, then apply
        capability gates from AdapterMetadata.

        Returns the validated config dict (unknown keys preserved per D9).
        Raises ValueError on struct-validation failures (D3). Raises pydantic
        ValidationError when the validated config violates an advertised
        capability (D4):
          - supports_env_vars is False and config has non-empty env_vars
          - internet_access_capability == "none" and config has an
            internet_access block
          - dependencies_language is None and config.dependencies.packages
            is non-empty

        When ``stored_config`` is provided (update path), capability gates are
        skipped for sections that are semantically unchanged vs the stored
        baseline. This allows admins to round-trip configs whose
        capability-gated sections predate the current advertisement without
        relaxing runtime enforcement (build_backend still raises
        UnsupportedOperation).

        The existing per-adapter build_backend capability guards remain in
        place as defense-in-depth (see _enforce_capabilities template method
        in Phase 4).
        """
        from pydantic import ValidationError

        try:
            validated = self.config_model.model_validate(config)
        except ValidationError as exc:
            raise ValueError(str(exc)) from exc
        # model_dump preserves extra fields because models use extra="allow"
        validated_dict = validated.model_dump()
        self._enforce_unique_env_var_names(validated_dict)
        self._enforce_capability_gates(validated_dict, stored_config=stored_config)
        return validated_dict

    def _enforce_unique_env_var_names(self, config: dict[str, Any]) -> None:
        """Reject duplicate ``name`` values in config.env_vars.

        Silent last-wins is unsafe: two entries with the same name but
        different kinds (e.g. literal vs secret_ref) would let one arbitrarily
        override the other at resolve time. Fail at write time instead so the
        caller sees a deterministic diagnostic.
        """
        from pydantic import ValidationError
        from pydantic_core import InitErrorDetails, PydanticCustomError

        env_vars = config.get("env_vars") or []
        seen: set[str] = set()
        duplicates: list[str] = []
        for entry in env_vars:
            name = entry.get("name") if isinstance(entry, dict) else getattr(entry, "name", None)
            if not isinstance(name, str):
                continue
            if name in seen and name not in duplicates:
                duplicates.append(name)
            seen.add(name)

        if not duplicates:
            return

        errors: list[InitErrorDetails] = [
            InitErrorDetails(
                type=PydanticCustomError(
                    "duplicate_env_var_name",
                    (
                        "Duplicate env_var name '{name}': env_var names must be "
                        "unique within a single SandboxConfig."
                    ),
                    {"name": name},
                ),
                loc=("env_vars",),
                input=env_vars,
            )
            for name in duplicates
        ]
        raise ValidationError.from_exception_data(type(self).__name__, errors)

    def _enforce_capability_gates(
        self,
        config: dict[str, Any],
        stored_config: Optional[dict[str, Any]] = None,
    ) -> None:
        """Raise pydantic ValidationError if config violates AdapterMetadata
        capability flags.

        Metadata is resolved via a lazy import to avoid a circular dependency
        between `types.py` and `sandbox.__init__`.

        When ``stored_config`` is provided, a capability-gated section is
        skipped if the submitted value is semantically equal to the stored
        baseline, allowing preserved sections to round-trip without error.
        Runtime enforcement (``_enforce_capabilities``) remains fail-closed.
        """
        from pydantic import ValidationError
        from pydantic_core import InitErrorDetails, PydanticCustomError

        try:
            from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
        except ImportError:
            return
        metadata = SANDBOX_ADAPTER_METADATA.get(self.key)
        if metadata is None:
            return

        errors: list[InitErrorDetails] = []

        env_vars = config.get("env_vars")
        if not metadata.supports_env_vars and env_vars:
            stored_env_vars = stored_config.get("env_vars") if stored_config else None
            if not _env_vars_equal(env_vars, stored_env_vars):
                errors.append(
                    InitErrorDetails(
                        type=PydanticCustomError(
                            "capability_violation",
                            (
                                "{adapter} adapter does not support user-defined "
                                "environment variables; remove env_vars or switch "
                                "to an adapter that supports them."
                            ),
                            {"adapter": self.key},
                        ),
                        loc=("env_vars",),
                        input=env_vars,
                    )
                )

        internet_access = config.get("internet_access")
        if metadata.internet_access_capability == "none" and internet_access is not None:
            stored_ia = stored_config.get("internet_access") if stored_config else None
            if not _internet_access_equal(internet_access, stored_ia):
                errors.append(
                    InitErrorDetails(
                        type=PydanticCustomError(
                            "capability_violation",
                            (
                                "{adapter} adapter does not support internet_access "
                                "configuration; remove the internet_access field or "
                                "switch to an adapter that supports it."
                            ),
                            {"adapter": self.key},
                        ),
                        loc=("internet_access",),
                        input=internet_access,
                    )
                )

        dependencies = config.get("dependencies")
        if metadata.dependencies_language is None and dependencies:
            packages = dependencies.get("packages") if isinstance(dependencies, dict) else None
            if packages:
                stored_deps = stored_config.get("dependencies") if stored_config else None
                if not _packages_equal(dependencies, stored_deps):
                    errors.append(
                        InitErrorDetails(
                            type=PydanticCustomError(
                                "capability_violation",
                                (
                                    "{adapter} adapter does not support dependency "
                                    "installation; remove dependencies.packages or "
                                    "switch to an adapter that supports it."
                                ),
                                {"adapter": self.key},
                            ),
                            loc=("dependencies", "packages"),
                            input=packages,
                        )
                    )

        if errors:
            raise ValidationError.from_exception_data(
                type(self).__name__,
                errors,
            )

    def _enforce_capabilities(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> None:
        """Raise UnsupportedOperation if config/user_env violates this adapter's
        advertised capabilities per SANDBOX_ADAPTER_METADATA.

        Build-time (second) capability guard. The first guard runs at
        validate_config time via ``_enforce_capability_gates`` and raises
        pydantic ValidationError. This method runs at ``build_backend`` time,
        enforcing the same contract against the effective runtime inputs
        (including per-execute ``user_env``) and raising UnsupportedOperation
        so executor surfaces (evaluators, chat_mutations) can surface the
        violation as an adapter error.

        Contract:
        - ``supports_env_vars`` is False → config's ``env_vars`` list must be
          empty AND ``user_env`` must be falsy.
        - ``internet_access_capability == "none"`` → config must not carry an
          ``internet_access`` block whose ``mode`` is non-None.
        - ``dependencies_language is None`` → config must not carry non-empty
          ``dependencies.packages``.

        ``config`` is a plain dict after validate_config (model_validate →
        model_dump). Nested shapes are dual-accessed via ``dict.get()`` /
        ``getattr()`` so callers passing pydantic instances still work.
        """
        # Lazy import to avoid circular dependency with sandbox/__init__.py.
        try:
            from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
        except ImportError:
            return
        metadata = SANDBOX_ADAPTER_METADATA.get(self.key)
        if metadata is None:
            return

        if not metadata.supports_env_vars:
            env_vars = config.get("env_vars") or []
            if env_vars:
                raise UnsupportedOperation(
                    f"{self.display_name} backend does not support user-supplied "
                    "environment variables. Remove the `env_vars` field or switch "
                    "to a backend that supports env vars."
                )
            if user_env:
                raise UnsupportedOperation(
                    f"{self.display_name} backend does not support user-supplied "
                    "environment variables. Disable env_vars for this config or "
                    "switch to a backend that supports env vars."
                )

        if metadata.internet_access_capability == "none":
            internet_access = config.get("internet_access")
            if internet_access is not None:
                mode = (
                    internet_access.get("mode")
                    if isinstance(internet_access, dict)
                    else getattr(internet_access, "mode", None)
                )
                if mode is not None:
                    raise UnsupportedOperation(
                        f"{self.display_name} backend does not support "
                        "`internet_access` configuration. Remove the field or "
                        "switch to a backend that supports it."
                    )

        if metadata.dependencies_language is None:
            deps = config.get("dependencies")
            if deps is not None:
                packages = (
                    deps.get("packages")
                    if isinstance(deps, dict)
                    else getattr(deps, "packages", None)
                ) or []
                if packages:
                    raise UnsupportedOperation(
                        f"{self.display_name} backend does not support "
                        "dependency installation. Remove `dependencies.packages` "
                        "or switch to a backend that supports dependencies."
                    )
