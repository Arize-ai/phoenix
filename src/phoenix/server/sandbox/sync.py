"""
Startup synchronization of sandbox provider registry to the database.

`sync_languages` seeds the fixed PYTHON/TYPESCRIPT rows in `languages`.
`sync_sandbox_providers` seeds one `sandbox_providers` row per
(backend_type, language) pair drawn from SANDBOX_ADAPTER_METADATA.

Both functions are idempotent and safe to call on every startup. Inserts
use `ON CONFLICT DO NOTHING` so that concurrent startups across replicas
do not race on the unique constraints — the second writer becomes a
no-op rather than raising IntegrityError.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping, Protocol, Sequence

from sqlalchemy import Executable, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.models import Base

logger = logging.getLogger(__name__)

_BUILTIN_LANGUAGES = ["PYTHON", "TYPESCRIPT"]


class _HasLanguage(Protocol):
    """Structural type for AdapterMetadata — avoids a circular import."""

    language: str


def _on_conflict_do_nothing(
    session: AsyncSession,
    table: type[Base],
    values: Sequence[Mapping[str, Any]],
    unique_columns: Sequence[str],
) -> Executable:
    """Build a dialect-aware INSERT ... ON CONFLICT DO NOTHING statement.

    PostgreSQL and SQLite both expose `on_conflict_do_nothing(index_elements=...)`
    on their dialect-specific Insert constructs.
    """
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
    """Ensure PYTHON and TYPESCRIPT rows exist in the languages table.

    Rows are never deleted; new names are inserted on demand.
    Safe to call multiple times (idempotent) and across concurrent replicas
    (race-safe via ON CONFLICT DO NOTHING).
    """
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
    adapter_metadata: Mapping[str, _HasLanguage],
) -> None:
    """Seed one sandbox_providers row per (backend_type, language) pair.

    The caller (sandbox/__init__.py) passes SANDBOX_ADAPTER_METADATA so
    this module has no import dependency on the sandbox package itself.
    Existing rows (matched by backend_type + language) are left untouched
    so user-configured values (enabled) are preserved — we use
    `ON CONFLICT DO NOTHING`, never `DO UPDATE`.

    Safe to call multiple times (idempotent) and across concurrent replicas
    (race-safe via ON CONFLICT DO NOTHING).
    """
    # Build set of known language names to guard against unknown languages.
    lang_result = await session.execute(select(models.Language.name))
    known_languages: set[str] = {row[0] for row in lang_result.fetchall()}

    # Build set of already-present (backend_type, language) pairs (optimization:
    # avoid issuing inserts that would all be no-ops).
    existing_result = await session.execute(
        select(models.SandboxProvider.backend_type, models.SandboxProvider.language)
    )
    existing_pairs: set[tuple[str, str]] = {(row[0], row[1]) for row in existing_result.fetchall()}

    rows_to_insert: list[dict[str, object]] = []
    for key, meta in adapter_metadata.items():
        lang_name = meta.language
        if lang_name not in known_languages:
            logger.warning(
                f"Language '{lang_name}' not found in languages table; "
                f"skipping sandbox_providers row for {key}/{lang_name}"
            )
            continue
        if (key, lang_name) in existing_pairs:
            continue
        rows_to_insert.append({"backend_type": key, "language": lang_name})
        logger.info(f"Inserted sandbox_providers row: backend_type={key!r}, language={lang_name!r}")

    if rows_to_insert:
        stmt = _on_conflict_do_nothing(
            session,
            models.SandboxProvider,
            rows_to_insert,
            unique_columns=["backend_type", "language"],
        )
        await session.execute(stmt)

    await session.flush()
