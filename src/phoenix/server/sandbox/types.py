"""
Core types for the sandbox backend system.

Depends only on stdlib, pydantic, and core Phoenix DB type aliases. Safe to
import unconditionally regardless of optional sandbox SDK extras.
"""

from __future__ import annotations

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

from phoenix.db.models import SandboxBackendType


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


SANDBOX_BACKEND_TYPES: frozenset[SandboxBackendType] = frozenset(get_args(SandboxBackendType))


# ---------------------------------------------------------------------------
# Shared config building blocks — env vars, internet access, dependencies.
# ---------------------------------------------------------------------------


class _BaseModel(BaseModel):
    """Project-local pydantic base.

    Centralizes the ``extra='forbid' + frozen=True`` config so every Config,
    Credentials, Deployment, and capability-mixin model in this file shares
    one source of truth: unknown keys are rejected, and instances are
    immutable post-validation. Subclasses inherit the config via MRO; they
    can still override individual keys when they need to.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)


class EnvVarValue(_BaseModel):
    """An env-var value resolved at runtime from a secret row by key."""

    secret_key: str


class InternetAccessConfig(_BaseModel):
    mode: Literal["deny", "allow"] = "allow"


class DependenciesConfig(_BaseModel):
    """Per-language dependency list.

    Pure data container: per-package syntax (pip vs. npm) is validated at the
    parent ``_Config`` level using its ``language`` field, so this model itself
    needs no external context. That keeps ``SandboxConfig.config`` JSON
    self-sufficient for re-hydration via ``model_validate`` without any
    extra ``language`` argument.

    Generic, language-agnostic cleanup (whitespace trimming) lives on the
    ``packages`` field itself so it applies uniformly regardless of how the
    model was constructed — raw JSON, a nested pydantic submodel handed up
    from the GraphQL ``to_orm`` path, a stored DB row, or a unit test.
    """

    packages: list[str] = Field(default_factory=list)

    @field_validator("packages", mode="after")
    @classmethod
    def _strip_packages(cls, packages: list[str]) -> list[str]:
        return [pkg.strip() for pkg in packages]


# ---------------------------------------------------------------------------
# Capability mixins. A per-adapter Config model composes from these to declare
# which capabilities it exposes. Capability gates dispatch via
# isinstance(config, _SupportsX) — model membership IS the structural signal.
# ---------------------------------------------------------------------------


class SupportsEnvVars(_BaseModel):
    """Mixin: config carries a user-supplied env_vars mapping.

    Keyed by env-var name; name uniqueness is structural (no validator needed).
    """

    env_vars: dict[str, EnvVarValue] = Field(
        default_factory=dict,
        title="Environment Variables",
        description="Environment variables set at build time; not overridable per call.",
    )


class SupportsInternetAccess(_BaseModel):
    """Mixin: config carries an internet_access toggle."""

    internet_access: Optional[InternetAccessConfig] = Field(
        default=None,
        title="Internet Access",
        description="Controls whether the sandbox can reach the internet.",
    )


class SupportsDependencies(_BaseModel):
    """Mixin: config carries a dependency list.

    The per-package syntax (pip vs. npm) is selected by the concrete config's
    ``language`` field in ``_Config._validate_package_syntax``.
    """

    dependencies: Optional[DependenciesConfig] = Field(
        default=None,
        title="Dependencies",
        description="Packages to install before code execution.",
    )


class _RuntimePackageInstallation(_BaseModel):
    """Mixin: the adapter installs packages inside the sandbox at runtime.

    Cross-field validator: when packages are present and
    ``internet_access.mode='deny'``, the install would have no network. Reject
    at validate time rather than at execute time.

    Adapters that bake dependencies in at build time (e.g. Modal Image builds
    on the orchestrator's network, not the sandbox's) should NOT compose this.
    Mixin presence IS the "installs packages at runtime" signal — no separate
    metadata flag is needed.
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


# ---------------------------------------------------------------------------
# Per-adapter Config models. Composed from the capability mixins above so the
# structural signal is "this config IS-A _SupportsX" rather than "this config
# happens to define a field named X". Adapters that install packages inside
# the sandbox at runtime additionally compose ``_RuntimePackageInstallation``
# so the deny+packages cross-field invariant is enforced by pydantic.
#
# Every per-adapter Config inherits from ``_Config``. The base carries the
# row-immutable ``language`` field and a model_validator that enforces
# per-language package syntax (pip vs npm) against any ``dependencies``
# capability the subclass may compose. Subclasses also pin ``kind`` to their
# specific ``Literal``. Both ``kind`` and ``language`` are real pydantic
# fields, so they serialize into the JSON config blob — together they make
# the blob self-sufficient for re-hydration via ``model_validate`` (no
# external context required) and let pydantic dispatch on ``kind`` for the
# discriminated-union pattern. ``language`` duplicates the row-column but is
# immutable (writes set both consistently) so the two can't drift.
# ---------------------------------------------------------------------------


class _Config(_BaseModel):
    """Base for every per-adapter Config model.

    Carries the per-language package-syntax validator. Subclasses declare
    ``kind`` and ``language`` as their own ``Literal`` fields — narrowing
    ``language`` to the set the adapter actually supports lets pydantic reject
    unsupported languages at parse time, so no runtime ``supported_languages``
    check is needed.
    """

    @model_validator(mode="after")
    def _validate_package_syntax(self) -> "_Config":
        """Syntax-check each ``dependencies.packages`` entry against the
        config's ``language``.

        Runs as an after-validator so it sees the fully constructed model
        regardless of how the input arrived — raw JSON, GraphQL ``to_orm``
        handing up an already-constructed ``DependenciesConfig`` submodel, a
        stored DB row, or a unit test. Generic whitespace trimming has
        already been applied by ``DependenciesConfig._strip_packages``; this
        validator only enforces the language-specific (pip vs. npm) grammar.
        """
        deps = getattr(self, "dependencies", None)
        if deps is None or not deps.packages:
            return self
        # ``language`` is declared on each concrete subclass (with a
        # ``Literal`` narrowing the supported set) rather than on this base —
        # see the comment block above. Read it via ``getattr`` to stay
        # type-checkable on the base.
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
    # Deno runs untrusted TypeScript locally; we deliberately do not compose
    # SupportsEnvVars so no user-supplied env vars can ever reach the
    # subprocess. The adapter metadata's ``supports_env_vars`` derives from the
    # mixin, so this also hides env-var UI in the frontend.
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


class ModalConfig(
    _Config,
    SupportsEnvVars,
    SupportsInternetAccess,
    SupportsDependencies,
):
    # Modal bakes deps into the Image at build time, not at runtime; do not
    # compose ``_RuntimePackageInstallation``.
    backend_type: Literal["MODAL"] = "MODAL"
    language: Literal["PYTHON"] = "PYTHON"


# ---------------------------------------------------------------------------
# Discriminated union over all per-adapter Config models, tagged by ``kind``.
# Lets callers (read path, migrations, tests) parse a stored ``SandboxConfig.config``
# JSON blob without knowing which concrete subclass to pick — pydantic dispatches
# on the ``kind`` field and returns the right typed instance.
# ---------------------------------------------------------------------------


SandboxConfigModel: TypeAlias = Annotated[
    Union[
        E2BConfig,
        DaytonaConfig,
        DenoConfig,
        VercelConfig,
        WASMConfig,
        ModalConfig,
    ],
    Field(discriminator="backend_type"),
]

#: Pydantic adapter for parsing a stored ``SandboxConfig.config`` JSON blob
#: into the right concrete Config subclass by discriminating on ``kind``.
#:
#: Callers reading rows that pre-date the in-blob ``kind`` / ``language``
#: fields should merge those columns into the dict before calling
#: ``validate_python`` — the row columns are the storage-layer source of truth.
SANDBOX_CONFIG_ADAPTER: TypeAdapter[SandboxConfigModel] = TypeAdapter(SandboxConfigModel)


# ---------------------------------------------------------------------------
# Per-adapter Deployment models. Admin-scoped, singleton-per-kind (same scope
# as credentials). Validated against ``sandbox_providers.config`` JSON. URL
# fields run through a scheme validator to defeat the env-reader SSRF vector
# that the SDKs would otherwise activate when Phoenix doesn't pass an explicit
# kwarg.
# ---------------------------------------------------------------------------


_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def _validate_url_scheme(value: Optional[str]) -> Optional[str]:
    """Reject any scheme other than ``https`` or ``http://localhost``.

    Cheap SSRF guard. Stops ``file://``, ``javascript:``, gopher://, etc. and
    keeps plain ``http://`` off the public-Internet path. Plain http to
    localhost stays allowed for dev installs that point at a local Daytona OSS.
    """
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
    """Daytona on-prem routing.

    When a field is left empty, the Daytona SDK reads the corresponding
    process env var (``DAYTONA_API_URL`` / ``DAYTONA_SERVER_URL`` /
    ``DAYTONA_TARGET``) and falls back to its hosted SaaS default
    (``https://app.daytona.io/api``) if unset.
    """

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
    """E2B enterprise routing.

    When a field is left empty, the E2B SDK reads the corresponding
    process env var (``E2B_DOMAIN`` / ``E2B_API_URL``) and falls back to
    its hosted SaaS default (``e2b.app``) if unset.
    """

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
        # The two fields target overlapping SDK kwargs and the E2B SDK's
        # precedence between them is undocumented — reject the combination
        # at validate-time rather than forwarding both and hoping.
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
    """Modal's public Client.from_credentials() does not expose a server_url kwarg.

    Self-hosted Modal deployments are routed via ``MODAL_SERVER_URL`` in the
    Phoenix process env, which the Modal SDK reads natively. Phoenix does not
    author that env var.
    """

    backend_type: Literal["MODAL"] = "MODAL"


class WASMDeployment(NoDeployment):
    """WASM runs in-process; no deployment routing applies."""

    backend_type: Literal["WASM"] = "WASM"


class DenoDeployment(NoDeployment):
    """Deno runs as a local subprocess; no deployment routing applies."""

    backend_type: Literal["DENO"] = "DENO"


# ---------------------------------------------------------------------------
# Discriminated union over every concrete deployment model. Mirrors the
# ``SandboxConfigModel`` pattern — one union member per provider kind. The
# four NoDeployment-style providers (WASM, Deno, Vercel, Modal) join the
# union via their own ``kind`` Literal even though they carry no routing
# fields, so the read path can dispatch on ``kind`` uniformly without a
# special-case short-circuit. The discriminator key is written into the
# stored ``SandboxProvider.config`` JSON blob alongside the row's own
# ``kind`` column, so the read path can re-hydrate the right concrete
# subclass via pydantic without a separate ``kind`` argument.
#
# ``NoDeployment`` itself stays as the test-stub / adapter-base default
# (see ``SandboxAdapter.deployment_config_model``) — it has no ``kind``
# discriminator so it is intentionally not a union member.
# ---------------------------------------------------------------------------


SandboxDeploymentModel: TypeAlias = Annotated[
    Union[
        DaytonaDeployment,
        E2BDeployment,
        VercelDeployment,
        ModalDeployment,
        WASMDeployment,
        DenoDeployment,
    ],
    Field(discriminator="backend_type"),
]

#: Pydantic adapter for parsing a stored ``SandboxProvider.config`` JSON
#: blob into the right concrete Deployment subclass by discriminating on
#: ``kind``. Used by the GraphQL read path; the per-adapter write path
#: continues to use the typed ``deployment_config_model`` directly since
#: it already knows the kind.
SANDBOX_DEPLOYMENT_ADAPTER: TypeAdapter[SandboxDeploymentModel] = TypeAdapter(
    SandboxDeploymentModel
)


# ---------------------------------------------------------------------------
# Per-adapter Credentials models. Field names equal credential keys exactly,
# so a resolved credential dict validates without renaming. Title / description
# come from pydantic FieldInfo and feed ProviderCredentialSpec for the GraphQL
# layer (see ``credential_specs_from``).
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# ProviderCredentialSpec — GraphQL surface for "what credentials does this
# adapter need?". Derived from ``credentials_model.model_fields`` instead of
# being declared in parallel (one source of truth).
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProviderCredentialSpec:
    """GraphQL-facing credential spec, derived from a credentials model field."""

    key: str
    display_name: str
    description: str = ""
    is_required: bool = True


def credential_specs_from(model: Type[BaseModel]) -> list[ProviderCredentialSpec]:
    """Derive ProviderCredentialSpec list from a credentials model's fields.

    Field title / description / is_required come from pydantic FieldInfo, so the
    credentials model is the single source of truth — adding a credential is one
    pydantic field, not two declarations.
    """
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


# ---------------------------------------------------------------------------
# ExecutionResult + SandboxBackend protocol.
# ---------------------------------------------------------------------------


# Matches ANSI CSI escape sequences (e.g. color codes from tput / chalk).
_ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


@dataclass
class ExecutionResult:
    """Result returned by a sandbox execution.

    ``stdout``, ``stderr``, and ``error`` are ANSI-stripped on construction so
    callers never have to handle escape codes from backends.
    """

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
    """Combine user-env plaintext values with provider credential plaintexts.

    Called by each ``SandboxBackend.__init__`` to populate ``self.secret_values``
    in a single place. Credentials are unwrapped to plaintext for the span
    masking layer. Empty credentials are dropped so a backend with a partial
    credential set doesn't introduce empty-string entries that would mask
    everywhere.
    """
    values: set[str] = set((user_env or {}).values())
    for cred in credentials:
        if cred is None:
            continue
        plaintext = cred.get_secret_value()
        if plaintext:
            values.add(plaintext)
    return frozenset(values)


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
    Mixin for stateless sandbox backends (e.g. WASM, Deno).

    Provides no-op start_session and stop_session implementations.
    Subclasses only need to implement execute() and close().
    """

    async def start_session(self, session_key: str) -> None:
        pass

    async def stop_session(self, session_key: str) -> None:
        pass


# ---------------------------------------------------------------------------
# SandboxAdapter — generic over config and credentials pydantic models.
#
# Each concrete adapter parameterizes the base over its own Config and
# Credentials models. Past validation, internal code operates on typed
# instances; the dict-typed boundary lives only at I/O edges (GraphQL JSON
# input, DB JSON storage, env-var resolution).
# ---------------------------------------------------------------------------


ConfigT = TypeVar("ConfigT", bound=_Config)
CredT = TypeVar("CredT", bound=BaseModel)
DeployT = TypeVar("DeployT", bound=BaseModel)


class SandboxAdapter(Generic[ConfigT, CredT, DeployT], ABC):
    """
    Abstract base class for sandbox adapters.

    Parameterized over a config pydantic model and a credentials pydantic
    model. One adapter registers per :attr:`kind`; multi-language adapters
    use the concrete config model's ``language`` field to route execution.
    """

    #: Canonical provider kind (matches ``sandbox_providers.backend_type`` and dict keys).
    backend_type: ClassVar[SandboxBackendType]

    #: Human-readable name for display in the UI.
    display_name: ClassVar[str]

    #: Where the sandbox's code execution physically happens. Not derivable
    #: from ``config_model`` structure — declared per-adapter and reflected
    #: into ``AdapterMetadata.hosting_type`` for the GraphQL surface.
    hosting_type: ClassVar[Literal["local", "hosted"]]

    #: Human-readable install / setup hints surfaced in the UI when the
    #: adapter is in NOT_INSTALLED / MISSING_CREDENTIALS state. Not derivable.
    dependency_hints: ClassVar[Sequence[str]] = ()

    #: Typed pydantic model used to validate resolved provider credentials.
    #: Subclasses override at class level (e.g. ``credentials_model = E2BCredentials``).
    #: Defaults to ``NoCredentials`` (WASM, Deno).
    credentials_model: ClassVar[Type[BaseModel]] = NoCredentials

    #: Typed pydantic model used to validate ``SandboxProvider.config`` —
    #: admin-scoped, singleton-per-kind deployment routing (e.g. Daytona
    #: ``api_url`` / ``target`` for on-prem). Defaults to ``NoDeployment``
    #: for adapters that expose no routing.
    deployment_config_model: ClassVar[Type[BaseModel]] = NoDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        """Verify optional SDK dependencies are importable; raise ImportError otherwise.

        Called by ``phoenix.server.sandbox.__init__`` at registration time. Subclasses
        whose backend depends on an optional extra (wasmtime, e2b_code_interpreter,
        daytona_sdk, vercel, modal, ...) should override this to import their SDK
        and let the ImportError bubble.
        """
        return None

    @classmethod
    def credential_specs(cls) -> list[ProviderCredentialSpec]:
        """Derive credential specs from this adapter's credentials_model fields."""
        return credential_specs_from(cls.credentials_model)

    #: Pydantic model class for validating ``SandboxConfig.config``. Single
    #: class per adapter — the per-language pip-vs-npm dependency check is
    #: driven by the Config's own ``language`` field, not by selecting a
    #: different class. Each subclass narrows ``language`` to a ``Literal``
    #: matching the adapter's supported set, so pydantic rejects unsupported
    #: languages at ``model_validate`` time (no runtime supported-set check
    #: needed).
    #:
    #: Why not ``ClassVar[Type[ConfigT]]`` like ``credentials_model`` /
    #: ``deployment_config_model`` above: pyright rejects ``ClassVar`` whose
    #: type includes a TypeVar (the TypeVar binds per-subclass via the
    #: ``SandboxAdapter[ConfigT, CredT, DeployT]`` parameterization, which
    #: conflicts with ``ClassVar``'s "same for every instance" semantics).
    #: Subclasses still assign at class scope (``config_model = WASMConfig``),
    #: which works at runtime; the annotation is just an instance attribute
    #: hint instead.
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
        """Construct and return a SandboxBackend from typed config + credentials + deployment.

        All three model arguments are pre-validated pydantic instances; the
        adapter reaches for typed attributes directly (e.g. ``config.env_vars``,
        ``config.language``, ``credentials.E2B_API_KEY.get_secret_value()``,
        ``deployment.api_url``). No dict introspection.

        ``user_env`` is a resolved plaintext mapping (name → value), passed as a
        sibling argument — never merged into config — so it cannot collide with
        provider credential keys.
        """
        ...
