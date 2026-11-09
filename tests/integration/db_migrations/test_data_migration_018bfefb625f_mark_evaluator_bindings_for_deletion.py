"""
Data migration test for marking evaluator bindings deleted.

After the upgrade a deleted binding no longer holds its name, so a new binding can take it.
The downgrade restores the name constraints, so it first drops deleted bindings with the
trace projects they own.
"""

from typing import Literal

import pytest
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up

_DOWN = "00eb0d0a5db9"
_UP = "018bfefb625f"


def _insert(conn: Connection, sql: str, **params: object) -> int:
    row_id = conn.execute(text(sql + " RETURNING id"), params).scalar_one()
    return int(row_id)


def _project(conn: Connection, name: str) -> int:
    return _insert(conn, "INSERT INTO projects (name) VALUES (:name)", name=name)


def _seed(conn: Connection) -> dict[str, int]:
    evaluator_id = _insert(
        conn,
        "INSERT INTO evaluators (name, kind, metadata) VALUES ('judge', 'BUILTIN', '{}')",
    )
    conn.execute(
        text(
            "INSERT INTO builtin_evaluators (id, kind, key, input_schema, output_configs) "
            "VALUES (:id, 'BUILTIN', 'judge', '{}', '[]')"
        ),
        {"id": evaluator_id},
    )
    dataset_id = _insert(conn, "INSERT INTO datasets (name, metadata) VALUES ('golden', '{}')")
    project_id = _project(conn, "app")
    ids = {
        "evaluator": evaluator_id,
        "dataset": dataset_id,
        "project": project_id,
        "dataset_trace_project": _project(conn, "dataset-trace"),
        "project_trace_project": _project(conn, "project-trace"),
    }
    ids["dataset_evaluator"] = _insert(
        conn,
        "INSERT INTO dataset_evaluators (dataset_id, evaluator_id, name, input_mapping, project_id)"
        " VALUES (:dataset, :evaluator, 'judge', '{}', :trace_project)",
        dataset=dataset_id,
        evaluator=evaluator_id,
        trace_project=ids["dataset_trace_project"],
    )
    ids["project_evaluator"] = _insert(
        conn,
        "INSERT INTO project_evaluators (project_id, evaluator_id, trace_project_id, name, "
        "evaluation_target, evaluation_delay_seconds, sampling_rate) "
        "VALUES (:project, :evaluator, :trace_project, 'judge', 'SPAN', 0, 1.0)",
        project=project_id,
        evaluator=evaluator_id,
        trace_project=ids["project_trace_project"],
    )
    conn.commit()
    return ids


def _mark_deleted_and_rebind(conn: Connection, ids: dict[str, int]) -> None:
    conn.execute(text("UPDATE dataset_evaluators SET deleted_at = CURRENT_TIMESTAMP"))
    conn.execute(text("UPDATE project_evaluators SET deleted_at = CURRENT_TIMESTAMP"))
    _insert(
        conn,
        "INSERT INTO dataset_evaluators (dataset_id, evaluator_id, name, input_mapping, project_id)"
        " VALUES (:dataset, :evaluator, 'judge', '{}', :trace_project)",
        dataset=ids["dataset"],
        evaluator=ids["evaluator"],
        trace_project=_project(conn, "dataset-trace-2"),
    )
    _insert(
        conn,
        "INSERT INTO project_evaluators (project_id, evaluator_id, trace_project_id, name, "
        "evaluation_target, evaluation_delay_seconds, sampling_rate) "
        "VALUES (:project, :evaluator, :trace_project, 'judge', 'SPAN', 0, 1.0)",
        project=ids["project"],
        evaluator=ids["evaluator"],
        trace_project=_project(conn, "project-trace-2"),
    )
    conn.commit()


def _rebind_live_name(conn: Connection, ids: dict[str, int]) -> None:
    try:
        _insert(
            conn,
            "INSERT INTO dataset_evaluators "
            "(dataset_id, evaluator_id, name, input_mapping, project_id) "
            "VALUES (:dataset, :evaluator, 'judge', '{}', :trace_project)",
            dataset=ids["dataset"],
            evaluator=ids["evaluator"],
            trace_project=_project(conn, "dataset-trace-3"),
        )
    finally:
        conn.rollback()


def _project_names(conn: Connection) -> set[str]:
    return set(conn.execute(text("SELECT name FROM projects")).scalars())


def _binding_counts(conn: Connection) -> tuple[int, int]:
    return (
        conn.execute(text("SELECT count(*) FROM dataset_evaluators")).scalar_one(),
        conn.execute(text("SELECT count(*) FROM project_evaluators")).scalar_one(),
    )


async def test_mark_evaluator_bindings_for_deletion(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    ids = await _run_async(_engine, _seed)

    await _up(_engine, _alembic_config, _UP, _schema)
    await _run_async(_engine, lambda conn: _mark_deleted_and_rebind(conn, ids))
    assert await _run_async(_engine, _binding_counts) == (2, 2)
    with pytest.raises(Exception, match="(?i)unique|duplicate"):
        await _run_async(_engine, lambda conn: _rebind_live_name(conn, ids))

    await _down(_engine, _alembic_config, _DOWN, _schema)
    assert await _run_async(_engine, _binding_counts) == (1, 1)
    names = await _run_async(_engine, _project_names)
    assert {"app", "dataset-trace-2", "project-trace-2"} <= names
    assert not names & {"dataset-trace", "project-trace"}
