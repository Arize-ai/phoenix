from __future__ import annotations

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.sandbox import (
    SANDBOX_ADAPTER_METADATA,
    sync_sandbox_default_configs,
    sync_sandbox_providers,
)
from phoenix.server.types import DbSessionFactory

# Config-required=False backends (should get default rows)
_CONFIGLESS_BACKENDS = {
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if not meta.config_required
}
# Config-required=True backends (should NOT get default rows)
_CONFIG_REQUIRED_BACKENDS = {
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if meta.config_required
}


class TestSyncSandboxDefaultConfigs:
    @pytest.fixture(autouse=True)
    async def _seed_languages_and_providers(self, db: DbSessionFactory) -> None:
        """Seed language rows and sandbox providers before each test."""
        async with db() as session:
            for lang in ("PYTHON", "TYPESCRIPT"):
                existing = await session.scalar(
                    select(models.Language).where(models.Language.name == lang)
                )
                if existing is None:
                    session.add(models.Language(name=lang))
            await session.flush()
            await sync_sandbox_providers(session)

    @pytest.mark.asyncio
    async def test_creates_default_rows_for_configless_backends(self, db: DbSessionFactory) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session)

        async with db() as session:
            rows = (
                await session.execute(
                    select(models.SandboxProvider.backend_type, models.SandboxConfig.name)
                    .join(
                        models.SandboxProvider,
                        models.SandboxConfig.provider_id == models.SandboxProvider.id,
                    )
                    .where(models.SandboxConfig.name == "Default")
                )
            ).all()
            backend_types = {row[0] for row in rows}

        for key in _CONFIGLESS_BACKENDS:
            assert key in backend_types, f"Expected default row for configless backend '{key}'"

    @pytest.mark.asyncio
    async def test_does_not_create_rows_for_config_required_backends(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session)

        async with db() as session:
            rows = (
                await session.execute(
                    select(models.SandboxProvider.backend_type, models.SandboxConfig.name)
                    .join(
                        models.SandboxProvider,
                        models.SandboxConfig.provider_id == models.SandboxProvider.id,
                    )
                    .where(models.SandboxConfig.name == "Default")
                )
            ).all()
            backend_types = {row[0] for row in rows}

        for key in _CONFIG_REQUIRED_BACKENDS:
            assert key not in backend_types, (
                f"Expected no default row for config-required backend '{key}'"
            )

    @pytest.mark.asyncio
    async def test_default_row_values(self, db: DbSessionFactory) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session)

        async with db() as session:
            rows = (
                await session.execute(
                    select(models.SandboxConfig, models.SandboxProvider.backend_type)
                    .join(
                        models.SandboxProvider,
                        models.SandboxConfig.provider_id == models.SandboxProvider.id,
                    )
                    .where(models.SandboxConfig.name == "Default")
                )
            ).all()
            for config, backend_type in rows:
                if backend_type in _CONFIGLESS_BACKENDS:
                    assert config.config == {}
                    assert config.timeout == 30
                    assert config.enabled is True

    @pytest.mark.asyncio
    async def test_idempotent_on_second_call(self, db: DbSessionFactory) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session)

        async with db() as session:
            await sync_sandbox_default_configs(session)

        async with db() as session:
            result = await session.execute(
                select(models.SandboxConfig).where(models.SandboxConfig.name == "Default")
            )
            rows = result.scalars().all()

        # Should have one "Default" row per (configless backend, supported language) pair
        expected_count = sum(
            len(meta.supported_languages)
            for key, meta in SANDBOX_ADAPTER_METADATA.items()
            if not meta.config_required
        )
        assert len(rows) == expected_count
