from __future__ import annotations

import asyncio
import logging
import random
from asyncio import Queue, sleep
from collections.abc import Iterable

from sqlalchemy import delete, select

from phoenix.db import models
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60 * 60  # 1 hour
_JITTER_SECONDS = 60  # plus or minus 1 minute
_DEFAULT_BATCH_SIZE = 500  # chunked queries to avoid long-running locks on active trace databases


async def cleanup_evaluator_project(
    db: DbSessionFactory,
    project_id: int,
    *,
    batch_size: int = _DEFAULT_BATCH_SIZE,
) -> None:
    """Purge an evaluator project and its dependent traces and sessions in chunks.

    Deleting traces in batches of `batch_size` avoids long-running table locks
    on active trace databases during large or bulk deletions.
    """
    logger.debug(f"Starting chunked background cleanup for project {project_id}")

    # 1. Chunked deletion of traces for the project.
    # Cascades to spans, span annotations, trace annotations in bounded chunks.
    total_traces_deleted = 0
    while True:
        async with db() as session:
            trace_batch = (
                select(models.Trace.id)
                .where(models.Trace.project_rowid == project_id)
                .limit(batch_size)
            )
            stmt = delete(models.Trace).where(models.Trace.id.in_(trace_batch))
            result = await session.execute(stmt)
            num_deleted: int = result.rowcount  # type: ignore[attr-defined]
        total_traces_deleted += num_deleted
        if num_deleted < batch_size:
            break

    # 2. Chunked deletion of orphan project sessions for the project.
    total_sessions_deleted = 0
    while True:
        async with db() as session:
            session_batch = (
                select(models.ProjectSession.id)
                .where(models.ProjectSession.project_id == project_id)
                .limit(batch_size)
            )
            stmt = delete(models.ProjectSession).where(models.ProjectSession.id.in_(session_batch))
            result = await session.execute(stmt)
            num_deleted = result.rowcount  # type: ignore[attr-defined]
        total_sessions_deleted += num_deleted
        if num_deleted < batch_size:
            break

    # 3. Delete the project record itself once child rows are drained.
    async with db() as session:
        await session.execute(delete(models.Project).where(models.Project.id == project_id))

    logger.debug(
        f"Finished background cleanup for project {project_id}: "
        f"deleted {total_traces_deleted} traces, {total_sessions_deleted} sessions."
    )


async def cleanup_evaluator_projects(
    db: DbSessionFactory,
    project_ids: Iterable[int],
    *,
    batch_size: int = _DEFAULT_BATCH_SIZE,
) -> None:
    """Clean up multiple evaluator projects in sequence."""
    for project_id in project_ids:
        try:
            await cleanup_evaluator_project(db, project_id, batch_size=batch_size)
        except Exception:
            logger.exception(f"Failed to clean up evaluator project {project_id}")


class EvaluatorSweeper(DaemonTask):
    """
    Periodically cleans up orphaned evaluator projects and drains immediate
    background deletions using chunked queries to avoid long-running locks.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db
        self._pending_project_ids: Queue[int] = Queue()

    def enqueue_project_cleanup(self, *project_ids: int) -> None:
        """Enqueue project IDs for background cleanup."""
        for pid in project_ids:
            self._pending_project_ids.put_nowait(pid)

    async def drain(self) -> None:
        """Wait until all queued project cleanups have been processed."""
        while not self._pending_project_ids.empty():
            try:
                project_id = self._pending_project_ids.get_nowait()
            except Exception:
                break
            try:
                await cleanup_evaluator_project(self._db, project_id)
            except Exception:
                logger.exception(f"Failed to clean up evaluator project {project_id}")
            finally:
                self._pending_project_ids.task_done()
        await self._pending_project_ids.join()

    async def _consume_queue(self) -> None:
        while self._running:
            try:
                project_id = await self._pending_project_ids.get()
            except (asyncio.CancelledError, GeneratorExit):
                break
            try:
                await cleanup_evaluator_project(self._db, project_id)
            except Exception:
                logger.exception(f"Failed to clean up evaluator project {project_id}")
            finally:
                self._pending_project_ids.task_done()

    async def _sweep_loop(self) -> None:
        while self._running:
            try:
                await self._sweep_orphaned_evaluator_projects()
            except (asyncio.CancelledError, GeneratorExit):
                break
            except Exception:
                logger.exception("Failed to sweep orphaned evaluator projects")
            try:
                await sleep(_SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS))
            except (asyncio.CancelledError, GeneratorExit):
                break

    async def _run(self) -> None:
        queue_task = asyncio.create_task(self._consume_queue())
        sweep_task = asyncio.create_task(self._sweep_loop())
        try:
            await asyncio.gather(queue_task, sweep_task)
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            queue_task.cancel()
            sweep_task.cancel()
            await asyncio.gather(queue_task, sweep_task, return_exceptions=True)

    async def _sweep_orphaned_evaluator_projects(self) -> None:
        """Find and remove evaluator projects unreferenced by any dataset evaluator."""
        async with self._db() as session:
            orphaned_projects_stmt = (
                select(models.Project.id)
                .where(
                    models.Project.name.like("dataset-evaluator-%"),
                    ~select(models.DatasetEvaluators.id)
                    .where(models.DatasetEvaluators.project_id == models.Project.id)
                    .exists(),
                )
                .limit(100)
            )
            orphaned_project_ids = list((await session.scalars(orphaned_projects_stmt)).all())

        for project_id in orphaned_project_ids:
            try:
                await cleanup_evaluator_project(self._db, project_id)
            except Exception:
                logger.exception(f"Failed to sweep orphaned evaluator project {project_id}")
