from typing import Literal, cast

from alembic.config import Config
from sqlalchemy import Connection, inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up


async def test_project_evaluator_policy_backfill_and_downgrade(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, "a7f1c3e9d2b4", _schema)

    def _seed(conn: Connection) -> int:
        project_id = conn.execute(
            text(
                "INSERT INTO projects (name, description) "
                "VALUES ('migration-project', NULL) RETURNING id"
            )
        ).scalar_one()
        evaluator_id = conn.execute(
            text(
                "INSERT INTO evaluators (name, description, metadata, kind) "
                "VALUES ('migration-evaluator', NULL, '{}', 'BUILTIN') RETURNING id"
            )
        ).scalar_one()
        criteria_id = conn.execute(
            text(
                "INSERT INTO project_evaluator_criteria "
                "(project_id, evaluator_id, annotation_name, filter_condition, sampling_rate) "
                "VALUES (:project_id, :evaluator_id, 'migration-criteria', '', 1.0) "
                "RETURNING id"
            ),
            {"project_id": project_id, "evaluator_id": evaluator_id},
        ).scalar_one()
        conn.commit()
        return cast(int, criteria_id)

    criteria_id = await _run_async(_engine, _seed)
    await _up(_engine, _alembic_config, "b8c2d4e6f901", _schema)

    def _verify_upgrade(conn: Connection) -> None:
        row = conn.execute(
            text(
                "SELECT evaluation_target, input_mapping "
                "FROM project_evaluator_criteria WHERE id = :criteria_id"
            ),
            {"criteria_id": criteria_id},
        ).one()
        assert row.evaluation_target == "SPAN"
        assert row.input_mapping is None
        columns = {
            column["name"]: column
            for column in inspect(conn).get_columns("project_evaluator_criteria")
        }
        assert columns["evaluation_target"]["nullable"] is False
        assert columns["input_mapping"]["nullable"] is True

    await _run_async(_engine, _verify_upgrade)
    await _down(_engine, _alembic_config, "a7f1c3e9d2b4", _schema)

    def _verify_downgrade(conn: Connection) -> None:
        columns = {
            column["name"] for column in inspect(conn).get_columns("project_evaluator_criteria")
        }
        assert "evaluation_target" not in columns
        assert "input_mapping" not in columns

    await _run_async(_engine, _verify_downgrade)
