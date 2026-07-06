"""Online-eval consumer daemon.

Runs on every replica; instances compete for work through coordinator claims.
Each cycle claims a batch of work units and processes them concurrently:
hydrate behind the staleness guard (stale units are expired, never executed),
evaluate with lease heartbeats, write annotations, then complete — or fail
with a cooldown. Shutdown drains in-flight evals instead of cancelling them,
so LLM spend already paid gets committed.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Callable, Optional

from sqlalchemy import select

from phoenix.config import get_env_enable_prometheus
from phoenix.db import models
from phoenix.server.dml_event import DmlEvent
from phoenix.server.online_eval.coordinator import (
    HEARTBEAT_INTERVAL_SECONDS,
    ClaimedWorkUnit,
    EvalWorkCoordinator,
)
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.executor import HydratedWorkUnit, OnlineEvalExecutor
from phoenix.server.prometheus import (
    ONLINE_EVAL_FRONTIER_GAP_SPAN_IDS,
    ONLINE_EVAL_INGEST_SPANS_PER_SECOND,
    ONLINE_EVAL_OLDEST_PENDING_AGE_SECONDS,
    ONLINE_EVAL_PENDING_WORK_UNITS,
    ONLINE_EVAL_RUNNING_WORK_UNITS,
)
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.types import CanPutItem, DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

TICK_INTERVAL_SECONDS = 5.0
CLAIM_BATCH_SIZE = 10
ERROR_COOLDOWN_SECONDS = 60.0
DRAIN_TIMEOUT_SECONDS = 10.0


class OnlineEvalConsumer(DaemonTask):
    """Per-replica daemon claiming and executing online-eval work units."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        decrypt: Callable[[bytes], bytes],
        sandbox_session_manager: Optional[SandboxSessionManager] = None,
        event_queue: Optional[CanPutItem[DmlEvent]] = None,
        coordinator: Optional[EvalWorkCoordinator] = None,
        consumer_group: str = "default",
        tick_interval_seconds: float = TICK_INTERVAL_SECONDS,
        claim_batch_size: int = CLAIM_BATCH_SIZE,
    ) -> None:
        super().__init__()
        self._db = db
        self._grain: models.EvalWorkGrain = "SPAN"
        self._consumer_group = consumer_group
        self._coordinator: EvalWorkCoordinator = coordinator or DbEvalWorkCoordinator(
            db, grain=self._grain, consumer_group=self._consumer_group
        )
        self._executor = OnlineEvalExecutor(
            db,
            decrypt=decrypt,
            sandbox_session_manager=sandbox_session_manager,
            event_queue=event_queue,
        )
        self._consumer_id = f"consumer-{token_hex(8)}"
        self._tick_interval_seconds = tick_interval_seconds
        self._claim_batch_size = claim_batch_size
        self._pending_tasks: set[asyncio.Task[None]] = set()
        self._publish_metrics = get_env_enable_prometheus()
        self._last_ingest_sample: Optional[tuple[int, datetime]] = None

    async def _run(self) -> None:
        while self._running:
            try:
                await self._cycle()
            except Exception:
                logger.exception("Online-eval consumer cycle failed")
            if self._publish_metrics:
                try:
                    await self._publish_queue_metrics()
                except Exception:
                    logger.exception("Online-eval queue metrics publish failed")
            await asyncio.sleep(self._tick_interval_seconds)

    async def _publish_queue_metrics(self) -> None:
        lag = await self._coordinator.lag()
        ONLINE_EVAL_PENDING_WORK_UNITS.set(lag.pending_count)
        ONLINE_EVAL_RUNNING_WORK_UNITS.set(lag.running_count)
        ONLINE_EVAL_FRONTIER_GAP_SPAN_IDS.set(lag.frontier_gap)
        ONLINE_EVAL_OLDEST_PENDING_AGE_SECONDS.set(lag.oldest_pending_age_seconds or 0.0)
        async with self._db.read() as session:
            sample = (
                await session.execute(
                    select(
                        models.EvalWorkCursor.observed_high_water_id,
                        models.EvalWorkCursor.observed_at,
                    ).where(
                        models.EvalWorkCursor.grain == self._grain,
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                    )
                )
            ).first()
        if sample is None or sample.observed_high_water_id is None or sample.observed_at is None:
            return
        if self._last_ingest_sample is not None:
            last_high_water, last_observed_at = self._last_ingest_sample
            elapsed = (sample.observed_at - last_observed_at).total_seconds()
            if elapsed > 0:
                ONLINE_EVAL_INGEST_SPANS_PER_SECOND.set(
                    max(sample.observed_high_water_id - last_high_water, 0) / elapsed
                )
        self._last_ingest_sample = (sample.observed_high_water_id, sample.observed_at)

    async def stop(self) -> None:
        self._running = False
        if self._pending_tasks:
            # Wait for in-flight evals without cancelling them: asyncio.wait
            # leaves timed-out tasks running rather than killing them mid-write,
            # and any unit that outlives the grace window is reclaimed through
            # its lapsed lease.
            await asyncio.wait(set(self._pending_tasks), timeout=DRAIN_TIMEOUT_SECONDS)
        await super().stop()

    async def _cycle(self) -> None:
        units = await self._coordinator.claim(
            claimed_by=self._consumer_id,
            limit=self._claim_batch_size,
        )
        if not units:
            return
        tasks = [asyncio.create_task(self._process_unit(unit)) for unit in units]
        for task in tasks:
            self._pending_tasks.add(task)
            task.add_done_callback(self._pending_tasks.discard)
        # asyncio.wait does not propagate this task's cancellation to the unit
        # tasks; a shutdown mid-cycle leaves them to the stop() drain.
        done, _ = await asyncio.wait(tasks)
        for task in done:
            if not task.cancelled() and (exc := task.exception()) is not None:
                logger.error("Online-eval work unit task failed", exc_info=exc)

    async def _process_unit(self, unit: ClaimedWorkUnit) -> None:
        try:
            hydrated = await self._executor.hydrate(unit)
            if hydrated is None:
                await self._coordinator.expire(
                    work_unit_id=unit.work_unit_id,
                    claimed_by=self._consumer_id,
                )
                return
            await self._evaluate_with_heartbeat(unit, hydrated)
        except Exception as exc:
            logger.exception(f"Online-eval work unit {unit.work_unit_id} failed")
            cooldown_until = datetime.now(timezone.utc) + timedelta(
                seconds=ERROR_COOLDOWN_SECONDS * (2**unit.attempts)
            )
            try:
                await self._coordinator.fail(
                    work_unit_id=unit.work_unit_id,
                    claimed_by=self._consumer_id,
                    error=str(exc),
                    cooldown_until=cooldown_until,
                )
            except Exception:
                logger.exception(
                    f"Failed to record failure for online-eval work unit {unit.work_unit_id}"
                )
        else:
            completed = await self._coordinator.complete(
                work_unit_id=unit.work_unit_id,
                claimed_by=self._consumer_id,
            )
            if not completed:
                logger.warning(
                    f"Online-eval work unit {unit.work_unit_id} finished after its claim "
                    "was lost; the annotation write is idempotent"
                )

    async def _evaluate_with_heartbeat(
        self,
        unit: ClaimedWorkUnit,
        hydrated: HydratedWorkUnit,
    ) -> None:
        eval_task = asyncio.create_task(self._executor.evaluate_and_annotate(unit, hydrated))
        try:
            while True:
                done, _ = await asyncio.wait({eval_task}, timeout=HEARTBEAT_INTERVAL_SECONDS)
                if done:
                    break
                # A lost claim does not cancel the eval: the result is still
                # valid under this unit's identifier and the write dedupes
                # against whichever consumer got there first.
                try:
                    await self._coordinator.heartbeat(
                        work_unit_id=unit.work_unit_id,
                        claimed_by=self._consumer_id,
                    )
                except Exception:
                    logger.exception(
                        f"Heartbeat failed for online-eval work unit {unit.work_unit_id}"
                    )
        finally:
            if not eval_task.done():
                eval_task.cancel()
        await eval_task
