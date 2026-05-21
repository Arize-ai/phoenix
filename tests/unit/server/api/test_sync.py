from typing import Any, Mapping, cast

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.models import SandboxBackendType
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

        kinds = {p.backend_type for p in providers}
        assert "WASM" in kinds
        assert kinds == set(SANDBOX_ADAPTER_METADATA.keys())

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
            providers = list(await session.scalars(select(models.SandboxProvider)))

        kinds = [p.backend_type for p in providers]
        assert len(kinds) == len(set(kinds)), "Duplicate provider kinds found"

    async def test_preserves_existing_user_config(
        self,
        db: DbSessionFactory,
        seed_languages: None,
    ) -> None:
        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
            assert provider is not None
            provider.enabled = False

        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
            assert provider is not None
            assert provider.enabled is False

    async def test_extra_metadata_kind_inserted(
        self,
        db: DbSessionFactory,
        seed_languages: None,
    ) -> None:
        extra: dict[str, Any] = {
            "FAKE": SANDBOX_ADAPTER_METADATA["WASM"],
        }
        async with db() as session:
            await sync_sandbox_providers(session, cast(Mapping[SandboxBackendType, Any], extra))

        async with db() as session:
            row = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "FAKE")
            )
        assert row is not None
        assert row.enabled is True

    async def test_inserts_even_when_languages_empty(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            count = len(list(await session.scalars(select(models.SandboxProvider))))
        assert count == len(SANDBOX_ADAPTER_METADATA)


class TestAdapterMetadataConsistency:
    def test_e2b_adapter_languages_matches_metadata(self) -> None:
        try:
            from phoenix.server.sandbox.e2b_backend import E2BAdapter

            inst = E2BAdapter()
        except ImportError:
            pytest.skip("e2b optional extra not installed")
        meta = SANDBOX_ADAPTER_METADATA["E2B"]
        from typing import get_args

        assert (
            frozenset(get_args(inst.config_model.model_fields["language"].annotation))
            == meta.supported_languages
        )

    def test_wasm_adapter_languages_matches_metadata(self) -> None:
        try:
            from phoenix.server.sandbox.wasm_backend import WASMAdapter

            inst = WASMAdapter()
        except ImportError:
            pytest.skip("wasmtime optional extra not installed")
        meta = SANDBOX_ADAPTER_METADATA["WASM"]
        from typing import get_args

        assert (
            frozenset(get_args(inst.config_model.model_fields["language"].annotation))
            == meta.supported_languages
        )
