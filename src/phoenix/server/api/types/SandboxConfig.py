"""
GQL types for sandbox backend configuration.

Exposes SandboxProvider (one row per canonical ``kind``) and SandboxConfig
(named configuration that CodeEvaluators point to). SandboxBackendInfo
summarises all known backends including install status.
"""

from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Optional, Union

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.context import Context
from phoenix.server.sandbox import (
    SANDBOX_ADAPTER_METADATA,
    MissingSecretError,
    SecretsContext,
    probe_sandbox_backend_buildable,
)
from phoenix.server.sandbox.types import (
    SANDBOX_CONFIG_ADAPTER,
    SANDBOX_DEPLOYMENT_ADAPTER,
    DaytonaDeployment,
    E2BDeployment,
    EnvVarLiteral,
    SupportsDependencies,
    SupportsEnvVars,
    SupportsInternetAccess,
    UnsupportedOperation,
)

logger = logging.getLogger(__name__)


@strawberry.type
class SandboxProviderCredentialSpec:
    """GQL mirror of ProviderCredentialSpec."""

    key: str
    display_name: str
    description: str
    is_required: bool


@strawberry.enum
class Language(Enum):
    """Execution language for a code evaluator or sandbox provider."""

    PYTHON = "PYTHON"
    TYPESCRIPT = "TYPESCRIPT"

    def to_orm(self) -> models.LanguageName:
        return self.value


@strawberry.enum
class SandboxBackendType(Enum):
    """Canonical kind of a sandbox provider. Mirrors `models.SandboxBackendType`."""

    WASM = "WASM"
    E2B = "E2B"
    DAYTONA = "DAYTONA"
    VERCEL = "VERCEL"
    DENO = "DENO"
    MODAL = "MODAL"


@strawberry.enum
class SandboxBackendStatus(Enum):
    """Runtime availability of a sandbox backend."""

    AVAILABLE = "AVAILABLE"
    """Adapter is installed and the backend was created successfully."""
    MISSING_CREDENTIALS = "MISSING_CREDENTIALS"
    """Adapter is installed, but required auth credentials are not configured."""
    UNAVAILABLE = "UNAVAILABLE"
    """Adapter is installed but backend creation failed (e.g. bad credentials)."""
    NOT_INSTALLED = "NOT_INSTALLED"
    """Optional dependency for this backend is not installed."""


@strawberry.enum
class InternetAccessMode(Enum):
    """Describes an *adapter's* internet-access capability (read-only)."""

    NONE = "none"
    BOOLEAN = "boolean"
    ALLOWLIST = "allowlist"


@strawberry.enum
class InternetAccessChoice(Enum):
    """User-facing internet access selection on a stored sandbox config."""

    ALLOW = "allow"
    DENY = "deny"


@strawberry.type
class SandboxConfigEnvVarLiteral:
    literal: str


@strawberry.type
class SandboxConfigEnvVarSecretRef:
    secret_key: str


SandboxConfigEnvVarValue = Annotated[
    Union[SandboxConfigEnvVarLiteral, SandboxConfigEnvVarSecretRef],
    strawberry.union(
        "SandboxConfigEnvVarValue",
        description=(
            "An env-var's value. Either a literal string or a reference to a Secret row by key."
        ),
    ),
]


@strawberry.type
class SandboxConfigEnvVar:
    name: str
    value: SandboxConfigEnvVarValue


@strawberry.type
class SandboxConfigInternetAccess:
    mode: InternetAccessChoice


@strawberry.type
class SandboxConfigDependencies:
    packages: list[str]


@strawberry.type
class SandboxConfigData:
    """Typed view of a stored sandbox config's per-capability fields.

    Capability presence is **not** encoded here — readers correlate with
    ``SandboxBackendInfo`` (via ``provider.backend_type``) to know which capabilities
    the adapter actually supports. An empty ``env_vars`` list / ``None`` for
    ``internet_access`` or ``dependencies`` can mean either "supported but
    unset" or "unsupported"; the backend info disambiguates.
    """

    env_vars: list[SandboxConfigEnvVar]
    internet_access: Optional[SandboxConfigInternetAccess] = None
    dependencies: Optional[SandboxConfigDependencies] = None

    @classmethod
    def from_stored(cls, stored: Any) -> "SandboxConfigData":
        """Build a ``SandboxConfigData`` from a stored ``SandboxConfig.config`` dict.

        Parses through ``SANDBOX_CONFIG_ADAPTER`` (the pydantic discriminated
        union) so the read path uses the same typed surface as the write path —
        the blob carries its own ``kind`` and ``language`` fields, written
        atomically with the row columns, so no external context is needed.

        Capability fields are extracted via ``isinstance`` against the
        ``Supports{EnvVars,InternetAccess,Dependencies}`` mixins, which lets
        the type checker narrow ``cfg`` and surfaces a clear signal for which
        capability each branch reads.

        Validation errors fall back to an empty ``SandboxConfigData`` rather
        than surfacing a 500. Writes go through the same pydantic validators,
        so newly-stored rows can't be malformed; this guard is purely defensive.
        """
        raw = stored if isinstance(stored, dict) else {}
        try:
            cfg = SANDBOX_CONFIG_ADAPTER.validate_python(raw)
        except Exception as exc:
            logger.warning("Failed to parse stored sandbox config: %s", exc)
            return cls(env_vars=[], internet_access=None, dependencies=None)

        env_vars: list[SandboxConfigEnvVar] = []
        if isinstance(cfg, SupportsEnvVars):
            for name, ev in cfg.env_vars.items():
                value: Union[SandboxConfigEnvVarLiteral, SandboxConfigEnvVarSecretRef]
                if isinstance(ev, EnvVarLiteral):
                    value = SandboxConfigEnvVarLiteral(literal=ev.literal)
                else:
                    value = SandboxConfigEnvVarSecretRef(secret_key=ev.secret_key)
                env_vars.append(SandboxConfigEnvVar(name=name, value=value))

        internet_access: Optional[SandboxConfigInternetAccess] = None
        if isinstance(cfg, SupportsInternetAccess) and cfg.internet_access is not None:
            internet_access = SandboxConfigInternetAccess(
                mode=InternetAccessChoice(cfg.internet_access.mode)
            )

        dependencies: Optional[SandboxConfigDependencies] = None
        if isinstance(cfg, SupportsDependencies) and cfg.dependencies is not None:
            dependencies = SandboxConfigDependencies(
                packages=list(cfg.dependencies.packages),
            )

        return cls(
            env_vars=env_vars,
            internet_access=internet_access,
            dependencies=dependencies,
        )


@strawberry.enum
class SandboxHostingType(Enum):
    """Where a sandbox backend physically executes code."""

    LOCAL = "local"
    """The runtime executes on the same machine as the Phoenix server —
    sandboxed, but consuming Phoenix's CPU/memory (e.g. WebAssembly, Deno)."""
    HOSTED = "hosted"
    """Execution is delegated to an external provider over the network
    (e.g. E2B, Daytona, Vercel, Modal); Phoenix only orchestrates."""


@strawberry.type
class SandboxBackendInfo:
    """
    Static + runtime information about a sandbox backend provider kind.

    One instance per entry in SANDBOX_ADAPTER_METADATA, regardless of whether
    any SandboxProvider rows exist in the DB.
    """

    backend_type: SandboxBackendType
    display_name: str
    hosting_type: SandboxHostingType
    supported_languages: list[Language]
    status: SandboxBackendStatus
    status_detail: Optional[str]
    dependency_hints: list[str]
    supports_env_vars: bool
    internet_access: InternetAccessMode
    supports_dependencies: bool
    credential_specs: list[SandboxProviderCredentialSpec]


@strawberry.type
class DaytonaDeploymentData:
    """Admin-scoped Daytona deployment routing (read view).

    Mirrors the ``DaytonaDeployment`` pydantic model. ``None`` values mean
    "fall back to Daytona's hosted SaaS default."
    """

    api_url: Optional[str]
    target: Optional[str]


@strawberry.type
class E2BDeploymentData:
    """Admin-scoped E2B deployment routing (read view).

    Mirrors the ``E2BDeployment`` pydantic model. ``domain`` and ``api_url``
    are mutually exclusive on the write side; the read side surfaces whichever
    one was stored.
    """

    domain: Optional[str]
    api_url: Optional[str]


SandboxDeployment = Annotated[
    Union[DaytonaDeploymentData, E2BDeploymentData],
    strawberry.union(
        "SandboxDeployment",
        description=(
            "Admin-scoped deployment routing for a sandbox provider. Only "
            "providers that expose routing kwargs on their SDK ``create()`` "
            "appear in this union; others (WASM, Deno, Vercel, Modal) expose "
            "``deployment: null``."
        ),
    ),
]


@strawberry.type
class SandboxProvider(Node):
    """A sandbox provider row — one per canonical provider ``kind``."""

    id: NodeID[models.SandboxBackendType]
    db_record: strawberry.Private[Optional[models.SandboxProvider]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.backend_type:
            raise ValueError("SandboxProvider ID mismatch")

    @strawberry.field
    async def backend_type(self) -> SandboxBackendType:
        return SandboxBackendType(self.id)

    @strawberry.field
    async def supported_languages(self) -> list[Language]:
        meta = SANDBOX_ADAPTER_METADATA[self.id]
        return [Language(lang) for lang in sorted(meta.supported_languages)]

    @strawberry.field
    async def enabled(self, info: Info[Context, None]) -> bool:
        record = await self._get_record(info)
        return record.enabled

    @strawberry.field(  # type: ignore
        description=(
            "Admin-scoped deployment routing parsed from the stored "
            "``SandboxProvider.config`` JSON. Returns ``null`` for providers "
            "whose SDK has no routing kwargs (WASM, Deno, Vercel, Modal) or "
            "when the stored blob is empty."
        )
    )
    async def deployment(self, info: Info[Context, None]) -> Optional[SandboxDeployment]:
        record = await self._get_record(info)
        return _deployment_from_stored(record.config)

    @strawberry.field
    async def configs(self, info: Info[Context, None]) -> list["SandboxConfig"]:
        rows = await info.context.data_loaders.sandbox_configs_by_provider.load(self.id)
        return [SandboxConfig(id=row.id, db_record=row) for row in rows]

    async def _get_record(self, info: Info[Context, None]) -> models.SandboxProvider:
        if self.db_record is not None:
            return self.db_record
        async with info.context.db() as session:
            row = await session.get(models.SandboxProvider, self.id)
        if row is None:
            from phoenix.server.api.exceptions import NotFound

            raise NotFound(f"SandboxProvider not found: {self.id}")
        self.db_record = row
        return row


def _deployment_from_stored(stored: Any) -> Optional[SandboxDeployment]:
    """Project a stored ``SandboxProvider.config`` JSON blob into the GraphQL
    union via the ``SandboxDeploymentModel`` discriminated union.

    The blob is self-sufficient: writes persist the ``kind`` discriminator
    alongside the routing fields via ``model_dump``, so the ``TypeAdapter``
    re-hydrates the right concrete subclass without an external ``kind``
    argument. An empty blob (no deployment ever written) returns ``None``.
    Only the two providers with non-trivial routing (Daytona, E2B) have a
    corresponding GraphQL union member; NoDeployment-style providers
    (WASM, Deno, Vercel, Modal) validate to typed instances that carry
    only their ``kind`` discriminator and surface as ``deployment: null``
    on the GraphQL side.
    """
    if not isinstance(stored, dict) or not stored:
        return None
    try:
        dep = SANDBOX_DEPLOYMENT_ADAPTER.validate_python(stored)
    except Exception as exc:
        logger.warning("Failed to parse stored sandbox deployment: %s", exc)
        return None
    if isinstance(dep, DaytonaDeployment):
        return DaytonaDeploymentData(api_url=dep.api_url, target=dep.target)
    if isinstance(dep, E2BDeployment):
        return E2BDeploymentData(domain=dep.domain, api_url=dep.api_url)
    return None


@strawberry.type
class SandboxConfig(Node):
    """
    A named sandbox configuration under a SandboxProvider.

    CodeEvaluators reference a SandboxConfig by ID.
    """

    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.SandboxConfig]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("SandboxConfig ID mismatch")

    @strawberry.field
    async def name(self, info: Info[Context, None]) -> Identifier:
        record = await self._get_record(info)
        return record.name

    @strawberry.field
    async def description(self, info: Info[Context, None]) -> Optional[str]:
        record = await self._get_record(info)
        return record.description

    @strawberry.field
    async def language(self, info: Info[Context, None]) -> Language:
        record = await self._get_record(info)
        return Language(record.language)

    @strawberry.field
    async def config(self, info: Info[Context, None]) -> SandboxConfigData:
        record = await self._get_record(info)
        return SandboxConfigData.from_stored(record.config)

    @strawberry.field(  # type: ignore
        description="Execution timeout in seconds (includes package install on ephemeral calls)."
    )
    async def timeout(self, info: Info[Context, None]) -> int:
        record = await self._get_record(info)
        return record.timeout

    @strawberry.field
    async def enabled(self, info: Info[Context, None]) -> bool:
        record = await self._get_record(info)
        return record.enabled

    @strawberry.field
    async def provider(self, info: Info[Context, None]) -> SandboxProvider:
        record = await self._get_record(info)
        provider = await info.context.data_loaders.sandbox_provider.load(record.backend_type)
        return SandboxProvider(id=record.backend_type, db_record=provider)

    @strawberry.field
    async def created_at(self, info: Info[Context, None]) -> datetime:
        record = await self._get_record(info)
        return record.created_at

    @strawberry.field
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        record = await self._get_record(info)
        return record.updated_at

    async def _get_record(self, info: Info[Context, None]) -> models.SandboxConfig:
        if self.db_record is not None:
            return self.db_record
        async with info.context.db() as session:
            row = await session.get(models.SandboxConfig, self.id)
        if row is None:
            from phoenix.server.api.exceptions import NotFound

            raise NotFound(f"SandboxConfig not found: {self.id}")
        self.db_record = row
        return row


# ---------------------------------------------------------------------------
# Converter helpers
# ---------------------------------------------------------------------------


def _probe_wasm_binary(backend_type: models.SandboxBackendType) -> Optional[str]:
    """Run the WASM-binary capability probe and return a status_detail string.

    Returns None when ``backend_type`` is not WASM, or when the binary is
    locally resolvable (probe says ``available=True``). Returns the probe's
    ``detail`` string when the WASM binary is not present locally — the
    caller treats a non-None return as falsifying evidence and forces the
    backend to ``UNAVAILABLE`` without invoking ``build_backend()``.

    Importing ``WASMAdapter`` is gated on the ``wasmtime`` optional extra,
    so an ImportError here means the SDK is missing — that case is already
    handled by the ``backend_type not in SANDBOX_ADAPTERS`` branch in the
    caller, but we re-handle it defensively (returning None) so this helper
    cannot regress that branch.
    """
    if backend_type != "WASM":
        return None
    try:
        from phoenix.server.sandbox.wasm_backend import WASMAdapter
    except ImportError:
        return None
    probe = WASMAdapter.probe_binary()
    if probe.available:
        return None
    return probe.detail


def _build_credential_specs(
    backend_type: models.SandboxBackendType,
) -> list[SandboxProviderCredentialSpec]:
    """Mirror an adapter's credential specs (derived from credentials_model) into GQL types."""
    from phoenix.server.sandbox import SANDBOX_ADAPTERS

    adapter = SANDBOX_ADAPTERS.get(backend_type)
    if adapter is None:
        return []
    specs = adapter.credential_specs()
    return [
        SandboxProviderCredentialSpec(
            key=spec.key,
            display_name=spec.display_name,
            description=spec.description,
            is_required=spec.is_required,
        )
        for spec in specs
    ]


async def get_sandbox_backend_info(
    *,
    secrets: SecretsContext,
) -> list[SandboxBackendInfo]:
    """Return one ``SandboxBackendInfo`` per entry in ``SANDBOX_ADAPTER_METADATA``.

    The caller is responsible for opening the ``SecretsContext`` (DB read
    session + decrypt). The DB is needed to distinguish
    ``MISSING_CREDENTIALS`` from ``AVAILABLE`` (credentials live in the
    ``secrets`` table). The single in-tree caller is the ``sandbox_backends``
    GraphQL resolver, which opens its session via ``info.context.db.read()``
    and pairs it with ``info.context.decrypt``.
    """
    from phoenix.server.sandbox import SANDBOX_ADAPTERS

    infos: list[SandboxBackendInfo] = []
    for backend_type, meta in SANDBOX_ADAPTER_METADATA.items():
        probe_language: models.LanguageName = sorted(meta.supported_languages)[0]
        status_detail: Optional[str] = None
        if backend_type not in SANDBOX_ADAPTERS:
            status = SandboxBackendStatus.NOT_INSTALLED
        else:
            missing_auth_detail = await secrets.missing_auth_detail(backend_type)
            if missing_auth_detail is not None:
                status = SandboxBackendStatus.MISSING_CREDENTIALS
                status_detail = missing_auth_detail
            else:
                wasm_probe_detail = _probe_wasm_binary(backend_type)
                if wasm_probe_detail is not None:
                    status = SandboxBackendStatus.UNAVAILABLE
                    status_detail = wasm_probe_detail
                else:
                    try:
                        backend = await probe_sandbox_backend_buildable(
                            backend_type,
                            language=probe_language,
                            secrets=secrets,
                        )
                        status = (
                            SandboxBackendStatus.AVAILABLE
                            if backend is not None
                            else SandboxBackendStatus.UNAVAILABLE
                        )
                    except (ValueError, MissingSecretError, UnsupportedOperation) as exc:
                        logger.debug(
                            f"sandboxBackends: {backend_type!r} unavailable: {exc}",
                        )
                        status = SandboxBackendStatus.UNAVAILABLE
                        status_detail = str(exc)
        credential_specs = _build_credential_specs(backend_type)
        infos.append(
            SandboxBackendInfo(
                backend_type=SandboxBackendType(backend_type),
                display_name=meta.display_name,
                hosting_type=SandboxHostingType(meta.hosting_type),
                supported_languages=[Language(lang) for lang in sorted(meta.supported_languages)],
                status=status,
                status_detail=status_detail,
                dependency_hints=list(meta.dependency_hints),
                supports_env_vars=meta.supports_env_vars,
                internet_access=InternetAccessMode(meta.internet_access_capability),
                supports_dependencies=meta.supports_dependencies,
                credential_specs=credential_specs,
            )
        )
    return infos
