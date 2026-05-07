"""
GQL types for sandbox backend configuration.

Exposes SandboxProvider (one per backend_type × language pair) and
SandboxConfig (named per-provider config that a CodeEvaluator points to).
SandboxBackendInfo summarises all known backends including install status.
"""

from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import Any, Optional, cast

import strawberry
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.sandbox import (
    SANDBOX_ADAPTER_METADATA,
    MissingSecretError,
    get_missing_sandbox_auth_detail,
    get_or_create_backend,
)
from phoenix.server.sandbox.types import UnsupportedOperation

logger = logging.getLogger(__name__)

DEFAULT_SANDBOX_TIMEOUT_SECONDS = 300


@strawberry.type
class ConfigFieldSpecType:
    """GQL mirror of the ConfigFieldSpec dataclass."""

    key: str
    display_name: str
    field_type: str
    required: bool
    description: str
    choices: Optional[list[str]]


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
    NONE = "none"
    BOOLEAN = "boolean"
    ALLOWLIST = "allowlist"


@strawberry.type
class SandboxBackendInfo:
    """
    Static + runtime information about a sandbox backend type.

    One instance per entry in SANDBOX_ADAPTER_METADATA, regardless of whether
    any SandboxProvider rows exist in the DB.
    """

    backend_type: str
    display_name: str
    supported_languages: list[Language]
    status: SandboxBackendStatus
    status_detail: Optional[str]
    dependency_hints: list[str]
    config_field_specs: list[ConfigFieldSpecType]
    supports_env_vars: bool
    internet_access: InternetAccessMode
    dependencies_language: Optional[Language]
    credential_specs: list[SandboxProviderCredentialSpec]


@strawberry.type
class SandboxProvider(Node):
    """
    A sandbox provider row — one per (backend_type, language) pair.

    Admins configure credentials / enabled flag here; CodeEvaluators select a
    SandboxConfig that points back to a SandboxProvider.
    """

    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.SandboxProvider]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("SandboxProvider ID mismatch")

    @strawberry.field
    async def backend_type(self, info: Info[Context, None]) -> str:
        record = await self._get_record(info)
        return record.backend_type

    @strawberry.field
    async def language(self, info: Info[Context, None]) -> Language:
        record = await self._get_record(info)
        return Language(record.language)

    @strawberry.field
    async def config(self, info: Info[Context, None]) -> JSON:
        record = await self._get_record(info)
        return cast(JSON, record.config)

    @strawberry.field
    async def enabled(self, info: Info[Context, None]) -> bool:
        record = await self._get_record(info)
        return record.enabled

    @strawberry.field
    async def created_at(self, info: Info[Context, None]) -> datetime:
        record = await self._get_record(info)
        return record.created_at

    @strawberry.field
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        record = await self._get_record(info)
        return record.updated_at

    @strawberry.field
    async def configs(self, info: Info[Context, None]) -> list["SandboxConfig"]:
        record = await self._get_record(info)
        rows = await info.context.data_loaders.sandbox_configs_by_provider.load(record.id)
        return [SandboxConfig(id=row.id, db_record=row) for row in rows]

    async def _get_record(self, info: Info[Context, None]) -> models.SandboxProvider:
        if self.db_record is not None:
            return self.db_record
        from sqlalchemy import select

        async with info.context.db() as session:
            row = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.id == self.id)
            )
        if row is None:
            from phoenix.server.api.exceptions import NotFound

            raise NotFound(f"SandboxProvider not found: {self.id}")
        self.db_record = row
        return row


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
    async def name(self, info: Info[Context, None]) -> str:
        record = await self._get_record(info)
        return record.name

    @strawberry.field
    async def description(self, info: Info[Context, None]) -> Optional[str]:
        record = await self._get_record(info)
        return record.description

    @strawberry.field
    async def config(self, info: Info[Context, None]) -> JSON:
        record = await self._get_record(info)
        return cast(JSON, record.config)

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
        provider = await info.context.data_loaders.sandbox_provider_by_id.load(
            record.sandbox_provider_id
        )
        return SandboxProvider(id=record.sandbox_provider_id, db_record=provider)

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
        from sqlalchemy import select

        async with info.context.db() as session:
            row = await session.scalar(
                select(models.SandboxConfig).where(models.SandboxConfig.id == self.id)
            )
        if row is None:
            from phoenix.server.api.exceptions import NotFound

            raise NotFound(f"SandboxConfig not found: {self.id}")
        self.db_record = row
        return row


# ---------------------------------------------------------------------------
# Input types
# ---------------------------------------------------------------------------


@strawberry.input
class CreateSandboxConfigInput:
    sandbox_provider_id: GlobalID
    name: Identifier
    description: Optional[str] = None
    config: Optional[JSON] = None
    timeout: Optional[int] = None
    enabled: bool = True


@strawberry.input
class UpdateSandboxConfigInput:
    id: GlobalID
    name: Optional[Identifier] = strawberry.UNSET
    description: Optional[str] = strawberry.UNSET
    config: Optional[JSON] = strawberry.UNSET
    timeout: Optional[int] = strawberry.UNSET
    enabled: Optional[bool] = strawberry.UNSET


@strawberry.input
class UpdateSandboxProviderInput:
    id: GlobalID
    config: Optional[JSON] = strawberry.UNSET
    enabled: Optional[bool] = strawberry.UNSET


@strawberry.input
class DeleteSandboxConfigInput:
    id: GlobalID


@strawberry.input
class SetSandboxCredentialInput:
    backend_type: str
    key: str
    value: str


@strawberry.input
class DeleteSandboxCredentialInput:
    backend_type: str
    key: str


# ---------------------------------------------------------------------------
# Converter helpers
# ---------------------------------------------------------------------------


def to_gql_sandbox_config(row: models.SandboxConfig) -> SandboxConfig:
    return SandboxConfig(id=row.id, db_record=row)


def to_gql_sandbox_provider(row: models.SandboxProvider) -> SandboxProvider:
    return SandboxProvider(id=row.id, db_record=row)


async def get_sandbox_backend_info(
    info: Optional[Any] = None,
) -> list[SandboxBackendInfo]:
    """
    Return one SandboxBackendInfo per entry in SANDBOX_ADAPTER_METADATA,
    with runtime status derived from get_or_create_backend().

    Pass the Strawberry `info` object so DB-stored credentials are resolved
    when checking backend availability. Falls back to env-only resolution if
    info is None.
    """
    session = None
    decrypt = None
    if info is not None:
        context = info.context
        decrypt = context.decrypt
        # Open a read session for credential lookup during availability check
        async with context.db.read() as _session:
            session = _session
            return await _get_sandbox_backend_info_with_session(session=session, decrypt=decrypt)
    return await _get_sandbox_backend_info_with_session(session=None, decrypt=None)


def _probe_wasm_binary(backend_type: str) -> Optional[str]:
    """Run the WASM-binary capability probe and return a status_detail string.

    Returns None when this backend_type is not WASM, or when the binary is
    locally resolvable (probe says ``available=True``). Returns the probe's
    ``detail`` string when the WASM binary is not present locally — the
    caller treats a non-None return as falsifying evidence and forces the
    backend to ``UNAVAILABLE`` without invoking ``build_backend()``.

    Importing ``WASMAdapter`` is gated on the ``wasmtime`` optional extra,
    so an ImportError here means the SDK is missing — that case is already
    handled by the ``backend_type not in _SANDBOX_ADAPTERS`` branch in the
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
    backend_type: str,
) -> list[SandboxProviderCredentialSpec]:
    """Mirror an adapter's credential_specs into GQL types."""
    from phoenix.server.sandbox import _SANDBOX_ADAPTERS

    adapter = _SANDBOX_ADAPTERS.get(backend_type)
    if adapter is None or not adapter.credential_specs:
        return []
    return [
        SandboxProviderCredentialSpec(
            key=spec.key,
            display_name=spec.display_name,
            description=spec.description,
            is_required=spec.is_required,
        )
        for spec in adapter.credential_specs
    ]


async def _get_sandbox_backend_info_with_session(
    session: Optional[Any],
    decrypt: Optional[Any],
) -> list[SandboxBackendInfo]:
    from phoenix.server.sandbox import _SANDBOX_ADAPTERS

    infos: list[SandboxBackendInfo] = []
    for backend_type, meta in SANDBOX_ADAPTER_METADATA.items():
        status_detail: Optional[str] = None
        if backend_type not in _SANDBOX_ADAPTERS:
            status = SandboxBackendStatus.NOT_INSTALLED
        else:
            missing_auth_detail = await get_missing_sandbox_auth_detail(
                backend_type,
                session=session,
                decrypt=decrypt,
            )
            if missing_auth_detail is not None:
                status = SandboxBackendStatus.MISSING_CREDENTIALS
                status_detail = missing_auth_detail
            else:
                # Backend-specific runtime-asset gates layered on top of
                # build_backend(): adapter registration only proves the SDK
                # is importable. For backends that defer runtime preconditions
                # past build_backend (e.g. WASM lazy-downloads its CPython
                # binary), call a side-effect-free probe so the GraphQL status
                # reflects whether execution will actually succeed without a
                # network round-trip. Build_backend() is still called for the
                # general AVAILABLE/UNAVAILABLE path; the probe short-circuits
                # only when it has falsifying evidence (binary absent).
                wasm_probe_detail = _probe_wasm_binary(backend_type)
                if wasm_probe_detail is not None:
                    status = SandboxBackendStatus.UNAVAILABLE
                    status_detail = wasm_probe_detail
                else:
                    try:
                        backend = await get_or_create_backend(
                            backend_type, session=session, decrypt=decrypt
                        )
                        status = (
                            SandboxBackendStatus.AVAILABLE
                            if backend is not None
                            else SandboxBackendStatus.UNAVAILABLE
                        )
                    except (ValueError, MissingSecretError, UnsupportedOperation) as exc:
                        # Adapter is registered but construction failed because a
                        # runtime precondition is not met (auth not configured,
                        # missing user secret, capability mismatch). Surface as
                        # UNAVAILABLE instead of 500ing the whole query — capability
                        # advertisement must continue to work for adapters the admin
                        # hasn't configured yet.
                        logger.debug(
                            f"sandboxBackends: {backend_type!r} unavailable: {exc}",
                        )
                        status = SandboxBackendStatus.UNAVAILABLE
                        status_detail = str(exc)
        raw_specs = getattr(meta, "config_field_specs", [])
        credential_specs = _build_credential_specs(backend_type)
        infos.append(
            SandboxBackendInfo(
                backend_type=backend_type,
                display_name=meta.display_name,
                supported_languages=[Language(meta.language)] if meta.language else [],
                status=status,
                status_detail=status_detail,
                dependency_hints=meta.dependency_hints,
                config_field_specs=[
                    ConfigFieldSpecType(
                        key=s.key,
                        display_name=s.display_name,
                        field_type=s.field_type,
                        required=s.required,
                        description=s.description,
                        choices=s.choices,
                    )
                    for s in raw_specs
                ],
                supports_env_vars=meta.supports_env_vars,
                internet_access=InternetAccessMode(meta.internet_access_capability),
                dependencies_language=(
                    Language(meta.dependencies_language) if meta.dependencies_language else None
                ),
                credential_specs=credential_specs,
            )
        )
    return infos


def sandbox_config_from_input(
    input_: CreateSandboxConfigInput,
    provider_id: int,
    provider_language: str,
) -> dict[str, Any]:
    """Convert CreateSandboxConfigInput to a dict of column values.

    `provider_language` is inherited from the parent SandboxProvider and stored
    on the row so the composite FK to sandbox_providers(id, language) holds; the
    schema rejects any (sandbox_provider_id, language) pair that does not match
    the provider.
    """
    values: dict[str, Any] = {
        "sandbox_provider_id": provider_id,
        "language": provider_language,
        "name": input_.name,
        "description": input_.description,
        "config": input_.config if input_.config is not None else {},
        "timeout": input_.timeout
        if input_.timeout is not None
        else DEFAULT_SANDBOX_TIMEOUT_SECONDS,
        "enabled": input_.enabled,
    }
    return values
