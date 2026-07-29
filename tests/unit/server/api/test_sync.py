from typing import Any, Mapping, cast

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.models import SandboxBackendType
from phoenix.db.types.identifier import Identifier
from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA, SANDBOX_ADAPTERS
from phoenix.server.sandbox.sync import (
    sync_languages,
    sync_sandbox_default_configs,
    sync_sandbox_providers,
)
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


class TestSyncSandboxDefaultConfigs:
    async def test_seeds_rows_for_live_auto_seedable_adapters(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            rows = list(await session.scalars(select(models.SandboxConfig)))

        seeded_pairs = {(r.backend_type, r.language) for r in rows}
        for backend_type, meta in SANDBOX_ADAPTER_METADATA.items():
            if not meta.auto_seedable:
                continue
            if SANDBOX_ADAPTERS.get(backend_type) is None:
                continue
            for language in meta.supported_languages:
                assert (backend_type, language) in seeded_pairs, (
                    f"expected seeded row for {backend_type}/{language}"
                )

        for row in rows:
            meta = SANDBOX_ADAPTER_METADATA[row.backend_type]
            assert row.name == Identifier(
                f"default-{row.backend_type.lower()}-{row.language.lower()}"
            )
            assert row.description == f"Default {meta.display_name} ({row.language.title()})"
            # Seeded config is built through the Pydantic model, so it carries the
            # backend_type discriminator and round-trips through SANDBOX_CONFIG_ADAPTER,
            # identical to a user-created row.
            assert row.config == {
                "backend_type": row.backend_type,
                "language": row.language,
            }
            assert row.enabled is True
            assert row.user_id is None
            assert row.timeout == 300

    async def test_seeded_config_round_trips_through_adapter(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        # Regression: the seeded config must validate through the same adapter the
        # read path uses, so it parses back to the matching config model instead of
        # failing the backend_type discriminator and silently degrading.
        from phoenix.server.sandbox.types import SANDBOX_CONFIG_ADAPTER

        async with db() as session:
            await sync_sandbox_default_configs(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            rows = list(await session.scalars(select(models.SandboxConfig)))

        if not rows:
            pytest.skip("No auto-seedable adapter is present in the live registry")
        for row in rows:
            cfg = SANDBOX_CONFIG_ADAPTER.validate_python(row.config)
            assert cfg.backend_type == row.backend_type
            assert cfg.language == row.language

    async def test_idempotent(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session, SANDBOX_ADAPTER_METADATA)
        async with db() as session:
            await sync_sandbox_default_configs(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            rows = list(await session.scalars(select(models.SandboxConfig)))

        pairs = [(r.backend_type, r.language) for r in rows]
        assert len(pairs) == len(set(pairs)), "Duplicate (backend_type, language) rows seeded"

    async def test_preexisting_row_suppresses_seeding(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        candidates = [
            (backend_type, language)
            for backend_type, meta in SANDBOX_ADAPTER_METADATA.items()
            if meta.auto_seedable and SANDBOX_ADAPTERS.get(backend_type) is not None
            for language in meta.supported_languages
        ]
        if not candidates:
            pytest.skip("No auto-seedable adapter is present in the live registry")
        backend_type, language = candidates[0]

        async with db() as session:
            session.add(
                models.SandboxConfig(
                    backend_type=backend_type,
                    language=language,
                    name=Identifier("user-owned-config"),
                    description=None,
                    config={"language": language},
                    timeout=42,
                    enabled=False,
                    user_id=None,
                )
            )

        async with db() as session:
            await sync_sandbox_default_configs(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            rows = list(
                await session.scalars(
                    select(models.SandboxConfig)
                    .where(models.SandboxConfig.backend_type == backend_type)
                    .where(models.SandboxConfig.language == language)
                )
            )
        assert len(rows) == 1
        assert rows[0].name == Identifier("user-owned-config")
        assert rows[0].timeout == 42
        assert rows[0].enabled is False

    def test_auto_seedable_derivation_matches_live_adapters(self) -> None:
        expected: dict[SandboxBackendType, bool] = {
            "DENO": True,
            "WASM": True,
            "E2B": False,
            "DAYTONA": False,
            "VERCEL": False,
            "MODAL": False,
            "MONTY": True,
        }
        for backend_type, want in expected.items():
            meta = SANDBOX_ADAPTER_METADATA[backend_type]
            assert meta.auto_seedable is want, (
                f"{backend_type}: expected auto_seedable={want}, got {meta.auto_seedable}"
            )


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
