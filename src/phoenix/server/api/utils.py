from datetime import datetime
from typing import Optional

from sqlalchemy import delete, literal, select

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DbSessionFactory

_TRACE_DELETE_BATCH_SIZE = 1000


async def delete_traces_and_orphan_sessions(
    db: DbSessionFactory,
    project_rowid: int,
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> int:
    """Bulk-delete a project's traces in committed batches, then delete the
    project's sessions that no longer have any traces. Returns the number of
    traces deleted.

    Traces whose ``start_time`` falls within ``[start_time, end_time)`` are
    deleted; either bound may be omitted to leave that side unbounded. Spans
    are cascade-deleted with their traces, but trace deletion does not cascade
    upward to ``project_sessions``, so sessions emptied by the delete would
    linger as ghosts in the sessions UI. Only trace-less sessions are deleted:
    a bounded delete can leave newer traces in a surviving session, and
    deleting that session would cascade-delete those traces
    (``traces.project_session_rowid`` is ``ON DELETE CASCADE``).

    Each batch is deleted in its own transaction so PostgreSQL can recycle the
    WAL the batch produced as soon as that batch commits. One unbounded delete
    instead holds all of its WAL until the caller's transaction commits, and
    on a nearly-full volume the WAL write itself fails and takes the database
    down (#17561). The cost of that bound is atomicity: if a batch fails, the
    batches before it stay deleted. ``clear_project`` and the REST trace-range
    delete therefore clear partially on failure; a retry deletes only the
    remaining traces.

    The trace delete has no RETURNING clause on purpose: collecting the
    deleted rows' session ids buffers one row per deleted trace in the server
    process (OOM on large PostgreSQL deletes, see #13906). Batches are keyed by
    the unique ``id`` rather than by ``start_time`` so a full batch cannot be
    revisited when many traces share a start time. The orphan sweep runs once,
    after the last batch, as a single set-based delete scoped to the project,
    so it cannot re-delete a session whose traces arrived between two batches.
    On PostgreSQL, candidate sessions are locked with FOR UPDATE SKIP LOCKED so
    a session being resumed by in-flight ingestion is skipped this pass instead
    of cascade-deleting the just-committed trace; the hourly TraceDataSweeper
    removes anything skipped. SQLite serializes writers, so the race cannot
    occur there.
    """
    trace_filters = [models.Trace.project_rowid == project_rowid]
    if start_time is not None:
        trace_filters.append(models.Trace.start_time >= start_time)
    if end_time is not None:
        trace_filters.append(models.Trace.start_time < end_time)
    deleted_trace_count = 0
    while True:
        async with db() as session:
            trace_batch_ids = (
                await session.scalars(
                    select(models.Trace.id)
                    .where(*trace_filters)
                    .order_by(models.Trace.id)
                    .limit(_TRACE_DELETE_BATCH_SIZE)
                )
            ).all()
            if not trace_batch_ids:
                break
            result = await session.execute(
                delete(models.Trace).where(models.Trace.id.in_(trace_batch_ids))
            )
            deleted_trace_count += result.rowcount  # type: ignore[attr-defined]

    orphan_session_ids = (
        select(models.ProjectSession.id)
        .where(models.ProjectSession.project_id == project_rowid)
        .where(
            ~select(literal(1))
            .where(models.Trace.project_session_rowid == models.ProjectSession.id)
            .exists()
        )
    )
    if db.dialect is SupportedSQLDialect.POSTGRESQL:
        orphan_session_ids = orphan_session_ids.with_for_update(skip_locked=True)
    async with db() as session:
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
