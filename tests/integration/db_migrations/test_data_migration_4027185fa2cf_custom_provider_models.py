"""Schema and data migration test for custom provider model tables (4027185fa2cf)."""

from typing import Literal

import pytest
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _get_table_schema_info, _run_async, _TableSchemaInfo, _up, _verify_clean_state

_DOWN = "ef09e3bc213f"
_UP = "4027185fa2cf"

_SDKS = ("openai", "azure_openai", "anthropic", "google_genai", "aws_bedrock")
_NEW_TABLES = (
    "custom_provider_model_types",
    "model_profiles",
    "custom_provider_model_profiles",
)


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


def _providers(conn: Connection) -> list[tuple[str, str, bytes]]:
    rows = conn.execute(
        text("SELECT name, sdk, config FROM generative_model_custom_providers ORDER BY id")
    ).all()
    return [(name, sdk, bytes(config)) for name, sdk, config in rows]


def _served_types(conn: Connection) -> dict[str, list[str]]:
    rows = conn.execute(
        text(
            "SELECT p.name, t.model_type "
            "FROM generative_model_custom_providers p "
            "LEFT JOIN custom_provider_model_types t ON t.provider_id = p.id "
            "ORDER BY p.id, t.model_type"
        )
    ).all()
    served: dict[str, list[str]] = {sdk: [] for sdk in _SDKS}
    for name, model_type in rows:
        if model_type is not None:
            served[name].append(model_type)
    return served


def _exercise_constraints(conn: Connection, db_backend: Literal["sqlite", "postgresql"]) -> None:
    if db_backend == "sqlite":
        conn.execute(text("PRAGMA foreign_keys = ON"))

    provider_id = conn.execute(
        text("SELECT id FROM generative_model_custom_providers WHERE name = 'openai'")
    ).scalar_one()

    profile_id = conn.execute(
        text("INSERT INTO model_profiles (model_type, name) VALUES ('chat', 'gpt-4o') RETURNING id")
    ).scalar_one()
    conn.execute(
        text(
            "INSERT INTO custom_provider_model_profiles "
            "(provider_id, model_type, model_profile_id, position) "
            "VALUES (:provider_id, 'chat', :profile_id, 0)"
        ),
        {"provider_id": provider_id, "profile_id": profile_id},
    )
    conn.commit()

    def _expect_failure(sql: str, **params: object) -> None:
        with pytest.raises(Exception):
            with conn.begin_nested():
                conn.execute(text(sql), params)

    # Duplicate primary key (provider_id, model_type, position)
    other_profile_id = conn.execute(
        text(
            "INSERT INTO model_profiles (model_type, name) "
            "VALUES ('chat', 'gpt-4o-mini') RETURNING id"
        )
    ).scalar_one()
    conn.commit()
    _expect_failure(
        "INSERT INTO custom_provider_model_profiles "
        "(provider_id, model_type, model_profile_id, position) "
        "VALUES (:provider_id, 'chat', :profile_id, 0)",
        provider_id=provider_id,
        profile_id=other_profile_id,
    )

    # Invalid model_type CHECK on both tables
    _expect_failure(
        "INSERT INTO custom_provider_model_types (provider_id, model_type) "
        "VALUES (:provider_id, 'embedding')",
        provider_id=provider_id,
    )
    _expect_failure("INSERT INTO model_profiles (model_type, name) VALUES ('embedding', 'ada')")

    # Blank or untrimmed name CHECK
    _expect_failure("INSERT INTO model_profiles (model_type, name) VALUES ('chat', '')")
    _expect_failure("INSERT INTO model_profiles (model_type, name) VALUES ('chat', '  ')")
    _expect_failure("INSERT INTO model_profiles (model_type, name) VALUES ('chat', ' gpt-4o')")

    # Crosswalk row whose (provider_id, model_type) has no type row
    decision_profile_id = conn.execute(
        text(
            "INSERT INTO model_profiles (model_type, name) "
            "VALUES ('decision', 'jev-latest') RETURNING id"
        )
    ).scalar_one()
    conn.commit()
    _expect_failure(
        "INSERT INTO custom_provider_model_profiles "
        "(provider_id, model_type, model_profile_id, position) "
        "VALUES (:provider_id, 'decision', :profile_id, 0)",
        provider_id=provider_id,
        profile_id=decision_profile_id,
    )

    # Crosswalk row whose model_type differs from its profile's
    _expect_failure(
        "INSERT INTO custom_provider_model_profiles "
        "(provider_id, model_type, model_profile_id, position) "
        "VALUES (:provider_id, 'chat', :profile_id, 1)",
        provider_id=provider_id,
        profile_id=decision_profile_id,
    )

    if db_backend == "sqlite":
        conn.execute(text("PRAGMA foreign_keys = OFF"))


async def test_custom_provider_model_tables_migration(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    async def table_info(table_name: str) -> _TableSchemaInfo | None:
        return await _run_async(
            _engine,
            lambda conn: _get_table_schema_info(conn, table_name, _db_backend, _schema),
        )

    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _DOWN, _schema)
    for table_name in _NEW_TABLES:
        assert await table_info(table_name) is None

    await _run_async(_engine, _seed)
    before = await _run_async(_engine, _providers)

    await _up(_engine, _alembic_config, _UP, _schema)

    providers_info = await table_info("generative_model_custom_providers")
    assert providers_info is not None
    assert "models" not in providers_info["column_names"]
    assert await _run_async(_engine, _providers) == before

    assert await _run_async(_engine, _served_types) == {sdk: ["chat"] for sdk in _SDKS}

    types_info = await table_info("custom_provider_model_types")
    assert types_info is not None
    assert types_info["column_names"] == frozenset({"provider_id", "model_type"})
    assert types_info["nullable_column_names"] == frozenset()
    assert "ck_custom_provider_model_types_`valid_model_type`" in types_info["constraint_names"]

    profiles_info = await table_info("model_profiles")
    assert profiles_info is not None
    assert profiles_info["column_names"] == frozenset({"id", "model_type", "name"})
    assert profiles_info["nullable_column_names"] == frozenset()
    assert {
        "uq_model_profiles_id_model_type",
        "ck_model_profiles_`valid_model_type`",
        "ck_model_profiles_`valid_name`",
    } <= profiles_info["constraint_names"]
    assert not any("uq_model_profiles_name" in c for c in profiles_info["constraint_names"])

    crosswalk_info = await table_info("custom_provider_model_profiles")
    assert crosswalk_info is not None
    assert crosswalk_info["column_names"] == frozenset(
        {"provider_id", "model_type", "model_profile_id", "position"}
    )
    assert crosswalk_info["nullable_column_names"] == frozenset()
    assert "ix_custom_provider_model_profiles_model_profile_id" in crosswalk_info["index_names"]

    await _run_async(_engine, lambda conn: _exercise_constraints(conn, _db_backend))

    await _down(_engine, _alembic_config, _DOWN, _schema)
    for table_name in _NEW_TABLES:
        assert await table_info(table_name) is None
    assert await _run_async(_engine, _providers) == before
