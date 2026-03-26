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


class _HasSupportedLanguages(Protocol):
    """Structural type for AdapterMetadata — avoids a circular import."""

    supported_languages: list[str]


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
    adapter_metadata: Mapping[str, _HasSupportedLanguages],
) -> None:
    """Seed one sandbox_providers row per (backend_type, language) pair.

    The caller (sandbox/__init__.py) passes SANDBOX_ADAPTER_METADATA so
    this module has no import dependency on the sandbox package itself.
    Existing rows (matched by backend_type + language_id) are left
    untouched so user-configured values (enabled, config) are preserved.

    Safe to call multiple times (idempotent).
    """
    # Build language-name → id lookup from rows inserted by sync_languages().
    lang_result = await session.execute(select(models.Language.name, models.Language.id))
    language_ids: dict[str, int] = {name: lid for name, lid in lang_result.fetchall()}

    # Build set of already-present (backend_type, language_id) pairs.
    existing_result = await session.execute(
        select(models.SandboxProvider.backend_type, models.SandboxProvider.language_id)
    )
    existing_pairs: set[tuple[str, int]] = {(row[0], row[1]) for row in existing_result.fetchall()}

    for key, meta in adapter_metadata.items():
        for lang_name in meta.supported_languages:
            lang_id = language_ids.get(lang_name)
            if lang_id is None:
                logger.warning(
                    f"Language '{lang_name}' not found in languages table; "
                    f"skipping sandbox_providers row for {key}/{lang_name}"
                )
                continue

            if (key, lang_id) not in existing_pairs:
                session.add(
                    models.SandboxProvider(
                        backend_type=key,
                        language_id=lang_id,
                    )
                )
                logger.info(
                    f"Inserted sandbox_providers row: backend_type={key!r}, language={lang_name!r}"
                )

    await session.flush()
