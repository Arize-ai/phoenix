"""Backfill test for per-evaluator trace projects.

Project evaluators used to trace into one shared project. The migration gives
every existing evaluator a trace project of its own, which is what a deployment
upgrading into per-evaluator trace projects depends on: without the backfill an
evaluator's Traces tab would have nowhere to read from until its next execution.
"""

from typing import Any, Literal

import pytest
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up, _version_num

_DOWN = "a7f1c3e9d2b4"
_UP = "b3f7d2c9e401"


async def test_project_evaluator_trace_project_backfill(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    with pytest.raises(BaseException, match="alembic_version"):
        await _version_num(_engine, _schema)

    await _up(_engine, _alembic_config, _DOWN, _schema)
    criteria_ids = await _run_async(_engine, _seed)

    await _up(_engine, _alembic_config, _UP, _schema)

    rows = await _run_async(_engine, _trace_projects)
    assert set(rows) == set(criteria_ids)
    # One project per evaluator, each explaining itself by the evaluator and the
    # project it evaluates.
    trace_project_ids = {row[0] for row in rows.values()}
    assert len(trace_project_ids) == len(criteria_ids)
    for criteria_name, (_, name, description) in rows.items():
        assert name.startswith("project-evaluator-")
        assert description == (f"Traces for project evaluator: {criteria_name} on project: my-app")

    # The column goes on downgrade; the evaluators it belonged to stay.
    await _down(_engine, _alembic_config, _DOWN, _schema)
    assert await _run_async(_engine, _criteria_names) == set(criteria_ids)


def _seed(conn: Connection) -> set[str]:
    project_id = conn.execute(
        text("INSERT INTO projects (name) VALUES ('my-app') RETURNING id")
    ).scalar_one()
    evaluator_id = conn.execute(
        text(
            "INSERT INTO evaluators (name, kind, metadata) "
            "VALUES ('contains', 'BUILTIN', '{}') RETURNING id"
        )
    ).scalar_one()
    names = {"first-criteria", "second-criteria"}
    for name in names:
        conn.execute(
            text(
                "INSERT INTO project_evaluator_criteria "
                "(project_id, evaluator_id, name, sampling_rate, evaluation_target) "
                "VALUES (:project_id, :evaluator_id, :name, 1.0, 'SPAN')"
            ),
            {"project_id": project_id, "evaluator_id": evaluator_id, "name": name},
        )
    conn.commit()
    return names


def _trace_projects(conn: Connection) -> dict[str, tuple[Any, str, str]]:
    rows = conn.execute(
        text(
            "SELECT c.name, p.id, p.name, p.description "
            "FROM project_evaluator_criteria c "
            "JOIN projects p ON p.id = c.trace_project_id"
        )
    ).all()
    return {
        criteria_name: (project_id, project_name, description)
        for criteria_name, project_id, project_name, description in rows
    }


def _criteria_names(conn: Connection) -> set[str]:
    return set(conn.scalars(text("SELECT name FROM project_evaluator_criteria")))
