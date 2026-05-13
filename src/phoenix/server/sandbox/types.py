"""
Core types for the sandbox backend system.

Only depends on stdlib and pydantic (a core Phoenix dependency). Safe to
import unconditionally regardless of optional sandbox extras.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from typing import (
    Annotated,
    Any,
    Literal,
    Mapping,
    Optional,
    Type,
    Union,
    get_args,
)

from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.datastructures import Secret


class UnsupportedOperation(Exception):
    """Raised when a sandbox backend does not support a requested operation."""


# ---------------------------------------------------------------------------
# Dependency-spec grammar. npm and Python requirement strings are validated
# independently — there is intentionally no cross-conversion: a TypeScript
# sandbox takes npm syntax (`lodash@^4.17`), a Python sandbox takes pip
# syntax (`numpy==1.26.0`), and a spec in the wrong dialect is rejected with
# a hint rather than silently translated. The frontend mirrors these in
# app/src/pages/settings/sandboxes/utils.tsx; keep the two in sync.
# ---------------------------------------------------------------------------

#: One identifier segment: starts/ends alphanumeric, allows ``.``/``_``/``-``/``~`` inside.
_IDENT = r"[A-Za-z0-9](?:[A-Za-z0-9._~-]*[A-Za-z0-9])?"

#: npm package name — optional ``@scope/`` prefix, then a name segment.
_NPM_NAME = rf"(?:@{_IDENT}/)?{_IDENT}"
#: npm version selector — anything non-empty without whitespace or ``@`` (covers
#: ranges like ``^1.2.0``, ``>=6.37.0``, ``1.2.3``, dist-tags, git refs).
_NPM_VERSION = r"[^@\s]+"
#: An npm requirement: ``name`` or ``name@version`` (incl. ``@scope/name``).
_NPM_REQUIREMENT_RE = re.compile(rf"^(?:{_NPM_NAME})(?:@{_NPM_VERSION})?$")

#: PEP 508 extras list, e.g. ``[socks,brotli]``.
_PY_EXTRAS = r"(?:\[\s*[A-Za-z0-9._-]+(?:\s*,\s*[A-Za-z0-9._-]+)*\s*\])?"
#: One PEP 440 version clause, e.g. ``>=1.2``, ``==1.*``, ``~=2.0``.
_PY_VERSION_CLAUSE = r"(?:===|==|!=|~=|<=|>=|<|>)\s*[A-Za-z0-9*][A-Za-z0-9.*+!_-]*"
#: A Python requirement: ``name[extras] <clause>[, <clause>...]`` (markers/URLs
#: are intentionally out of scope for the dependency-list UI).
_PYTHON_REQUIREMENT_RE = re.compile(
    rf"^{_IDENT}\s*{_PY_EXTRAS}\s*"
    rf"(?:{_PY_VERSION_CLAUSE}(?:\s*,\s*{_PY_VERSION_CLAUSE})*)?\s*$"
)


def validate_npm_package_spec(spec: str) -> str:
    """Strip and validate a single npm install spec; raise ValueError if invalid."""
    stripped = spec.strip()
    if not stripped or not _NPM_REQUIREMENT_RE.match(stripped):
        raise ValueError(
            f"invalid npm package spec {spec!r} "
            "(expected e.g. 'lodash', 'lodash@^4.17', '@scope/pkg@1.2.3')"
        )
    return stripped


def validate_python_package_spec(spec: str) -> str:
    """Strip and validate a single Python package spec; raise ValueError if invalid."""
    stripped = spec.strip()
    if not stripped or not _PYTHON_REQUIREMENT_RE.match(stripped):
        raise ValueError(
            f"invalid Python package spec {spec!r} "
            "(expected e.g. 'requests', 'numpy==1.26.0', 'httpx[http2]>=0.27,<1')"
        )
    return stripped


def _validated_package_list(packages: list[str], validate_one: Callable[[str], str]) -> list[str]:
    """Apply a per-entry validator across a package list.

    Re-raises the first failure with the offending index so the pydantic
    ValidationError points at the bad line.
    """
    out: list[str] = []
    for i, pkg in enumerate(packages):
        try:
            out.append(validate_one(pkg))
        except ValueError as exc:
            raise ValueError(f"packages[{i}]: {exc}") from exc
    return out


# ---------------------------------------------------------------------------
# SandboxProviderFamily — closed set of provider families used as the trust
# boundary for PHOENIX_ALLOWED_SANDBOX_PROVIDERS. Adding a new provider
# family requires adding its name here AND setting `family = "..."` on the
# adapter class. Pyright/mypy will reject mismatches at type-check time.
#
# The family of an adapter is the unit at which the allowlist operates:
# all (backend_type, language) variants of a family share one allowlist
# entry. Extending an existing family with a new language is just a new
# adapter class with the same `family`; extending Phoenix with a new
# provider family adds a literal here.
# ---------------------------------------------------------------------------
SandboxProviderFamily = Literal["WASM", "E2B", "DAYTONA", "VERCEL", "DENO", "MODAL"]


SANDBOX_PROVIDER_FAMILIES: frozenset[SandboxProviderFamily] = frozenset(
    get_args(SandboxProviderFamily)
)


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

    @field_validator("packages", mode="after")
    @classmethod
    def _validate_python_specs(cls, packages: list[str]) -> list[str]:
        return _validated_package_list(packages, validate_python_package_spec)


class TypescriptDependenciesConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    packages: list[str] = Field(default_factory=list)
    lockfile: Optional[str] = None

    @field_validator("packages", mode="after")
    @classmethod
    def _validate_npm_specs(cls, packages: list[str]) -> list[str]:
        return _validated_package_list(packages, validate_npm_package_spec)


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
    is_required: bool = True


# ---------------------------------------------------------------------------
# Per-adapter pydantic config models.
# extra="forbid" rejects unknown keys at validate_config (D7 contract).
# All config fields are optional — adapters use defaults for missing keys.
# Field(title=...) drives ConfigFieldSpec.display_name derivation.
# ---------------------------------------------------------------------------


class E2BConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="Environment variables set at build time; not overridable per call.",
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
    model_config = ConfigDict(extra="forbid")

    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="Environment variables set at build time; not overridable per call.",
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


class DaytonaTypescriptConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="Environment variables set at build time; not overridable per call.",
    )
    internet_access: Optional[InternetAccessConfig] = Field(
        default=None,
        title="Internet Access",
        description="Controls whether the sandbox can reach the internet.",
    )
    dependencies: Optional[TypescriptDependenciesConfig] = Field(
        default=None,
        title="TypeScript Dependencies",
        description="npm packages to install before code execution.",
    )


class DenoConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="Environment variables set at build time; not overridable per call.",
    )
    internet_access: Optional[InternetAccessConfig] = Field(
        default=None,
        title="Internet Access",
        description="Controls whether the sandbox can reach the internet.",
    )


class _VercelConfigBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="Environment variables set at build time; not overridable per call.",
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
    model_config = ConfigDict(extra="forbid")


class ModalConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    env_vars: list[EnvVarEntry] = Field(
        default_factory=list,
        title="Environment Variables",
        description="Environment variables set at build time; not overridable per call.",
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


def compose_secret_values(
    user_env: Optional[Mapping[str, str]],
    *credentials: Optional[Secret],
) -> frozenset[str]:
    """Combine user-env plaintext values with provider credential plaintexts.

    Called by each ``SandboxBackend.__init__`` to populate ``self.secret_values``
    in a single place. Empty/None credential entries are dropped so adapters
    with partial credential sets (e.g. one missing key) don't introduce
    empty-string entries that would mask everywhere.

    Credentials are passed as ``starlette.datastructures.Secret`` and unwrapped
    via ``str()`` for the masking layer, which performs string replacement on
    emitted span attributes and exception messages and therefore needs the
    plaintext form to match against.
    """
    return frozenset((user_env or {}).values()) | frozenset(str(c) for c in credentials if c)


class SandboxBackend(ABC):
    """
    Protocol for sandbox backends.

    Surface: execute + start_session + stop_session + close.
    Session reuse is controlled by the caller-provided session_key passed to
    execute(). start_session/stop_session manage the lifecycle explicitly.

    ``secret_values`` is the union of user-env plaintexts and provider
    credential plaintexts that ``CodeEvaluatorRunner`` will mask out of
    emitted span attributes, status descriptions, and exception events.
    Subclasses populate it in ``__init__`` via ``compose_secret_values``;
    the class-level default ``frozenset()`` means a backend that takes no
    credentials and no user_env (e.g. WASM) needs no extra wiring, and
    mocks via ``MagicMock(spec=SandboxBackend)`` inherit it for free.
    """

    secret_values: frozenset[str] = frozenset()

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

    #: Provider family — the trust boundary for PHOENIX_ALLOWED_SANDBOX_PROVIDERS.
    #: All adapters that share infrastructure / SDK / credentials / isolation
    #: boundary (e.g. VercelPythonAdapter and VercelTypescriptAdapter both
    #: family="VERCEL") share an allowlist entry.
    family: SandboxProviderFamily

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

    @classmethod
    def probe_dependencies(cls) -> None:
        """Verify optional SDK dependencies are importable; raise ImportError otherwise.

        Called by ``phoenix.server.sandbox.__init__`` at registration time. Subclasses
        whose backend depends on an optional extra (wasmtime, e2b_code_interpreter,
        daytona_sdk, vercel, modal, ...) should override this to import their SDK
        and let the ImportError bubble. Adapters without optional SDK deps (e.g.
        Deno, which shells out to the ``deno`` CLI) inherit this no-op default.

        The registration block in ``phoenix.server.sandbox.__init__`` wraps the
        adapter import + ``probe_dependencies()`` + registration in a single
        ``try/except ImportError``: a failed probe results in the adapter being
        absent from ``_SANDBOX_ADAPTERS``, which the status resolver maps to
        ``status=NOT_INSTALLED`` (and surfaces the adapter's dependency hints).
        """
        return None

    @abstractmethod
    def build_backend(
        self,
        config: Mapping[str, Any],
        user_env: Optional[Mapping[str, str]] = None,
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

        user_env is a pre-resolved plaintext mapping of user-supplied environment
        variables (name → value). It is passed as a sibling argument — NOT
        merged into config — to prevent collision with PHOENIX_SANDBOX_*
        credential keys that adapters read from config.
        """
        ...

    def validate_config(
        self,
        config: Mapping[str, Any],
        stored_config: Optional[Mapping[str, Any]] = None,
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

    def _enforce_unique_env_var_names(self, config: Mapping[str, Any]) -> None:
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
        config: Mapping[str, Any],
        stored_config: Optional[Mapping[str, Any]] = None,
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

        # Runtime-install adapters install packages INSIDE the sandbox via
        # run_code, so a sandbox created with the network already denied has no
        # PyPI access and the install silently fails. Reject the combination
        # eagerly. No stored_config bypass: the combo never works, so
        # round-tripping a stored config that's already in this state should
        # also fail loudly rather than persisting a broken configuration.
        if metadata.installs_packages_at_runtime and metadata.dependencies_language is not None:
            ia_mode: Optional[str] = None
            if isinstance(internet_access, dict):
                ia_mode = internet_access.get("mode")
            elif internet_access is not None:
                ia_mode = getattr(internet_access, "mode", None)
            packages_list: list[Any] = []
            if isinstance(dependencies, dict):
                packages_list = dependencies.get("packages") or []
            elif dependencies is not None:
                packages_list = getattr(dependencies, "packages", None) or []
            if ia_mode == "deny" and packages_list:
                errors.append(
                    InitErrorDetails(
                        type=PydanticCustomError(
                            "capability_violation",
                            (
                                "{adapter} adapter installs packages inside the "
                                "sandbox at runtime, so internet_access.mode='deny' "
                                "is incompatible with non-empty "
                                "dependencies.packages: pip cannot reach PyPI from "
                                "a network-denied sandbox. Set internet_access.mode "
                                "to 'allow' or remove dependencies.packages."
                            ),
                            {"adapter": self.key},
                        ),
                        loc=("dependencies", "packages"),
                        input=packages_list,
                    )
                )

        if errors:
            raise ValidationError.from_exception_data(
                type(self).__name__,
                errors,
            )

    def _enforce_capabilities(
        self,
        config: Mapping[str, Any],
        user_env: Optional[Mapping[str, str]] = None,
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

        # Runtime-install combo guard (mirrors _enforce_capability_gates).
        # Defense-in-depth: validate_config already rejects this at write time,
        # but a misconfigured stored config reaching build_backend (e.g. via a
        # path that bypassed validate_config) must still fail loudly rather
        # than silently producing a sandbox where pip install fails.
        if metadata.installs_packages_at_runtime and metadata.dependencies_language is not None:
            internet_access = config.get("internet_access")
            ia_mode: Optional[str] = None
            if isinstance(internet_access, dict):
                ia_mode = internet_access.get("mode")
            elif internet_access is not None:
                ia_mode = getattr(internet_access, "mode", None)
            deps = config.get("dependencies")
            packages_list: list[Any] = []
            if isinstance(deps, dict):
                packages_list = deps.get("packages") or []
            elif deps is not None:
                packages_list = getattr(deps, "packages", None) or []
            if ia_mode == "deny" and packages_list:
                raise UnsupportedOperation(
                    f"{self.display_name} backend installs packages inside the "
                    "sandbox at runtime; internet_access.mode='deny' blocks pip "
                    "from reaching PyPI. Set internet_access.mode to 'allow' or "
                    "remove dependencies.packages."
                )
