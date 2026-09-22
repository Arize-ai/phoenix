"""
Schema test for the experiment evaluator tasks part of the online eval migration.

That part widens the ``experiment_jobs.type`` CHECK to admit ``EVALUATOR`` and adds
the ``experiment_evaluator_tasks`` table, a joined-table subclass keyed to the job by
``(type, id)``. Its downgrade narrows the CHECK back, which must fail while EVALUATOR jobs
exist so their bookkeeping is never dropped silently.
"""

from datetime import datetime, timezone
from typing import Literal

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up, _verify_clean_state

_DOWN = "4aad9107d196"
_UP = "a7f1c3e9d2b4"


async def test_experiment_evaluator_tasks_schema(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _DOWN, _schema)

    # Before the migration, EVALUATOR is not a job type.
    prompt_experiment_id = await _run_async(
        _engine, lambda conn: _insert_experiment(conn, "prompt")
    )
    await _run_async(
        _engine, lambda conn: _insert_job(conn, prompt_experiment_id, job_type="PROMPT")
    )
    evaluator_experiment_id = await _run_async(
        _engine, lambda conn: _insert_experiment(conn, "evaluator")
    )
    with pytest.raises(Exception, match="valid_type"):
        await _run_async(
            _engine,
            lambda conn: _insert_job(conn, evaluator_experiment_id, job_type="EVALUATOR"),
        )

    await _up(_engine, _alembic_config, _UP, _schema)

    # After it, an EVALUATOR job with its task row is accepted, and the task table only
    # takes rows of that type.
    await _run_async(
        _engine, lambda conn: _insert_job(conn, evaluator_experiment_id, job_type="EVALUATOR")
    )
    await _run_async(_engine, lambda conn: _insert_evaluator_task(conn, evaluator_experiment_id))
    with pytest.raises(Exception, match="valid_type"):
        await _run_async(
            _engine,
            lambda conn: _insert_evaluator_task(conn, prompt_experiment_id, task_type="PROMPT"),
        )
    with pytest.raises(Exception, match="valid_evaluator_kind"):
        await _run_async(
            _engine,
            lambda conn: _insert_evaluator_task(
                conn, evaluator_experiment_id, evaluator_kind="HUMAN"
            ),
        )
    assert await _run_async(_engine, _count_evaluator_tasks) == 1

    # The downgrade refuses while an EVALUATOR job exists, and leaves the schema in place;
    # the CHECK narrowing runs first so nothing else of the migration is undone.
    with pytest.raises(Exception, match="valid_type"):
        await _down(_engine, _alembic_config, _DOWN, _schema)
    assert await _run_async(_engine, _count_evaluator_tasks) == 1
    # SQLite batch mode copies the table through a temporary one, and the test connection
    # commits that DDL before the failing copy, so the leftover has to go before retrying.
    await _run_async(_engine, _drop_batch_leftover)

    # Without EVALUATOR jobs it succeeds, drops the table and narrows the CHECK again.
    await _run_async(_engine, lambda conn: _delete_job(conn, evaluator_experiment_id))
    await _down(_engine, _alembic_config, _DOWN, _schema)
    assert not await _run_async(
        _engine, lambda conn: sa.inspect(conn).has_table("experiment_evaluator_tasks")
    )
    with pytest.raises(Exception, match="valid_type"):
        await _run_async(
            _engine,
            lambda conn: _insert_job(conn, evaluator_experiment_id, job_type="EVALUATOR"),
        )
    # The PROMPT job survived both directions.
    assert (
        await _run_async(
            _engine,
            lambda conn: conn.execute(
                text("SELECT type FROM experiment_jobs WHERE id = :id"),
                {"id": prompt_experiment_id},
            ).scalar(),
        )
        == "PROMPT"
    )


def _insert_experiment(conn: Connection, name: str) -> int:
    now = datetime.now(timezone.utc)
    dataset_id = conn.execute(
        text(
            "INSERT INTO datasets (name, description, metadata, created_at, updated_at) "
            "VALUES (:name, NULL, '{}', :now, :now) RETURNING id"
        ),
        {"name": name, "now": now},
    ).scalar()
    version_id = conn.execute(
        text(
            "INSERT INTO dataset_versions (dataset_id, description, metadata, created_at) "
            "VALUES (:dataset_id, NULL, '{}', :now) RETURNING id"
        ),
        {"dataset_id": dataset_id, "now": now},
    ).scalar()
    experiment_id = conn.execute(
        text(
            "INSERT INTO experiments "
            "(dataset_id, dataset_version_id, name, repetitions, metadata, created_at, updated_at) "
            "VALUES (:dataset_id, :version_id, 'experiment', 1, '{}', :now, :now) RETURNING id"
        ),
        {"dataset_id": dataset_id, "version_id": version_id, "now": now},
    ).scalar()
    conn.commit()
    assert isinstance(experiment_id, int)
    return experiment_id


def _insert_job(conn: Connection, experiment_id: int, *, job_type: str) -> None:
    conn.execute(
        text("INSERT INTO experiment_jobs (id, type) VALUES (:id, :type)"),
        {"id": experiment_id, "type": job_type},
    )
    conn.commit()


def _delete_job(conn: Connection, experiment_id: int) -> None:
    # The test connection does not enforce SQLite foreign keys, so the cascade from the
    # job to its task row is not relied on here.
    conn.execute(
        text("DELETE FROM experiment_evaluator_tasks WHERE id = :id"), {"id": experiment_id}
    )
    conn.execute(text("DELETE FROM experiment_jobs WHERE id = :id"), {"id": experiment_id})
    conn.commit()


def _insert_evaluator_task(
    conn: Connection,
    experiment_id: int,
    *,
    task_type: str = "EVALUATOR",
    evaluator_kind: str = "CODE",
) -> None:
    conn.execute(
        text(
            "INSERT INTO experiment_evaluator_tasks "
            "(id, type, name, evaluator_kind, definition, input_mapping, output_configs) "
            "VALUES (:id, :type, 'judge', :evaluator_kind, '{}', '{}', '[]')"
        ),
        {"id": experiment_id, "type": task_type, "evaluator_kind": evaluator_kind},
    )
    conn.commit()


def _drop_batch_leftover(conn: Connection) -> None:
    conn.execute(text("DROP TABLE IF EXISTS _alembic_tmp_experiment_jobs"))
    conn.commit()


def _count_evaluator_tasks(conn: Connection) -> int:
    count = conn.execute(text("SELECT COUNT(*) FROM experiment_evaluator_tasks")).scalar()
    assert isinstance(count, int)
    return count
