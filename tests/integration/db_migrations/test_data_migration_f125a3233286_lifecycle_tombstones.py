"""Migration tests for f125a3233286 (lifecycle tombstones and cleanup failures)."""

import json
from datetime import datetime, timezone
from typing import Any

import pytest
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up

_DOWN = "a7f1c3e9d2b4"
_UP = "f125a3233286"


def _insert(conn: Connection, sql: str, **params: Any) -> int:
    rowid = conn.execute(text(sql + " RETURNING id"), params).scalar_one()
    assert isinstance(rowid, int)
    return rowid


async def test_f125a3233286_tombstones_projects_and_guards_downgrade(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    fixed_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    def _seed(conn: Connection) -> int:
        standard_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('prod-app', :time, :time)",
            time=fixed_time,
        )
        conn.commit()
        return standard_proj

    standard_proj = await _run_async(_engine, _seed)
    await _up(_engine, _alembic_config, _UP, _schema)

    def _verify_upgrade_and_mark_deleted(conn: Connection) -> int:
        # Mark standard_proj deleted and reuse its name 'prod-app' immediately.
        conn.execute(
            text("UPDATE projects SET deleted_at = :time WHERE id = :id"),
            {"time": fixed_time, "id": standard_proj},
        )
        new_prod = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('prod-app', :time, :time)",
            time=fixed_time,
        )
        conn.commit()
        return new_prod

    new_prod_id = await _run_async(_engine, _verify_upgrade_and_mark_deleted)
    assert new_prod_id != standard_proj

    # Downgrade refuses while deleted_at IS NOT NULL rows await cleanup.
    with pytest.raises(ValueError, match="Cannot downgrade while projects has deleted rows"):
        await _down(_engine, _alembic_config, _DOWN, _schema)

    def _finish_purge(conn: Connection) -> None:
        conn.execute(text("DELETE FROM projects WHERE id = :id"), {"id": standard_proj})
        conn.execute(
            text(
                "INSERT INTO cleanup_failures (target_kind, target_id, failure_count, retry_at) "
                "VALUES ('PROJECT', :id, 1, :time)"
            ),
            {"id": standard_proj, "time": fixed_time},
        )
        conn.commit()

    await _run_async(_engine, _finish_purge)

    # Retry state alone does not block the downgrade; it is dropped with its table.
    await _down(_engine, _alembic_config, _DOWN, _schema)


async def test_f125a3233286_tombstoned_dataset_evaluators_free_their_name_and_block_downgrade(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _UP, _schema)
    fixed_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    def _seed_binding_then_tombstone_it(conn: Connection) -> None:
        dataset = _insert(
            conn,
            "INSERT INTO datasets (name, metadata) VALUES ('ds', :metadata)",
            metadata=json.dumps({}),
        )
        sink = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('sink', :time, :time)",
            time=fixed_time,
        )
        evaluator = _insert(
            conn,
            "INSERT INTO evaluators (name, metadata, kind) VALUES ('builtin', :metadata, 'BUILTIN')",
            metadata=json.dumps({}),
        )
        conn.execute(
            text(
                "INSERT INTO builtin_evaluators (id, key, input_schema, output_configs) "
                "VALUES (:id, 'key', :s, :o)"
            ),
            {"id": evaluator, "s": json.dumps({}), "o": json.dumps([])},
        )
        insert_binding = (
            "INSERT INTO dataset_evaluators "
            "(dataset_id, evaluator_id, name, input_mapping, output_configs, project_id) "
            "VALUES (:dataset_id, :evaluator_id, 'judge', :input_mapping, :output_configs, :project_id)"
        )
        params: dict[str, Any] = dict(
            dataset_id=dataset,
            evaluator_id=evaluator,
            input_mapping=json.dumps({"literal_mapping": {}, "path_mapping": {}}),
            output_configs=json.dumps([]),
            project_id=sink,
        )
        binding = _insert(conn, insert_binding, **params)
        conn.execute(
            text(
                "UPDATE dataset_evaluators SET deleted_at = :time, evaluator_id = NULL WHERE id = :id"
            ),
            {"time": fixed_time, "id": binding},
        )
        # The tombstone no longer holds the name, so a live binding can reuse it.
        _insert(conn, insert_binding, **params)
        conn.commit()

    await _run_async(_engine, _seed_binding_then_tombstone_it)

    with pytest.raises(ValueError, match="Cannot downgrade while dataset_evaluators has deleted"):
        await _down(_engine, _alembic_config, _DOWN, _schema)


async def test_f125a3233286_preserves_live_dataset_evaluators(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    fixed_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    insert_binding = (
        "INSERT INTO dataset_evaluators "
        "(dataset_id, evaluator_id, name, input_mapping, output_configs, project_id) "
        "VALUES (:dataset_id, :evaluator_id, :name, :input_mapping, :output_configs, :project_id)"
    )

    def _seed(conn: Connection) -> dict[str, Any]:
        dataset = _insert(
            conn,
            "INSERT INTO datasets (name, metadata) VALUES ('ds', :metadata)",
            metadata=json.dumps({}),
        )
        sink = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('sink', :time, :time)",
            time=fixed_time,
        )
        evaluator = _insert(
            conn,
            "INSERT INTO evaluators (name, metadata, kind) VALUES ('builtin', :metadata, 'BUILTIN')",
            metadata=json.dumps({}),
        )
        conn.execute(
            text(
                "INSERT INTO builtin_evaluators (id, key, input_schema, output_configs) "
                "VALUES (:id, 'key', :s, :o)"
            ),
            {"id": evaluator, "s": json.dumps({}), "o": json.dumps([])},
        )
        params: dict[str, Any] = dict(
            dataset_id=dataset,
            evaluator_id=evaluator,
            name="judge",
            input_mapping=json.dumps({"literal_mapping": {}, "path_mapping": {}}),
            output_configs=json.dumps([]),
            project_id=sink,
        )
        params["binding"] = _insert(conn, insert_binding, **params)
        conn.commit()
        return params

    seeded = await _run_async(_engine, _seed)
    await _up(_engine, _alembic_config, _UP, _schema)

    def _verify(conn: Connection) -> None:
        row = conn.execute(
            text(
                "SELECT dataset_id, evaluator_id, project_id, name, deleted_at "
                "FROM dataset_evaluators WHERE id = :id"
            ),
            {"id": seeded["binding"]},
        ).one()
        assert tuple(row) == (
            seeded["dataset_id"],
            seeded["evaluator_id"],
            seeded["project_id"],
            "judge",
            None,
        )
        second_binding = _insert(conn, insert_binding, **{**seeded, "name": "judge-2"})
        assert second_binding > seeded["binding"]
        conn.commit()

    await _run_async(_engine, _verify)
