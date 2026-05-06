"""
Startup synchronization of sandbox provider registry to the database.

`sync_languages` seeds the fixed PYTHON/TYPESCRIPT rows in `languages`.
`sync_sandbox_providers` seeds one `sandbox_providers` row per
(backend_type, language) pair drawn from SANDBOX_ADAPTER_METADATA.

Both functions are idempotent and safe to call on every startup.
"""

from __future__ import annotations

import logging
from typing import Mapping, Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models

logger = logging.getLogger(__name__)

_BUILTIN_LANGUAGES = ["PYTHON", "TYPESCRIPT"]


class _HasLanguage(Protocol):
    """Structural type for AdapterMetadata — avoids a circular import."""

    language: str


async def sync_languages(session: AsyncSession) -> None:
    """Ensure PYTHON and TYPESCRIPT rows exist in the languages table.

    Rows are never deleted; new names are inserted on demand.
    Safe to call multiple times (idempotent).
    """
    existing_result = await session.execute(select(models.Language.name))
    existing_names: set[str] = {row[0] for row in existing_result.fetchall()}

    for name in _BUILTIN_LANGUAGES:
        if name not in existing_names:
            session.add(models.Language(name=name))
            logger.info(f"Inserted language row: {name}")

    await session.flush()


async def sync_sandbox_providers(
    session: AsyncSession,
    adapter_metadata: Mapping[str, _HasLanguage],
) -> None:
    """Seed one sandbox_providers row per (backend_type, language) pair.

    The caller (sandbox/__init__.py) passes SANDBOX_ADAPTER_METADATA so
    this module has no import dependency on the sandbox package itself.
    Existing rows (matched by backend_type + language) are left
    untouched so user-configured values (enabled, config) are preserved.

    Safe to call multiple times (idempotent).
    """
    # Build set of known language names to guard against unknown languages.
    lang_result = await session.execute(select(models.Language.name))
    known_languages: set[str] = {row[0] for row in lang_result.fetchall()}

    # Build set of already-present (backend_type, language) pairs.
    existing_result = await session.execute(
        select(models.SandboxProvider.backend_type, models.SandboxProvider.language)
    )
    existing_pairs: set[tuple[str, str]] = {(row[0], row[1]) for row in existing_result.fetchall()}

    for key, meta in adapter_metadata.items():
        lang_name = meta.language
        if lang_name not in known_languages:
            logger.warning(
                f"Language '{lang_name}' not found in languages table; "
                f"skipping sandbox_providers row for {key}/{lang_name}"
            )
            continue
        if (key, lang_name) not in existing_pairs:
            session.add(
                models.SandboxProvider(
                    backend_type=key,
                    language=lang_name,
                )
            )
            logger.info(
                f"Inserted sandbox_providers row: backend_type={key!r}, language={lang_name!r}"
            )

    await session.flush()
