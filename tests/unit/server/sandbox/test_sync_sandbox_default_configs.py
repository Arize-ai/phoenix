from __future__ import annotations

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA, sync_sandbox_default_configs
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
    @pytest.mark.asyncio
    async def test_creates_default_rows_for_configless_backends(self, db: DbSessionFactory) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session)

        async with db() as session:
            result = await session.execute(
                select(models.SandboxConfig.backend_type, models.SandboxConfig.name)
            )
            rows = {(row[0], row[1]) for row in result.fetchall()}

        for key in _CONFIGLESS_BACKENDS:
            assert (key, "Default") in rows, f"Expected default row for configless backend '{key}'"

    @pytest.mark.asyncio
    async def test_does_not_create_rows_for_config_required_backends(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session)

        async with db() as session:
            result = await session.execute(
                select(models.SandboxConfig.backend_type, models.SandboxConfig.name)
            )
            rows = {(row[0], row[1]) for row in result.fetchall()}

        for key in _CONFIG_REQUIRED_BACKENDS:
            assert (key, "Default") not in rows, (
                f"Expected no default row for config-required backend '{key}'"
            )

    @pytest.mark.asyncio
    async def test_default_row_values(self, db: DbSessionFactory) -> None:
        async with db() as session:
            await sync_sandbox_default_configs(session)

        async with db() as session:
            for key in _CONFIGLESS_BACKENDS:
                row = await session.scalar(
                    select(models.SandboxConfig).where(
                        models.SandboxConfig.backend_type == key,
                        models.SandboxConfig.name == "Default",
                    )
                )
                assert row is not None
                assert row.config == {}
                assert row.timeout == 30
                assert row.enabled is True

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
            rows = result.fetchall()

        # Should have exactly one "Default" row per configless backend
        assert len(rows) == len(_CONFIGLESS_BACKENDS)
