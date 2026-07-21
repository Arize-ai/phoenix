"""Online-eval consumer daemon.

Runs on every replica; instances compete for work through coordinator claims.
Each cycle claims a batch of work units and processes them concurrently:
hydrate behind the staleness guard (stale units are expired, never executed),
evaluate with lease heartbeats, write annotations, then complete — or fail
with a cooldown. Shutdown gives in-flight evals a grace period, then cancels
stragglers before sandbox teardown.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Awaitable, Callable, Optional

import httpx
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
    ONLINE_EVAL_EXHAUSTED_ERROR_WORK_UNITS,
    ONLINE_EVAL_FRONTIER_GAP_SPAN_IDS,
    ONLINE_EVAL_INGEST_SPANS_PER_SECOND,
    ONLINE_EVAL_OLDEST_PENDING_AGE_SECONDS,
    ONLINE_EVAL_PENDING_WORK_UNITS,
    ONLINE_EVAL_RETRYABLE_ERROR_WORK_UNITS,
    ONLINE_EVAL_RUNNING_WORK_UNITS,
    ONLINE_EVAL_SESSION_EXHAUSTED_ERROR_WORK_UNITS,
    ONLINE_EVAL_SESSION_OLDEST_PENDING_AGE_SECONDS,
    ONLINE_EVAL_SESSION_PENDING_WORK_UNITS,
    ONLINE_EVAL_SESSION_RETRYABLE_ERROR_WORK_UNITS,
    ONLINE_EVAL_SESSION_RUNNING_WORK_UNITS,
)
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.types import CanPutItem, DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

TICK_INTERVAL_SECONDS = 5.0
CLAIM_BATCH_SIZE = 10
ERROR_COOLDOWN_SECONDS = 60.0
DRAIN_TIMEOUT_SECONDS = 10.0
EXECUTION_DEADLINE_SECONDS = 600.0
_CONSUMER_GROUP = "default"

_TRANSIENT_HTTP_STATUS_CODES = frozenset({408, 429})
_TRANSITION_RETRY_DELAYS_SECONDS = (1.0, 2.0, 4.0)


class EvalExecutionTimeout(Exception):
    """An online evaluation exceeded its per-unit execution deadline."""


async def _cancel_and_await(task: asyncio.Task[None]) -> None:
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def is_transient_error(exc: BaseException) -> bool:
    """Best-effort classification of failures that heal on their own —
    provider outages, rate limits, network partitions. Transient failures
    retry after a flat cooldown WITHOUT counting toward MAX_ATTEMPTS, so an
    outage longer than the retry budget cannot permanently exhaust queued
    work. Anything unrecognized counts attempts as usual, which keeps poison
    units bounded (fail-safe default). Walks the exception chain so wrapped
    errors (e.g. ``EvalExecutionError`` raised from an httpx timeout)
    classify by their root cause."""
    seen: set[int] = set()
    node: Optional[BaseException] = exc
    while node is not None and id(node) not in seen:
        seen.add(id(node))
        # asyncio.TimeoutError is an alias of TimeoutError on 3.11+ but a
        # distinct class on 3.10.
        if isinstance(node, (ConnectionError, TimeoutError, asyncio.TimeoutError)):
            return True
        if isinstance(node, httpx.TransportError):
            return True
        # Provider SDK errors (openai, anthropic, ...) expose status_code
        # directly; httpx.HTTPStatusError exposes it via .response.
        status_code = getattr(node, "status_code", None)
        if status_code is None:
            status_code = getattr(getattr(node, "response", None), "status_code", None)
        if isinstance(status_code, int) and (
            status_code >= 500 or status_code in _TRANSIENT_HTTP_STATUS_CODES
        ):
            return True
        if node.__cause__ is not None:
            node = node.__cause__
        elif node.__suppress_context__:
            node = None
        else:
            node = node.__context__
    return False


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
        evaluation_target: models.EvaluationTarget = "SPAN",
        tick_interval_seconds: float = TICK_INTERVAL_SECONDS,
        claim_batch_size: int = CLAIM_BATCH_SIZE,
        execution_deadline_seconds: float = EXECUTION_DEADLINE_SECONDS,
    ) -> None:
        super().__init__()
        self._db = db
        if evaluation_target not in ("SPAN", "SESSION"):
            raise ValueError("Online evaluation consumers support SPAN and SESSION targets")
        self._evaluation_target = evaluation_target
        self._coordinator: EvalWorkCoordinator = coordinator or DbEvalWorkCoordinator(
            db, evaluation_target=self._evaluation_target
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
        self._execution_deadline_seconds = execution_deadline_seconds
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
        if self._evaluation_target == "SESSION":
            ONLINE_EVAL_SESSION_PENDING_WORK_UNITS.set(lag.pending_count)
            ONLINE_EVAL_SESSION_RUNNING_WORK_UNITS.set(lag.running_count)
            ONLINE_EVAL_SESSION_RETRYABLE_ERROR_WORK_UNITS.set(lag.retryable_error_count)
            ONLINE_EVAL_SESSION_EXHAUSTED_ERROR_WORK_UNITS.set(lag.exhausted_error_count)
            ONLINE_EVAL_SESSION_OLDEST_PENDING_AGE_SECONDS.set(
                lag.oldest_pending_age_seconds or 0.0
            )
            return
        ONLINE_EVAL_PENDING_WORK_UNITS.set(lag.pending_count)
        ONLINE_EVAL_RUNNING_WORK_UNITS.set(lag.running_count)
        ONLINE_EVAL_RETRYABLE_ERROR_WORK_UNITS.set(lag.retryable_error_count)
        ONLINE_EVAL_EXHAUSTED_ERROR_WORK_UNITS.set(lag.exhausted_error_count)
        ONLINE_EVAL_FRONTIER_GAP_SPAN_IDS.set(lag.frontier_gap)
        ONLINE_EVAL_OLDEST_PENDING_AGE_SECONDS.set(lag.oldest_pending_age_seconds or 0.0)
        async with self._db.read() as session:
            sample = (
                await session.execute(
                    select(
                        models.EvalWorkCursor.observed_high_water_id,
                        models.EvalWorkCursor.observed_at,
                    ).where(
                        models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                        models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
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
            _, pending = await asyncio.wait(set(self._pending_tasks), timeout=DRAIN_TIMEOUT_SECONDS)
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
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
                expired = await self._coordinator.expire(
                    work_unit_id=unit.work_unit_id,
                    claimed_by=self._consumer_id,
                )
                if not expired:
                    logger.warning(
                        f"Online-eval work unit {unit.work_unit_id} could not expire after its "
                        "claim was lost"
                    )
                return
            await self._evaluate_with_heartbeat(unit, hydrated)
        except Exception as exc:
            transient = is_transient_error(exc)
            logger.exception(
                f"Online-eval work unit {unit.work_unit_id} failed "
                f"({'transient — will retry without counting an attempt' if transient else 'counting an attempt'})"  # noqa: E501
            )
            # Transient failures cool down flat and don't count attempts (an
            # outage retries until it heals); everything else backs off
            # exponentially on the attempt count and exhausts at MAX_ATTEMPTS.
            cooldown_seconds = (
                ERROR_COOLDOWN_SECONDS if transient else ERROR_COOLDOWN_SECONDS * (2**unit.attempts)
            )
            cooldown_until = datetime.now(timezone.utc) + timedelta(seconds=cooldown_seconds)
            error = str(exc)
            failed = await self._retry_transition(
                action="record failure",
                work_unit_id=unit.work_unit_id,
                transition=lambda: self._coordinator.fail(
                    work_unit_id=unit.work_unit_id,
                    claimed_by=self._consumer_id,
                    error=error,
                    cooldown_until=cooldown_until,
                    count_attempt=not transient,
                ),
            )
            if failed is False:
                logger.warning(
                    f"Online-eval work unit {unit.work_unit_id} failure was not recorded "
                    "after its claim was lost"
                )
        else:
            completed = await self._retry_transition(
                action="complete",
                work_unit_id=unit.work_unit_id,
                transition=lambda: self._coordinator.complete(
                    work_unit_id=unit.work_unit_id,
                    claimed_by=self._consumer_id,
                ),
            )
            if completed is False:
                logger.warning(
                    f"Online-eval work unit {unit.work_unit_id} finished after its claim "
                    "was lost; the annotation write is idempotent"
                )

    async def _retry_transition(
        self,
        *,
        action: str,
        work_unit_id: int,
        transition: Callable[[], Awaitable[bool]],
    ) -> Optional[bool]:
        for delay_seconds in _TRANSITION_RETRY_DELAYS_SECONDS:
            try:
                return await transition()
            except Exception:
                logger.warning(
                    f"Failed to {action} for online-eval work unit {work_unit_id}; "
                    f"retrying in {delay_seconds:g}s",
                    exc_info=True,
                )
                await asyncio.sleep(delay_seconds)
        try:
            return await transition()
        except Exception:
            logger.exception(
                f"Failed to {action} for online-eval work unit {work_unit_id} after "
                "3 retries; leaving the row for lease-lapse reclaim"
            )
            return None

    async def _evaluate_with_heartbeat(
        self,
        unit: ClaimedWorkUnit,
        hydrated: HydratedWorkUnit,
    ) -> None:
        eval_task = asyncio.create_task(self._executor.evaluate_and_annotate(unit, hydrated))
        heartbeat_enabled = True
        deadline_at = asyncio.get_running_loop().time() + self._execution_deadline_seconds
        try:
            while True:
                remaining_seconds = deadline_at - asyncio.get_running_loop().time()
                if remaining_seconds <= 0:
                    await _cancel_and_await(eval_task)
                    raise EvalExecutionTimeout(
                        f"evaluation exceeded {self._execution_deadline_seconds:g}s deadline"
                    ) from None
                done, _ = await asyncio.wait(
                    {eval_task},
                    timeout=min(HEARTBEAT_INTERVAL_SECONDS, remaining_seconds),
                )
                if done:
                    break
                if asyncio.get_running_loop().time() >= deadline_at:
                    await _cancel_and_await(eval_task)
                    raise EvalExecutionTimeout(
                        f"evaluation exceeded {self._execution_deadline_seconds:g}s deadline"
                    ) from None
                # A lost claim does not cancel the eval: the result is still
                # valid under this unit's identifier and the write dedupes
                # against whichever consumer got there first.
                if not heartbeat_enabled:
                    continue
                try:
                    heartbeat_succeeded = await self._coordinator.heartbeat(
                        work_unit_id=unit.work_unit_id,
                        claimed_by=self._consumer_id,
                    )
                    if not heartbeat_succeeded:
                        logger.warning(
                            f"Online-eval work unit {unit.work_unit_id} heartbeat stopped after "
                            "its claim was lost"
                        )
                        heartbeat_enabled = False
                except Exception:
                    logger.exception(
                        f"Heartbeat failed for online-eval work unit {unit.work_unit_id}"
                    )
        finally:
            if not eval_task.done():
                await _cancel_and_await(eval_task)
        await eval_task
