"""Startup synchronization of sandbox provider registry to the database."""

from __future__ import annotations

import logging
from typing import Any, Mapping, Sequence

from sqlalchemy import Executable, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.models import Base, SandboxBackendType

logger = logging.getLogger(__name__)

_BUILTIN_LANGUAGES = ["PYTHON", "TYPESCRIPT"]


def _on_conflict_do_nothing(
    session: AsyncSession,
    table: type[Base],
    values: Sequence[Mapping[str, Any]],
    unique_columns: Sequence[str],
) -> Executable:
    """Build a dialect-aware INSERT ... ON CONFLICT DO NOTHING statement."""
    bind = session.bind
    if bind is None:
        raise RuntimeError("Session has no bound engine; cannot determine SQL dialect.")
    dialect_name = bind.dialect.name
    if dialect_name == "postgresql":
        return (
            pg_insert(table)
            .values(list(values))
            .on_conflict_do_nothing(index_elements=list(unique_columns))
        )
    if dialect_name == "sqlite":
        return (
            sqlite_insert(table)
            .values(list(values))
            .on_conflict_do_nothing(index_elements=list(unique_columns))
        )
    raise ValueError(f"Unsupported SQL dialect for sandbox sync: {dialect_name}")


async def sync_languages(session: AsyncSession) -> None:
    """Ensure PYTHON and TYPESCRIPT rows exist in the languages table."""
    existing_result = await session.execute(select(models.Language.name))
    existing_names: set[str] = {row[0] for row in existing_result.fetchall()}

    missing = [name for name in _BUILTIN_LANGUAGES if name not in existing_names]
    if not missing:
        return

    stmt = _on_conflict_do_nothing(
        session,
        models.Language,
        [{"name": name} for name in missing],
        unique_columns=["name"],
    )
    await session.execute(stmt)
    for name in missing:
        logger.info(f"Inserted language row: {name}")
    await session.flush()


async def sync_sandbox_providers(
    session: AsyncSession,
    adapter_metadata: Mapping[SandboxBackendType, Any],
) -> None:
    """Seed one sandbox_providers row per metadata key; existing rows preserved."""
    backend_types = list(adapter_metadata.keys())

    existing_result = await session.execute(select(models.SandboxProvider.backend_type))
    existing_backend_types: set[str] = {row[0] for row in existing_result.fetchall()}

    rows_to_insert: list[dict[str, object]] = []
    for backend_type in backend_types:
        if backend_type in existing_backend_types:
            continue
        rows_to_insert.append({"backend_type": backend_type, "enabled": True})
        logger.info(f"Inserted sandbox_providers row: backend_type={backend_type!r}")

    if rows_to_insert:
        stmt = _on_conflict_do_nothing(
            session,
            models.SandboxProvider,
            rows_to_insert,
            unique_columns=["backend_type"],
        )
        await session.execute(stmt)

    await session.flush()
