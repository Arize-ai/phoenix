"""
Data migration test for ``decision_sdk`` on custom providers.

TypeSafe-SDK providers exist only to serve decisions, so they are backfilled with
``typesafe``. Every other provider, OpenAI-SDK ones included, starts with no decision
client. The downgrade drops the column and leaves the providers as they were.
"""

from typing import Literal

from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _get_table_schema_info, _run_async, _up

_DOWN = "e724eb2ee5cf"
_UP = "00eb0d0a5db9"

_SDKS = ("openai", "azure_openai", "anthropic", "google_genai", "aws_bedrock", "typesafe")


def _seed(conn: Connection) -> None:
    for sdk in _SDKS:
        conn.execute(
            text(
                "INSERT INTO generative_model_custom_providers (name, provider, sdk, config) "
                "VALUES (:name, :provider, :sdk, :config)"
            ),
            {"name": f"{sdk} provider", "provider": sdk, "sdk": sdk, "config": b"encrypted"},
        )
    conn.commit()


def _decision_sdks(conn: Connection) -> dict[str, str | None]:
    rows = conn.execute(
        text("SELECT sdk, decision_sdk FROM generative_model_custom_providers ORDER BY id")
    ).all()
    return {sdk: decision_sdk for sdk, decision_sdk in rows}


def _providers(conn: Connection) -> list[tuple[str, str, bytes]]:
    rows = conn.execute(
        text("SELECT name, sdk, config FROM generative_model_custom_providers ORDER BY id")
    ).all()
    return [(name, sdk, bytes(config)) for name, sdk, config in rows]


async def test_custom_provider_decision_sdk(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    async def columns() -> set[str]:
        info = await _run_async(
            _engine,
            lambda conn: _get_table_schema_info(
                conn, "generative_model_custom_providers", _db_backend, _schema
            ),
        )
        assert info is not None
        return set(info["column_names"])

    await _up(_engine, _alembic_config, _DOWN, _schema)
    await _run_async(_engine, _seed)
    before = await _run_async(_engine, _providers)

    await _up(_engine, _alembic_config, _UP, _schema)
    assert await _run_async(_engine, _decision_sdks) == {
        "openai": None,
        "azure_openai": None,
        "anthropic": None,
        "google_genai": None,
        "aws_bedrock": None,
        "typesafe": "typesafe",
    }
    assert "decision_sdk" in await columns()
    assert await _run_async(_engine, _providers) == before

    # A provider created after the upgrade may name either client, or none.
    def _create_after_upgrade(conn: Connection) -> None:
        conn.execute(
            text(
                "INSERT INTO generative_model_custom_providers "
                "(name, provider, sdk, decision_sdk, config) "
                "VALUES ('openai on system one', 'openai', 'openai', 'typesafe', :config)"
            ),
            {"config": b"encrypted"},
        )
        conn.commit()

    await _run_async(_engine, _create_after_upgrade)

    await _down(_engine, _alembic_config, _DOWN, _schema)
    assert "decision_sdk" not in await columns()
    after = await _run_async(_engine, _providers)
    assert after[: len(before)] == before
