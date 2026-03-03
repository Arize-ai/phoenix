from __future__ import annotations

import logging
import random
from asyncio import sleep
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from phoenix.config import EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60 * 60  # 1 hour
_JITTER_SECONDS = 60  # plus or minus 1 minute


class ExperimentSweeper(DaemonTask):
    """
    Periodically deletes ephemeral experiments that were created more than
    EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS ago, along with their associated
    projects and traces.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db

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
            .where(models.Experiment.created_at < cutoff)
            .returning(models.Experiment.project_name)
        )
        async with self._db() as session:
            project_names = (await session.scalars(stmt)).all()
            num_deleted = len(project_names)
            non_null_project_names = {
                project_name for project_name in project_names if project_name
            }
            if non_null_project_names:
                await session.execute(
                    sa.delete(models.Project).where(models.Project.name.in_(non_null_project_names))
                )
        if num_deleted:
            logger.info(f"Deleted {num_deleted} ephemeral experiment(s).")
