"""
Schema test for the project evaluator tracing migration.

It adds ``project_evaluators.tracing_enabled``, which defaults to true so evaluators that
exist before the upgrade keep writing traces. The downgrade drops the column.
"""

from typing import Literal

import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up, _verify_clean_state

_DOWN = "e724eb2ee5cf"
_UP = "b3d9f2a61c47"


async def test_project_evaluator_tracing_enabled_schema(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _DOWN, _schema)
    existing_id = await _run_async(_engine, lambda conn: _insert_project_evaluator(conn, "old"))

    await _up(_engine, _alembic_config, _UP, _schema)
    assert await _run_async(_engine, lambda conn: _tracing_enabled(conn, existing_id)) is True
    new_id = await _run_async(_engine, lambda conn: _insert_project_evaluator(conn, "new"))
    assert await _run_async(_engine, lambda conn: _tracing_enabled(conn, new_id)) is True

    await _down(_engine, _alembic_config, _DOWN, _schema)
    columns = await _run_async(
        _engine,
        lambda conn: {
            column["name"]
            for column in sa.inspect(conn).get_columns("project_evaluators", schema=_schema or None)
        },
    )
    assert "tracing_enabled" not in columns


def _insert_project_evaluator(conn: Connection, name: str) -> int:
    project_id = conn.execute(
        text("INSERT INTO projects (name) VALUES (:name) RETURNING id"),
        {"name": f"project-{name}"},
    ).scalar()
    trace_project_id = conn.execute(
        text("INSERT INTO projects (name) VALUES (:name) RETURNING id"),
        {"name": f"trace-project-{name}"},
    ).scalar()
    evaluator_id = conn.execute(
        text(
            "INSERT INTO evaluators (name, metadata, kind) VALUES (:name, '{}', 'LLM') RETURNING id"
        ),
        {"name": f"evaluator-{name}"},
    ).scalar()
    project_evaluator_id = conn.execute(
        text(
            "INSERT INTO project_evaluators "
            "(project_id, evaluator_id, trace_project_id, name, sampling_rate, "
            "evaluation_target, evaluation_delay_seconds) "
            "VALUES (:project_id, :evaluator_id, :trace_project_id, :name, 1.0, 'SPAN', 0) "
            "RETURNING id"
        ),
        {
            "project_id": project_id,
            "evaluator_id": evaluator_id,
            "trace_project_id": trace_project_id,
            "name": name,
        },
    ).scalar()
    conn.commit()
    assert isinstance(project_evaluator_id, int)
    return project_evaluator_id


def _tracing_enabled(conn: Connection, project_evaluator_id: int) -> bool:
    return bool(
        conn.execute(
            text("SELECT tracing_enabled FROM project_evaluators WHERE id = :id"),
            {"id": project_evaluator_id},
        ).scalar()
    )
