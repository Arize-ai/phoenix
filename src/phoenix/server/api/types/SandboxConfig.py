"""
GQL types for sandbox backend configuration.

Exposes SandboxProvider (one per backend_type × language pair) and
SandboxConfig (named per-provider config that a CodeEvaluator points to).
SandboxBackendInfo summarises all known backends including install status.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA, get_or_create_backend


@strawberry.enum
class SandboxBackendStatus(Enum):
    """Runtime availability of a sandbox backend."""

    AVAILABLE = "AVAILABLE"
    """Adapter is installed and the backend was created successfully."""
    UNAVAILABLE = "UNAVAILABLE"
    """Adapter is installed but backend creation failed (e.g. bad credentials)."""
    NOT_INSTALLED = "NOT_INSTALLED"
    """Optional dependency for this backend is not installed."""


@strawberry.type
class SandboxBackendInfo:
    """
    Static + runtime information about a sandbox backend type.

    One instance per entry in SANDBOX_ADAPTER_METADATA, regardless of whether
    any SandboxProvider rows exist in the DB.
    """

    backend_type: str
    display_name: str
    supported_languages: list[str]
    status: SandboxBackendStatus


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
    async def language(self, info: Info[Context, None]) -> str:
        record = await self._get_record(info)
        async with info.context.db() as session:
            lang = await session.get(models.Language, record.language_id)
        if lang is None:
            return "UNKNOWN"
        return lang.name

    @strawberry.field
    async def config(self, info: Info[Context, None]) -> JSON:
        record = await self._get_record(info)
        return record.config

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
        return record.config

    @strawberry.field
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
        return SandboxProvider(id=record.sandbox_provider_id)

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
    sandbox_provider_id: int
    name: str
    description: Optional[str] = None
    config: Optional[JSON] = None
    timeout: Optional[int] = None
    enabled: bool = True


@strawberry.input
class UpdateSandboxConfigInput:
    id: int
    description: Optional[str] = strawberry.UNSET
    config: Optional[JSON] = strawberry.UNSET
    timeout: Optional[int] = strawberry.UNSET
    enabled: Optional[bool] = strawberry.UNSET


# ---------------------------------------------------------------------------
# Converter helpers
# ---------------------------------------------------------------------------


def to_gql_sandbox_config(row: models.SandboxConfig) -> SandboxConfig:
    return SandboxConfig(id=row.id, db_record=row)


def to_gql_sandbox_provider(row: models.SandboxProvider) -> SandboxProvider:
    return SandboxProvider(id=row.id, db_record=row)


def get_sandbox_backend_info() -> list[SandboxBackendInfo]:
    """
    Return one SandboxBackendInfo per entry in SANDBOX_ADAPTER_METADATA,
    with runtime status derived from get_or_create_backend().
    """
    from phoenix.server.sandbox import _SANDBOX_ADAPTERS

    infos: list[SandboxBackendInfo] = []
    for backend_type, meta in SANDBOX_ADAPTER_METADATA.items():
        if backend_type not in _SANDBOX_ADAPTERS:
            status = SandboxBackendStatus.NOT_INSTALLED
        else:
            backend = get_or_create_backend(backend_type)
            status = (
                SandboxBackendStatus.AVAILABLE
                if backend is not None
                else SandboxBackendStatus.UNAVAILABLE
            )
        infos.append(
            SandboxBackendInfo(
                backend_type=backend_type,
                display_name=meta.display_name,
                supported_languages=list(meta.supported_languages),
                status=status,
            )
        )
    return infos


def sandbox_config_from_input(
    input_: CreateSandboxConfigInput,
) -> dict[str, Any]:
    """Convert CreateSandboxConfigInput to a dict of column values."""
    values: dict[str, Any] = {
        "sandbox_provider_id": input_.sandbox_provider_id,
        "name": input_.name,
        "description": input_.description,
        "config": input_.config if input_.config is not None else {},
    }
    if input_.timeout is not None:
        values["timeout"] = input_.timeout
    values["enabled"] = input_.enabled
    return values
