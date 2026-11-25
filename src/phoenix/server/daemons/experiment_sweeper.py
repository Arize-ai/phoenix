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
        num_deleted = 0
        while True:
            num_deleted_in_batch = await self._delete_ephemeral_experiment_batch(cutoff)
            num_deleted += num_deleted_in_batch
            if num_deleted_in_batch < CLEANUP_BATCH_ROWS:
                break
        if num_deleted:
            logger.info(f"Deleted {num_deleted} ephemeral experiment(s).")

    async def _delete_ephemeral_experiment_batch(self, cutoff: datetime) -> int:
        dialect = SupportedSQLDialect(self._db.dialect.value)
        enqueued_projects: list[int] = []
        async with self._db() as session:
            candidate_stmt = (
                sa.select(models.Experiment.id)
                .where(
                    models.Experiment.is_ephemeral.is_(True),
                    models.Experiment.updated_at < cutoff,
                )
                .order_by(models.Experiment.id.asc())
                .limit(CLEANUP_BATCH_ROWS)
            )
            candidate_experiment_ids = [
                int(experiment_id)
                for experiment_id in (await session.scalars(candidate_stmt)).all()
            ]
            if not candidate_experiment_ids:
                return 0

            candidate_project_ids = set(
                await resolve_experiment_project_delete_candidates(
                    session,
                    candidate_project_names=(
                        await session.scalars(
                            sa.select(models.Experiment.project_name).where(
                                models.Experiment.id.in_(candidate_experiment_ids)
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
                if not candidate_experiment_ids:
                    return 0

            eval_trace_ids = [
                trace_id
                for trace_id in (
                    await session.scalars(
                        get_eval_trace_ids_for_experiments(*candidate_experiment_ids)
                    )
                ).all()
                if trace_id
            ]
            deleted_rows = (
                await session.execute(
                    sa.delete(models.Experiment)
                    .where(
                        models.Experiment.id.in_(candidate_experiment_ids),
                        models.Experiment.is_ephemeral.is_(True),
                        models.Experiment.updated_at < cutoff,
                    )
                    .returning(models.Experiment.id, models.Experiment.project_name)
                )
            ).all()
            deleted_experiment_ids = [int(row.id) for row in deleted_rows]
            # Only projects of experiments deleted here may be tombstoned; a project whose
            # experiment was deleted by a user who kept it must stay live.
            deleted_project_ids = candidate_project_ids.intersection(
                await resolve_experiment_project_delete_candidates(
                    session,
                    candidate_project_names=[row.project_name for row in deleted_rows],
                )
            )
            if deleted_project_ids:
                enqueued_projects = await tombstone_exclusive_experiment_projects(
                    session,
                    candidate_project_ids=deleted_project_ids,
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
        return len(deleted_experiment_ids)
