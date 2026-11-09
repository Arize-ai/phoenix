"""Data migration test for ``models`` on custom providers."""

import json
from typing import Any, Literal

from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _get_table_schema_info, _run_async, _TableSchemaInfo, _up

_DOWN = "ef09e3bc213f"
_UP = "4027185fa2cf"

_SDKS = ("openai", "azure_openai", "anthropic", "google_genai", "aws_bedrock")


def _seed(conn: Connection) -> None:
    for sdk in _SDKS:
        conn.execute(
            text(
                "INSERT INTO generative_model_custom_providers (name, provider, sdk, config) "
                "VALUES (:name, :provider, :sdk, :config)"
            ),
            {"name": sdk, "provider": sdk, "sdk": sdk, "config": b"encrypted"},
        )
    conn.commit()


def _served(conn: Connection) -> dict[str, Any]:
    rows = conn.execute(text("SELECT name, models FROM generative_model_custom_providers")).all()
    return {name: json.loads(value) if isinstance(value, str) else value for name, value in rows}


def _providers(conn: Connection) -> list[tuple[str, str, bytes]]:
    rows = conn.execute(
        text("SELECT name, sdk, config FROM generative_model_custom_providers ORDER BY id")
    ).all()
    return [(name, sdk, bytes(config)) for name, sdk, config in rows]


async def test_custom_provider_provider_models(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    async def columns() -> _TableSchemaInfo:
        info = await _run_async(
            _engine,
            lambda conn: _get_table_schema_info(
                conn, "generative_model_custom_providers", _db_backend, _schema
            ),
        )
        assert info is not None
        return info

    await _up(_engine, _alembic_config, _DOWN, _schema)
    await _run_async(_engine, _seed)
    before = await _run_async(_engine, _providers)

    await _up(_engine, _alembic_config, _UP, _schema)
    assert await _run_async(_engine, _served) == {sdk: {"chat": {}} for sdk in _SDKS}
    info = await columns()
    assert "models" in info["column_names"]
    assert "models" not in info["nullable_column_names"]
    assert await _run_async(_engine, _providers) == before

    await _down(_engine, _alembic_config, _DOWN, _schema)
    assert "models" not in (await columns())["column_names"]
    assert await _run_async(_engine, _providers) == before
