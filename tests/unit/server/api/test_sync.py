"""Tests for sandbox DB seeding functions in sandbox/sync.py.

Covers:
- sync_languages: inserts PYTHON and TYPESCRIPT rows, is idempotent
- sync_sandbox_providers: inserts one row per (backend_type, language) pair,
  preserves existing rows, handles unknown languages gracefully
"""

from typing import Any

from sqlalchemy import select

from phoenix.db import models
from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
from phoenix.server.sandbox.sync import sync_languages, sync_sandbox_providers
from phoenix.server.types import DbSessionFactory


class TestSyncLanguages:
    async def test_inserts_python_and_typescript(self, db: DbSessionFactory) -> None:
        async with db() as session:
            await sync_languages(session)

        async with db() as session:
            names = set(await session.scalars(select(models.Language.name)))
        assert "PYTHON" in names
        assert "TYPESCRIPT" in names

    async def test_idempotent(self, db: DbSessionFactory) -> None:
        async with db() as session:
            await sync_languages(session)
        async with db() as session:
            await sync_languages(session)

        async with db() as session:
            rows = list(await session.scalars(select(models.Language.name)))
        assert rows.count("PYTHON") == 1
        assert rows.count("TYPESCRIPT") == 1


class TestSyncSandboxProviders:
    async def test_inserts_provider_rows(
        self,
        db: DbSessionFactory,
        seed_languages: None,
    ) -> None:
        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            providers = list(await session.scalars(select(models.SandboxProvider)))

        # At minimum one WASM/PYTHON row should exist
        backend_types = {p.backend_type for p in providers}
        assert "WASM" in backend_types

    async def test_idempotent(
        self,
        db: DbSessionFactory,
        seed_languages: None,
    ) -> None:
        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)
        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            count_result = await session.execute(select(models.SandboxProvider))
            providers = list(count_result.scalars())

        # Each (backend_type, language_id) pair should appear exactly once
        pairs = [(p.backend_type, p.language_id) for p in providers]
        assert len(pairs) == len(set(pairs)), "Duplicate (backend_type, language_id) pairs found"

    async def test_preserves_existing_user_config(
        self,
        db: DbSessionFactory,
        seed_languages: None,
    ) -> None:
        # Seed once
        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)

        # Update the WASM provider's config
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
            assert provider is not None
            provider.config = {"custom_key": "custom_value"}

        # Re-seed — should not overwrite the existing row
        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
            assert provider is not None
            assert provider.config == {"custom_key": "custom_value"}

    async def test_unknown_language_skipped(
        self,
        db: DbSessionFactory,
        seed_languages: None,
    ) -> None:
        bad_metadata: dict[str, Any] = {
            "FAKE": type(
                "_FakeMeta",
                (),
                {"supported_languages": ["COBOL"]},
            )(),
        }
        # Should not raise even when language does not exist in DB
        async with db() as session:
            await sync_sandbox_providers(session, bad_metadata)

        async with db() as session:
            count = len(
                list(
                    await session.scalars(
                        select(models.SandboxProvider).where(
                            models.SandboxProvider.backend_type == "FAKE"
                        )
                    )
                )
            )
        assert count == 0

    async def test_requires_languages_to_exist(
        self,
        db: DbSessionFactory,
    ) -> None:
        # Without sync_languages first, no providers should be inserted
        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            count = len(list(await session.scalars(select(models.SandboxProvider))))
        assert count == 0
