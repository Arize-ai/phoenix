"""Core types for the sandbox backend system."""

from __future__ import annotations

import hashlib
import json
import re
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from typing import (
    Annotated,
    ClassVar,
    Generic,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Type,
    TypeVar,
    Union,
    get_args,
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    TypeAdapter,
    field_validator,
    model_validator,
)
from typing_extensions import TypeAlias

from phoenix.db.models import LanguageName, SandboxBackendType


class UnsupportedOperation(Exception):
    """Raised when a sandbox backend does not support a requested operation."""


# Dependency-spec grammar. Mirrored in app/src/pages/settings/sandboxes/utils.tsx.

_IDENT = r"[A-Za-z0-9](?:[A-Za-z0-9._~-]*[A-Za-z0-9])?"

_NPM_NAME = rf"(?:@{_IDENT}/)?{_IDENT}"
_NPM_VERSION = r"[^@\s]+"
_NPM_REQUIREMENT_RE = re.compile(rf"^(?:{_NPM_NAME})(?:@{_NPM_VERSION})?$")

_PY_EXTRAS = r"(?:\[\s*[A-Za-z0-9._-]+(?:\s*,\s*[A-Za-z0-9._-]+)*\s*\])?"
_PY_VERSION_CLAUSE = r"(?:===|==|!=|~=|<=|>=|<|>)\s*[A-Za-z0-9*][A-Za-z0-9.*+!_-]*"
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
    """Apply a per-entry validator across a package list; re-raise with index."""
    out: list[str] = []
    for i, pkg in enumerate(packages):
        try:
            out.append(validate_one(pkg))
        except ValueError as exc:
            raise ValueError(f"packages[{i}]: {exc}") from exc
    return out


SANDBOX_BACKEND_TYPES: frozenset[SandboxBackendType] = frozenset(get_args(SandboxBackendType))


class _BaseModel(BaseModel):
    """Project-local pydantic base: extra='forbid', frozen=True."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class EnvVarValue(_BaseModel):
    """An env-var value resolved at runtime from a secret row by key."""

    secret_key: str


class InternetAccessConfig(_BaseModel):
    mode: Literal["deny", "allow"] = "allow"


class DependenciesConfig(_BaseModel):
    """Per-language dependency list. Syntax validated at the _Config level via ``language``."""

    packages: list[str] = Field(default_factory=list)

    @field_validator("packages", mode="after")
    @classmethod
    def _strip_packages(cls, packages: list[str]) -> list[str]:
        return [pkg.strip() for pkg in packages]


class SupportsEnvVars(_BaseModel):
    """Mixin: config carries a user-supplied env_vars mapping."""

    env_vars: dict[str, EnvVarValue] = Field(
        default_factory=dict,
        title="Environment Variables",
        description="Environment variables set at build time; not overridable per call.",
    )


class SupportsInternetAccess(_BaseModel):
    """Config carries an ``internet_access`` toggle."""

    internet_access: Optional[InternetAccessConfig] = Field(
        default=None,
        title="Internet Access",
        description="Controls whether the sandbox can reach the internet.",
    )


class SupportsDependencies(_BaseModel):
    """Mixin: config carries a dependency list."""

    dependencies: Optional[DependenciesConfig] = Field(
        default=None,
        title="Dependencies",
        description="Packages to install before code execution.",
    )


class _RuntimePackageInstallation(_BaseModel):
    """Mixin: adapter installs packages inside the sandbox at runtime.

    Adapters that bake dependencies in at build time should NOT compose this.
    """

    @model_validator(mode="after")
    def _deps_require_internet(self) -> "_RuntimePackageInstallation":
        deps = getattr(self, "dependencies", None)
        ia = getattr(self, "internet_access", None)
        if deps is not None and deps.packages and ia is not None and ia.mode == "deny":
            raise ValueError(
                "Runtime package installation requires network access; "
                "internet_access.mode='deny' is incompatible with non-empty "
                "dependencies.packages. Set internet_access.mode to 'allow' "
                "or remove dependencies.packages."
            )
        return self


class _Config(_BaseModel):
    """Base for every per-adapter Config model."""

    @model_validator(mode="after")
    def _validate_package_syntax(self) -> "_Config":
        deps = getattr(self, "dependencies", None)
        if deps is None or not deps.packages:
            return self
        # ``language`` is declared per subclass (Literal narrowing) — read via getattr.
        language = getattr(self, "language", None)
        if language == "PYTHON":
            validate_one = validate_python_package_spec
        elif language == "TYPESCRIPT":
            validate_one = validate_npm_package_spec
        else:
            return self
        _validated_package_list(deps.packages, validate_one)
        return self


class E2BConfig(
    _Config,
    SupportsEnvVars,
    SupportsInternetAccess,
    SupportsDependencies,
    _RuntimePackageInstallation,
):
    backend_type: Literal["E2B"] = "E2B"
    language: Literal["PYTHON"] = "PYTHON"


class DaytonaConfig(
    _Config,
    SupportsEnvVars,
    SupportsInternetAccess,
    SupportsDependencies,
    _RuntimePackageInstallation,
):
    backend_type: Literal["DAYTONA"] = "DAYTONA"
    language: Literal["PYTHON", "TYPESCRIPT"]


class DenoConfig(_Config):
    # Does NOT compose SupportsEnvVars: no user env vars ever reach the subprocess.
    backend_type: Literal["DENO"] = "DENO"
    language: Literal["TYPESCRIPT"] = "TYPESCRIPT"


class VercelConfig(
    _Config,
    SupportsEnvVars,
    SupportsInternetAccess,
    SupportsDependencies,
    _RuntimePackageInstallation,
):
    backend_type: Literal["VERCEL"] = "VERCEL"
    language: Literal["PYTHON", "TYPESCRIPT"]


class WASMConfig(_Config):
    backend_type: Literal["WASM"] = "WASM"
    language: Literal["PYTHON"] = "PYTHON"


class MontyConfig(_Config):
    backend_type: Literal["MONTY"] = "MONTY"
    language: Literal["PYTHON"] = "PYTHON"


class ModalConfig(
    _Config,
    SupportsEnvVars,
    SupportsInternetAccess,
    SupportsDependencies,
):
    # Modal bakes deps into the Image at build time; do not compose _RuntimePackageInstallation.
    backend_type: Literal["MODAL"] = "MODAL"
    language: Literal["PYTHON"] = "PYTHON"


SandboxConfigModel: TypeAlias = Annotated[
    Union[
        E2BConfig,
        DaytonaConfig,
        DenoConfig,
        VercelConfig,
        WASMConfig,
        MontyConfig,
        ModalConfig,
    ],
    Field(discriminator="backend_type"),
]

SANDBOX_CONFIG_ADAPTER: TypeAdapter[SandboxConfigModel] = TypeAdapter(SandboxConfigModel)


_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def _validate_url_scheme(value: Optional[str]) -> Optional[str]:
    """Reject any scheme other than https or http://localhost (SSRF guard)."""
    if value is None or value == "":
        return value
    from urllib.parse import urlparse

    parsed = urlparse(value)
    if parsed.scheme not in ("https", "http"):
        raise ValueError(
            f"URL scheme must be https:// or http:// (got {parsed.scheme!r}); "
            f"reject schemes such as file://, gopher://, javascript: that would enable SSRF."
        )
    if parsed.scheme == "http" and (parsed.hostname or "") not in _LOCAL_HOSTS:
        raise ValueError(
            f"http:// is only permitted for localhost; got host {parsed.hostname!r}. "
            "Use https:// for non-local Daytona / E2B deployments."
        )
    return value


class NoDeployment(_BaseModel):
    """Sentinel: this adapter exposes no deployment routing (e.g. WASM, Deno)."""


class DaytonaDeployment(_BaseModel):
    """Daytona on-prem routing."""

    backend_type: Literal["DAYTONA"] = "DAYTONA"
    api_url: Optional[str] = Field(
        default=None,
        title="Daytona API URL",
        description=(
            "Daytona API endpoint URL for on-prem deployments. Leave empty to fall back "
            "to the ``DAYTONA_API_URL`` process env var, or Daytona's hosted SaaS "
            "(https://app.daytona.io/api) if unset."
        ),
    )
    target: Optional[str] = Field(
        default=None,
        title="Daytona Target",
        description=(
            "Daytona runner target region. Leave empty to fall back to the "
            "``DAYTONA_TARGET`` process env var, or the organization's default if unset."
        ),
    )

    @field_validator("api_url", mode="after")
    @classmethod
    def _check_api_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_url_scheme(v)


class E2BDeployment(_BaseModel):
    """E2B enterprise routing."""

    backend_type: Literal["E2B"] = "E2B"
    domain: Optional[str] = Field(
        default=None,
        title="E2B Domain",
        description=(
            "E2B API domain for enterprise deployments. Leave empty to fall back to the "
            "``E2B_DOMAIN`` process env var, or E2B's hosted SaaS (``e2b.app``) if unset."
        ),
    )
    api_url: Optional[str] = Field(
        default=None,
        title="E2B API URL",
        description=(
            "Full E2B API URL override. Mutually exclusive with ``domain``; prefer ``domain`` "
            "unless you need to override the full URL. Leave empty to fall back to the "
            "``E2B_API_URL`` process env var."
        ),
    )

    @field_validator("api_url", mode="after")
    @classmethod
    def _check_api_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_url_scheme(v)

    @model_validator(mode="after")
    def _domain_xor_api_url(self) -> "E2BDeployment":
        # SDK precedence between domain and api_url is undocumented.
        if self.domain is not None and self.api_url is not None:
            raise ValueError(
                "E2BDeployment: 'domain' and 'api_url' are mutually exclusive — "
                "set one of them, not both. Prefer 'domain' unless you need to "
                "override the full URL."
            )
        return self


class VercelDeployment(NoDeployment):
    """Vercel has no public routing kwargs on AsyncSandbox.create today."""

    backend_type: Literal["VERCEL"] = "VERCEL"


class ModalDeployment(NoDeployment):
    """No routing kwargs; self-hosted Modal routes via MODAL_SERVER_URL env var."""

    backend_type: Literal["MODAL"] = "MODAL"


class WASMDeployment(NoDeployment):
    """WASM runs in-process; no deployment routing applies."""

    backend_type: Literal["WASM"] = "WASM"


class DenoDeployment(NoDeployment):
    """Deno runs as a local subprocess; no deployment routing applies."""

    backend_type: Literal["DENO"] = "DENO"


class MontyDeployment(NoDeployment):
    """Monty runs in-process; no deployment routing applies."""

    backend_type: Literal["MONTY"] = "MONTY"


SandboxDeploymentModel: TypeAlias = Annotated[
    Union[
        DaytonaDeployment,
        E2BDeployment,
        VercelDeployment,
        ModalDeployment,
        WASMDeployment,
        DenoDeployment,
        MontyDeployment,
    ],
    Field(discriminator="backend_type"),
]

SANDBOX_DEPLOYMENT_ADAPTER: TypeAdapter[SandboxDeploymentModel] = TypeAdapter(
    SandboxDeploymentModel
)


class NoCredentials(_BaseModel):
    """Sentinel: this adapter takes no provider credentials (e.g. WASM, Deno)."""


class E2BCredentials(_BaseModel):
    E2B_API_KEY: SecretStr = Field(
        title="E2B API Key",
        description="API key for the E2B sandbox service.",
    )


class DaytonaCredentials(_BaseModel):
    DAYTONA_API_KEY: SecretStr = Field(
        title="Daytona API Key",
        description="API key for the Daytona sandbox service.",
    )


class VercelCredentials(_BaseModel):
    VERCEL_TOKEN: SecretStr = Field(
        title="Vercel Access Token",
        description=(
            "Vercel access token. "
            "See https://vercel.com/docs/vercel-sandbox/concepts/authentication"
        ),
    )
    VERCEL_PROJECT_ID: SecretStr = Field(
        title="Vercel Project ID",
        description="Vercel project identifier.",
    )
    VERCEL_TEAM_ID: SecretStr = Field(
        title="Vercel Team ID",
        description="Vercel team identifier.",
    )


class ModalCredentials(_BaseModel):
    MODAL_TOKEN_ID: SecretStr = Field(
        title="Modal Token ID",
        description="Modal authentication token ID.",
    )
    MODAL_TOKEN_SECRET: SecretStr = Field(
        title="Modal Token Secret",
        description="Modal authentication token secret.",
    )


@dataclass(frozen=True)
class ProviderCredentialSpec:
    """GraphQL-facing credential spec, derived from a credentials model field."""

    key: str
    display_name: str
    description: str = ""
    is_required: bool = True


def credential_specs_from(model: Type[BaseModel]) -> list[ProviderCredentialSpec]:
    """Derive ProviderCredentialSpec list from a credentials model's fields."""
    specs: list[ProviderCredentialSpec] = []
    for name, info in model.model_fields.items():
        specs.append(
            ProviderCredentialSpec(
                key=name,
                display_name=info.title or name,
                description=info.description or "",
                is_required=info.is_required(),
            )
        )
    return specs


# ANSI CSI escape sequences.
_ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


@dataclass
class ExecutionResult:
    """Sandbox execution result; stdout/stderr/error are ANSI-stripped on construction."""

    stdout: str
    stderr: str
    error: Optional[str] = None

    def __post_init__(self) -> None:
        self.stdout = _ANSI_ESCAPE_RE.sub("", self.stdout)
        self.stderr = _ANSI_ESCAPE_RE.sub("", self.stderr)
        if self.error is not None:
            self.error = _ANSI_ESCAPE_RE.sub("", self.error)

    @property
    def success(self) -> bool:
        return self.error is None


def compose_secret_values(
    user_env: Optional[Mapping[str, str]],
    *credentials: Optional[SecretStr],
) -> frozenset[str]:
    """Combine user-env plaintext values with provider credential plaintexts."""
    values: set[str] = set((user_env or {}).values())
    for cred in credentials:
        if cred is None:
            continue
        plaintext = cred.get_secret_value()
        if plaintext:
            values.add(plaintext)
    return frozenset(values)


#: Sentinel handle returned by ``BaseNoSessionBackend.find_or_create_session``.
#: Kept as an opaque object (not ``None``) so accidental dereferencing is
#: visible in logs.
_NO_SESSION_HANDLE: object = object()


class SandboxBackend(ABC):
    """Protocol for sandbox backends."""

    # Union of user-env and provider-credential plaintexts; CodeEvaluatorRunner
    # masks these from emitted span attributes and exception events.
    secret_values: frozenset[str] = frozenset()

    #: SandboxBackendType token ("MODAL", "E2B", ...) for per-provider
    #: capacity accounting. Empty for stateless backends.
    provider: ClassVar[str] = ""

    @abstractmethod
    async def find_or_create_session(self, session_key: str) -> object:
        """Return an opaque, live remote handle for ``session_key``.

        Must return a usable session — either an existing live one or a
        freshly-created one. Adapters MUST re-validate cached/listed handles
        before returning; ``rebind_handle`` relies on that self-validation.

        Two replicas with the same key converge on the same remote sandbox
        where the provider supports it (Modal: by name; E2B/Daytona: by
        metadata-list). Vercel does not; the manager partitions long-lived
        keys by ``replica_id`` to compensate.

        The returned value is passed back to ``execute_in_session`` unchanged.
        """
        ...

    @abstractmethod
    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Execute ``code`` against the opaque ``handle`` returned by
        ``find_or_create_session``. The handle is provider-specific and
        opaque to the manager."""
        ...

    @abstractmethod
    async def close_session(self, session_key: str) -> None:
        """Tear down the remote session bound to ``session_key`` (idempotent)."""
        ...

    @abstractmethod
    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Execute code in the sandbox session. No per-call env override."""
        ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    def config_fingerprint(self) -> str:
        """Stable short digest of the config fields that affect the remote runtime.

        Same fingerprint across replicas/runs for structurally-equal configs.
        Must NOT change on secret-value rotation (only on env-var key-set
        changes). The manager composes ``f"{session_key}#{fingerprint}"`` so
        a mid-iteration config change fragments into a fresh session.

        Stateless adapters return ``""``.
        """
        ...

    def provider_session_id(self, session_key: str) -> str:
        """Map an opaque ``session_key`` to the provider-side identifier.

        Deterministic across processes. Override only when the provider has
        char-class or length restrictions (e.g. Modal sandbox names).
        """
        return session_key

    def is_session_gone(self, exc: BaseException) -> bool:
        """``True`` if ``exc`` means the remote session is gone and a rebind
        would recover; ``False`` otherwise.

        Default returns ``False``. Session-capable backends override with
        per-SDK classification; classifiers should under-classify (a false
        ``True`` triggers an unnecessary rebind).
        """
        del exc
        return False


class BaseNoSessionBackend(SandboxBackend):
    """Stateless sandbox backends; no-op session lifecycle (the manager
    treats every call as a fresh remote execution)."""

    async def find_or_create_session(self, session_key: str) -> object:
        return _NO_SESSION_HANDLE

    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        return await self.execute(code, session_key="", timeout=timeout)

    async def close_session(self, session_key: str) -> None:
        return None

    def config_fingerprint(self) -> str:
        return ""


def compute_config_fingerprint(
    *,
    backend_type: str,
    packages: Sequence[str] = (),
    internet_access_mode: Optional[str] = None,
    language: Optional["LanguageName"] = None,
) -> str:
    """16-char sha256 prefix over the config subset that affects the remote runtime.

    Env vars (keys and values) are intentionally excluded: every backend
    injects user env per-call, so env changes don't invalidate the sandbox.
    Including them would over-fragment sessions on benign edits.
    """
    payload = {
        "backend_type": backend_type,
        "packages": sorted(str(p) for p in packages),
        "internet_access_mode": internet_access_mode,
        "language": language,
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


ConfigT = TypeVar("ConfigT", bound=_Config)
CredT = TypeVar("CredT", bound=BaseModel)
DeployT = TypeVar("DeployT", bound=BaseModel)


class SandboxAdapter(Generic[ConfigT, CredT, DeployT], ABC):
    """Abstract base class for sandbox adapters."""

    backend_type: ClassVar[SandboxBackendType]
    display_name: ClassVar[str]
    hosting_type: ClassVar[Literal["local", "hosted"]]
    dependency_hints: ClassVar[Sequence[str]] = ()
    language_dialect: ClassVar[Literal["full", "restricted"]] = "full"
    runtime_notes: ClassVar[str] = "Full language runtime."
    credentials_model: ClassVar[Type[BaseModel]] = NoCredentials
    deployment_config_model: ClassVar[Type[BaseModel]] = NoDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        """Verify optional SDK dependencies; raise ImportError otherwise."""
        return None

    @classmethod
    def credential_specs(cls) -> list[ProviderCredentialSpec]:
        return credential_specs_from(cls.credentials_model)

    def validate_code(self, config: ConfigT, code: str) -> Optional[str]:
        """Return an authoring-time validation error for code, if any."""
        return None

    # ClassVar[Type[ConfigT]] would conflict with TypeVar; use instance attr hint.
    config_model: Type[ConfigT]

    @abstractmethod
    def build_backend(
        self,
        config: ConfigT,
        *,
        credentials: CredT,
        deployment: DeployT,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        """Construct a SandboxBackend from typed config + credentials + deployment."""
        ...
