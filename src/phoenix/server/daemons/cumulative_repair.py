from __future__ import annotations

import logging
from asyncio import sleep

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.cumulative import recompute_trace_cumulative_values
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60.0
_BATCH_SIZE = 100


class CumulativeRepairTask(DaemonTask):
    """
    Periodically recomputes cumulative span counts for all traces.

    This is a safety-net daemon: the primary path (`recompute_trace_cumulative_values`
    called from `BulkInserter._insert_spans`) keeps cumulative values correct during normal
    ingestion. This daemon repairs any traces whose cumulative values may have been left
    stale by an interrupted batch (e.g., app crash mid-insert).

    PostgreSQL only — skipped entirely on SQLite (no row-level locking available).
    Uses SELECT ... FOR UPDATE SKIP LOCKED to avoid contending with active insertions.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        sleep_seconds: float = _SLEEP_SECONDS,
        batch_size: int = _BATCH_SIZE,
    ) -> None:
        super().__init__()
        self._db = db
        self._sleep_seconds = sleep_seconds
        self._batch_size = batch_size

    async def _run(self) -> None:
        if self._db.dialect is not SupportedSQLDialect.POSTGRESQL:
            return

        while self._running:
            try:
                await self._repair_batch()
            except Exception:
                logger.exception("CumulativeRepairTask: error during repair batch")
            await sleep(self._sleep_seconds)

    async def _repair_batch(self) -> None:
        """Recompute cumulative values for one batch of traces."""
        async with self._db() as session:
            # SELECT a batch of trace rowids, locking only rows not held by active writers.
            trace_rowids_result = await session.execute(
                select(models.Trace.id)
                .order_by(models.Trace.id)
                .limit(self._batch_size)
                .with_for_update(skip_locked=True)
            )
            trace_rowids: set[int] = {row[0] for row in trace_rowids_result}
            if not trace_rowids:
                return
            await recompute_trace_cumulative_values(session, trace_rowids)
