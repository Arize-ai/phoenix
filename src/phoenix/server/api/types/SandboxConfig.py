"""GQL types for sandbox backend configuration."""

from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Any, Optional, Union

import strawberry
from strawberry import lazy
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.config import get_env_allowed_sandbox_providers
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
    SupportsDependencies,
    SupportsEnvVars,
    SupportsInternetAccess,
    UnsupportedOperation,
)

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from .User import User


@strawberry.type
class SandboxProviderCredentialSpec:
    key: str
    display_name: str
    description: str
    is_required: bool


@strawberry.enum
class Language(Enum):
    PYTHON = "PYTHON"
    TYPESCRIPT = "TYPESCRIPT"

    def to_orm(self) -> models.LanguageName:
        return self.value


@strawberry.enum
class SandboxBackendType(Enum):
    WASM = "WASM"
    E2B = "E2B"
    DAYTONA = "DAYTONA"
    VERCEL = "VERCEL"
    DENO = "DENO"
    MODAL = "MODAL"
    MONTY = "MONTY"


@strawberry.enum
class SandboxBackendStatus(Enum):
    AVAILABLE = "AVAILABLE"
    """Adapter is installed and the backend was created successfully."""
    MISSING_CREDENTIALS = "MISSING_CREDENTIALS"
    """Adapter is installed, but required auth credentials are not configured."""
    UNAVAILABLE = "UNAVAILABLE"
    """Adapter is installed but backend creation failed (e.g. bad credentials)."""
    NOT_INSTALLED = "NOT_INSTALLED"
    """Optional dependency for this backend is not installed."""
    DISABLED = "DISABLED"
    """Backend is excluded from PHOENIX_ALLOWED_SANDBOX_PROVIDERS on the server."""


@strawberry.enum
class InternetAccessMode(Enum):
    """Adapter's internet-access capability (read-only)."""

    NONE = "none"
    BOOLEAN = "boolean"


@strawberry.enum
class InternetAccessChoice(Enum):
    """User-facing internet access selection on a stored sandbox config."""

    ALLOW = "allow"
    DENY = "deny"


@strawberry.type
class SandboxConfigEnvVar:
    name: str
    secret_key: str


@strawberry.type
class SandboxConfigInternetAccess:
    mode: InternetAccessChoice


@strawberry.type
class SandboxConfigDependencies:
    packages: list[str]


@strawberry.type
class SandboxConfigData:
    """Typed view of a stored sandbox config's per-capability fields.

    Capability presence is not encoded here — readers correlate with
    ``SandboxBackendInfo`` (via ``provider.backend_type``) to disambiguate
    "supported but unset" from "unsupported".
    """

    env_vars: list[SandboxConfigEnvVar]
    internet_access: Optional[SandboxConfigInternetAccess] = None
    dependencies: Optional[SandboxConfigDependencies] = None

    @classmethod
    def from_stored(cls, stored: Any) -> "SandboxConfigData":
        # Validation errors fall back to an empty SandboxConfigData rather than 500.
        raw = stored if isinstance(stored, dict) else {}
        try:
            cfg = SANDBOX_CONFIG_ADAPTER.validate_python(raw)
        except Exception as exc:
            logger.warning("Failed to parse stored sandbox config: %s", exc)
            return cls(env_vars=[], internet_access=None, dependencies=None)

        env_vars: list[SandboxConfigEnvVar] = []
        if isinstance(cfg, SupportsEnvVars):
            for name, ev in cfg.env_vars.items():
                env_vars.append(SandboxConfigEnvVar(name=name, secret_key=ev.secret_key))

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
    """Runtime executes on the Phoenix server (e.g. WebAssembly, Deno)."""
    HOSTED = "hosted"
    """Execution delegated to an external provider (e.g. E2B, Daytona, Vercel, Modal)."""


@strawberry.enum
class SandboxLanguageDialect(Enum):
    FULL = "full"
    RESTRICTED = "restricted"


@strawberry.type
class SandboxBackendInfo:
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
    language_dialect: SandboxLanguageDialect
    runtime_notes: str
    credential_specs: list[SandboxProviderCredentialSpec]


@strawberry.type
class DaytonaDeploymentData:
    # None values mean "fall back to Daytona's hosted SaaS default".
    api_url: Optional[str]
    target: Optional[str]


@strawberry.type
class E2BDeploymentData:
    # `domain` and `api_url` are mutually exclusive on the write side.
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

    @strawberry.field
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        record = await self._get_record(info)
        return record.updated_at

    @strawberry.field
    async def user(self, info: Info[Context, None]) -> Annotated["User", lazy(".User")] | None:
        record = await self._get_record(info)
        if record.user_id is None:
            return None
        from .User import User

        return User(id=record.user_id)

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
    """A named sandbox configuration under a SandboxProvider."""

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

    @strawberry.field
    async def user(self, info: Info[Context, None]) -> Annotated["User", lazy(".User")] | None:
        record = await self._get_record(info)
        if record.user_id is None:
            return None
        from .User import User

        return User(id=record.user_id)

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


def _probe_wasm_binary(backend_type: models.SandboxBackendType) -> Optional[str]:
    """Return None when the WASM binary is locally available; otherwise a status_detail string."""
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

    Caller owns the ``SecretsContext`` (DB read session + decrypt) — the DB is
    needed to distinguish ``MISSING_CREDENTIALS`` from ``AVAILABLE``.
    """
    from phoenix.server.sandbox import SANDBOX_ADAPTERS

    allowed_backend_types = get_env_allowed_sandbox_providers()
    infos: list[SandboxBackendInfo] = []
    for backend_type, meta in SANDBOX_ADAPTER_METADATA.items():
        probe_language: models.LanguageName = sorted(meta.supported_languages)[0]
        status_detail: Optional[str] = None
        if backend_type not in allowed_backend_types:
            status = SandboxBackendStatus.DISABLED
            status_detail = "Disabled on the server."
        elif backend_type not in SANDBOX_ADAPTERS:
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
                language_dialect=SandboxLanguageDialect(meta.language_dialect),
                runtime_notes=meta.runtime_notes,
                credential_specs=credential_specs,
            )
        )
    return infos
