from __future__ import annotations

import logging
import random
from asyncio import sleep
from datetime import datetime, timedelta, timezone
from typing import Optional

import sqlalchemy as sa

from phoenix.config import EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, get_eval_trace_ids_for_experiments
from phoenix.server.cleanup.lifecycle import (
    delete_standalone_traces_by_trace_id,
    lock_experiment_projects,
    resolve_experiment_project_delete_candidates,
    tombstone_exclusive_experiment_projects,
)
from phoenix.server.cleanup.primitives import CLEANUP_BATCH_ROWS
from phoenix.server.dml_event import (
    DmlEvent,
    ExperimentDeleteEvent,
    ProjectDeleteEvent,
    SpanDeleteEvent,
)
from phoenix.server.types import CanPutItem, DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60 * 60  # 1 hour
_JITTER_SECONDS = 60  # plus or minus 1 minute


class ExperimentSweeper(DaemonTask):
    """
    Periodically deletes ephemeral experiments that were last updated more than
    EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS ago, along with their associated
    projects and traces.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        event_queue: Optional[CanPutItem[DmlEvent]] = None,
    ) -> None:
        super().__init__()
        self._db = db
        self._event_queue = event_queue

    async def _run(self) -> None:
        while self._running:
            try:
                await self._delete_ephemeral_experiments()
            except Exception:
                logger.exception("Failed to clean up ephemeral experiments")
            await sleep(_SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS))

    async def _delete_ephemeral_experiments(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(
            hours=EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS
        )
        dialect = SupportedSQLDialect(self._db.dialect.value)
        deleted_experiment_ids: list[int] = []
        eval_trace_ids: list[str] = []
        enqueued_projects: list[int] = []
        async with self._db() as session:
            candidate_stmt = (
                sa.select(models.Experiment.id)
                .where(
                    models.Experiment.is_ephemeral.is_(True),
                    models.Experiment.updated_at < cutoff,
                )
                .order_by(models.Experiment.id.asc())
            )
            candidate_experiment_ids = [
                int(experiment_id)
                for experiment_id in (await session.scalars(candidate_stmt)).all()
            ]
            if not candidate_experiment_ids:
                return

            candidate_project_ids: set[int] = set()
            for chunk_start in range(0, len(candidate_experiment_ids), CLEANUP_BATCH_ROWS):
                chunk_ids = candidate_experiment_ids[chunk_start : chunk_start + CLEANUP_BATCH_ROWS]
                candidate_project_ids.update(
                    await resolve_experiment_project_delete_candidates(
                        session,
                        candidate_project_names=(
                            await session.scalars(
                                sa.select(models.Experiment.project_name).where(
                                    models.Experiment.id.in_(chunk_ids)
                                )
                            )
                        ).all(),
                    )
                )
            # Project locks come before experiment row locks, matching dataset delete.
            await lock_experiment_projects(session, candidate_project_ids=candidate_project_ids)
            if dialect is SupportedSQLDialect.POSTGRESQL:
                # Only experiments whose projects were locked above may be row-locked.
                candidate_experiment_ids = [
                    int(experiment_id)
                    for experiment_id in (
                        await session.scalars(
                            candidate_stmt.where(
                                models.Experiment.id.in_(candidate_experiment_ids)
                            ).with_for_update(skip_locked=True)
                        )
                    ).all()
                ]

            for chunk_start in range(0, len(candidate_experiment_ids), CLEANUP_BATCH_ROWS):
                chunk_ids = candidate_experiment_ids[chunk_start : chunk_start + CLEANUP_BATCH_ROWS]
                chunk_eval_trace_ids = (
                    await session.scalars(get_eval_trace_ids_for_experiments(*chunk_ids))
                ).all()
                eval_trace_ids.extend(trace_id for trace_id in chunk_eval_trace_ids if trace_id)
                deleted_rows = (
                    await session.execute(
                        sa.delete(models.Experiment)
                        .where(
                            models.Experiment.id.in_(chunk_ids),
                            models.Experiment.is_ephemeral.is_(True),
                            models.Experiment.updated_at < cutoff,
                        )
                        .returning(models.Experiment.id)
                    )
                ).all()
                for row in deleted_rows:
                    deleted_experiment_ids.append(int(row.id))

            if candidate_project_ids:
                enqueued_projects = await tombstone_exclusive_experiment_projects(
                    session,
                    candidate_project_ids=candidate_project_ids,
                )
        if enqueued_projects:
            if self._event_queue is not None:
                tombstoned_ids = tuple(enqueued_projects)
                self._event_queue.put(SpanDeleteEvent(tombstoned_ids))
                self._event_queue.put(ProjectDeleteEvent(tombstoned_ids))
        if deleted_experiment_ids and self._event_queue is not None:
            self._event_queue.put(ExperimentDeleteEvent(tuple(deleted_experiment_ids)))
        if eval_trace_ids:
            await delete_standalone_traces_by_trace_id(
                self._db,
                eval_trace_ids,
                event_queue=self._event_queue,
            )
        if deleted_experiment_ids:
            logger.info(f"Deleted {len(deleted_experiment_ids)} ephemeral experiment(s).")
