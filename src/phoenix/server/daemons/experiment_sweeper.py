from __future__ import annotations

import logging
import random
from asyncio import sleep
from datetime import datetime, timedelta, timezone
from typing import Callable

import sqlalchemy as sa

from phoenix.config import EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.cleanup.lifecycle import admit_exclusive_experiment_projects_delete
from phoenix.server.types import DaemonTask, DbSessionFactory

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
        wake_cleanup_worker: Callable[[], None] = lambda: None,
    ) -> None:
        super().__init__()
        self._db = db
        self._wake_cleanup_worker = wake_cleanup_worker

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
        stmt = (
            sa.delete(models.Experiment)
            .where(models.Experiment.is_ephemeral.is_(True))
            .where(models.Experiment.updated_at < cutoff)
            .returning(models.Experiment.project_id)
        )
        dialect = SupportedSQLDialect(self._db.dialect.value)
        enqueued_projects: list[int] = []
        async with self._db() as session:
            project_ids = (await session.scalars(stmt)).all()
            num_deleted = len(project_ids)
            candidate_project_ids = {pid for pid in project_ids if pid is not None}
            if candidate_project_ids:
                enqueued_projects = await admit_exclusive_experiment_projects_delete(
                    session,
                    dialect=dialect,
                    candidate_project_ids=candidate_project_ids,
                )
        if enqueued_projects:
            self._wake_cleanup_worker()
        if num_deleted:
            logger.info(f"Deleted {num_deleted} ephemeral experiment(s).")
