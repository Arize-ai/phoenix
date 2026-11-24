from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import delete, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import (
    SupportedSQLDialect,
    get_eval_trace_ids_for_datasets,
    get_project_names_for_datasets,
)
from phoenix.server.types import DbSessionFactory

if TYPE_CHECKING:
    from phoenix.server.daemons.experiment_runner import ExperimentRunner


async def delete_traces_and_orphan_sessions(
    session: AsyncSession,
    project_rowid: int,
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> int:
    """Bulk-delete a project's traces, then delete the project's sessions that
    no longer have any traces. Returns the number of traces deleted.

    Traces whose ``start_time`` falls within ``[start_time, end_time)`` are
    deleted; either bound may be omitted to leave that side unbounded. Spans
    are cascade-deleted with their traces, but trace deletion does not cascade
    upward to ``project_sessions``, so sessions emptied by the delete would
    linger as ghosts in the sessions UI. Only trace-less sessions are deleted:
    a bounded delete can leave newer traces in a surviving session, and
    deleting that session would cascade-delete those traces
    (``traces.project_session_rowid`` is ``ON DELETE CASCADE``).

    The trace delete has no RETURNING clause on purpose: collecting the
    deleted rows' session ids buffers one row per deleted trace in the server
    process (OOM on large PostgreSQL deletes, see #13906). The orphan sweep is
    instead one set-based delete scoped to the project. On PostgreSQL,
    candidate sessions are locked with FOR UPDATE SKIP LOCKED so a session
    being resumed by in-flight ingestion is skipped this pass instead of
    cascade-deleting the just-committed trace; the hourly TraceDataSweeper
    removes anything skipped. SQLite serializes writers, so the race cannot
    occur there.
    """
    trace_delete = delete(models.Trace).where(models.Trace.project_rowid == project_rowid)
    if start_time is not None:
        trace_delete = trace_delete.where(models.Trace.start_time >= start_time)
    if end_time is not None:
        trace_delete = trace_delete.where(models.Trace.start_time < end_time)
    result = await session.execute(trace_delete)
    deleted_trace_count: int = result.rowcount  # type: ignore[attr-defined]

    orphan_session_ids = (
        select(models.ProjectSession.id)
        .where(models.ProjectSession.project_id == project_rowid)
        .where(
            ~select(literal(1))
            .where(models.Trace.project_session_rowid == models.ProjectSession.id)
            .exists()
        )
    )
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    if dialect is SupportedSQLDialect.POSTGRESQL:
        orphan_session_ids = orphan_session_ids.with_for_update(skip_locked=True)
    await session.execute(
        delete(models.ProjectSession).where(models.ProjectSession.id.in_(orphan_session_ids))
    )
    return deleted_trace_count


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> list[int]:
    if not project_names:
        return []
    stmt = (
        delete(models.Project)
        .where(models.Project.name.in_(set(project_names)))
        .returning(models.Project.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
) -> list[int]:
    if not trace_ids:
        return []
    stmt = (
        delete(models.Trace)
        .where(models.Trace.trace_id.in_(set(trace_ids)))
        .returning(models.Trace.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


@dataclass(frozen=True)
class DeletedDatasetData:
    dataset: models.Dataset
    project_names: list[str]
    eval_trace_ids: list[str]


async def delete_dataset_and_stop_experiments(
    *,
    db: DbSessionFactory,
    experiment_runner: ExperimentRunner,
    dataset_id: int,
) -> Optional[DeletedDatasetData]:
    """Stop running experiments for a dataset and delete the dataset record.

    Stops every experiment belonging to the dataset before opening the delete
    transaction so in-flight writes drain before cascade deletion removes their
    target rows. After the delete commits, stops every deleted experiment again
    so any run started or resumed between the initial stop and the delete is
    also halted.
    """
    experiment_ids_stmt = select(models.Experiment.id).where(
        models.Experiment.dataset_id == dataset_id
    )
    async with db() as session:
        initial_experiment_ids = list(await session.scalars(experiment_ids_stmt))

    for exp_id in initial_experiment_ids:
        await experiment_runner.stop_experiment(exp_id)

    project_names_stmt = get_project_names_for_datasets(dataset_id)
    eval_trace_ids_stmt = get_eval_trace_ids_for_datasets(dataset_id)
    async with db() as session:
        if db.dialect is SupportedSQLDialect.POSTGRESQL:
            # Lock the dataset row first so concurrent experiment creation cannot
            # commit after the pre-delete queries and bypass post-delete stop cleanup.
            await session.execute(
                select(models.Dataset.id).where(models.Dataset.id == dataset_id).with_for_update()
            )
        project_names = [
            name for name in await session.scalars(project_names_stmt) if name is not None
        ]
        eval_trace_ids = [
            trace_id
            for trace_id in await session.scalars(eval_trace_ids_stmt)
            if trace_id is not None
        ]
        deleted_experiment_ids = list(
            await session.scalars(
                delete(models.Experiment)
                .where(models.Experiment.dataset_id == dataset_id)
                .returning(models.Experiment.id)
            )
        )
        dataset = await session.scalar(
            delete(models.Dataset).where(models.Dataset.id == dataset_id).returning(models.Dataset)
        )
        if dataset is None:
            return None

    for exp_id in dict.fromkeys([*initial_experiment_ids, *deleted_experiment_ids]):
        await experiment_runner.stop_experiment(exp_id)

    return DeletedDatasetData(
        dataset=dataset,
        project_names=project_names,
        eval_trace_ids=eval_trace_ids,
    )
