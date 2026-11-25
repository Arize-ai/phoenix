import asyncio
import logging
from collections.abc import Coroutine, Sequence
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DbSessionFactory

# Stay well below SQLite's bind-parameter limit (32,766) and asyncpg's (32,767).
_DELETE_BATCH_SIZE = 1000


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


async def _delete_by_column_in_batches(
    db: DbSessionFactory,
    table: type[models.HasId],
    match_column: Mapped[str],
    values: Sequence[str],
) -> list[int]:
    """Delete rows matching ``values`` in bounded batches and return deleted IDs."""
    if not values:
        return []
    unique_values = list(dict.fromkeys(values))
    deleted_ids: list[int] = []
    for start in range(0, len(unique_values), _DELETE_BATCH_SIZE):
        batch = unique_values[start : start + _DELETE_BATCH_SIZE]
        stmt = delete(table).where(match_column.in_(batch)).returning(table.id)
        async with db() as session:
            deleted_ids.extend(await session.scalars(stmt))
    return deleted_ids


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> list[int]:
    return await _delete_by_column_in_batches(
        db=db,
        table=models.Project,
        match_column=models.Project.name,
        values=project_names,
    )


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
) -> list[int]:
    return await _delete_by_column_in_batches(
        db=db,
        table=models.Trace,
        match_column=models.Trace.trace_id,
        values=trace_ids,
    )


async def gather_cleanup_tasks(
    *named_tasks: tuple[str, Coroutine[Any, Any, Any]],
    logger: logging.Logger,
    context: str,
) -> None:
    """Run post-delete cleanup tasks concurrently and log any exceptions."""
    results = await asyncio.gather(
        *(coro for _, coro in named_tasks),
        return_exceptions=True,
    )
    first_base_exc: Optional[BaseException] = None
    for (label, _), result in zip(named_tasks, results):
        if isinstance(result, Exception):
            logger.error("Failed to clean up %s for %s", label, context, exc_info=result)
        elif isinstance(result, BaseException) and first_base_exc is None:
            first_base_exc = result
    if first_base_exc is not None:
        raise first_base_exc
