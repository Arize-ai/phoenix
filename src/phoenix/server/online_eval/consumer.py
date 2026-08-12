"""Online-eval consumer daemon.

Runs on every replica; instances compete for work through coordinator claims.
Each cycle claims a batch of work units and awaits the whole batch before claiming
again. The batch size bounds fetched work; shared semaphores bound evaluation and
database-phase concurrency across SPAN and SESSION consumers:
hydrate behind the staleness guard (stale units are expired, never executed),
evaluate with lease heartbeats, write annotations, then complete — or fail
with a cooldown. Shutdown gives in-flight evals a grace period, then cancels
stragglers before sandbox teardown.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from secrets import token_hex
from typing import Any, Awaitable, Callable, Optional, TypeVar

from phoenix.config import get_env_enable_prometheus
from phoenix.db import models
from phoenix.server.dml_event import DmlEvent
from phoenix.server.online_eval.coordinator import (
    HEARTBEAT_INTERVAL_SECONDS,
    ClaimedWorkUnit,
    EvalWorkCoordinator,
)
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.executor import (
    ConfigurationSnapshotOutcome,
    HydratedConfigurationSnapshot,
    HydratedWorkUnit,
    HydrationFailure,
    OnlineEvalExecutor,
    OnlineEvalStoragePaused,
    SharedHydrationFailure,
)
from phoenix.server.online_eval.failure_policy import FailureDisposition, classify
from phoenix.server.prometheus import (
    ONLINE_EVAL_EXHAUSTED_ERROR_WORK_UNITS,
    ONLINE_EVAL_EXPIRED_WORK_UNITS,
    ONLINE_EVAL_OLDEST_ACTIONABLE_AGE_SECONDS,
    ONLINE_EVAL_PENDING_WORK_UNITS,
    ONLINE_EVAL_RETRYABLE_ERROR_WORK_UNITS,
    ONLINE_EVAL_RUNNING_WORK_UNITS,
)
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.types import CanPutItem, DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)
_T = TypeVar("_T")

TICK_INTERVAL_SECONDS = 5.0
CLAIM_BATCH_SIZE = 10
ERROR_COOLDOWN_SECONDS = 60.0
DRAIN_TIMEOUT_SECONDS = 10.0
EXECUTION_DEADLINE_SECONDS = 600.0
_CONSUMER_GROUP = "default"

_TRANSITION_RETRY_DELAYS_SECONDS = (1.0, 2.0, 4.0)


class ExecutionTimeoutCause(str, Enum):
    PROVIDER_DEADLINE_EXCEEDED = "PROVIDER_DEADLINE_EXCEEDED"
    EVALUATOR_DEADLINE_EXCEEDED = "EVALUATOR_DEADLINE_EXCEEDED"


class EvalExecutionTimeout(Exception):
    """An online evaluation exceeded its per-unit execution deadline."""

    def __init__(
        self,
        *,
        cause: ExecutionTimeoutCause,
        deadline_seconds: float,
    ) -> None:
        self.cause = cause
        self.deadline_seconds = deadline_seconds
        super().__init__(f"{cause.value}: exceeded {deadline_seconds:g}s deadline")

    @property
    def online_eval_disposition(self) -> FailureDisposition:
        # A provider that never answered is the provider's outage, not this unit's
        # fault; an evaluator that ran too long is.
        return FailureDisposition(
            count_attempt=self.cause is ExecutionTimeoutCause.EVALUATOR_DEADLINE_EXCEEDED
        )


async def _cancel_and_await(task: asyncio.Task[Any]) -> None:
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


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
        evaluator_semaphore: Optional[asyncio.Semaphore] = None,
        db_semaphore: Optional[asyncio.Semaphore] = None,
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
            coordinator=self._coordinator,
            decrypt=decrypt,
            sandbox_session_manager=sandbox_session_manager,
            event_queue=event_queue,
            execution_deadline_seconds=execution_deadline_seconds,
            db_semaphore=db_semaphore,
        )
        self._consumer_id = f"consumer-{token_hex(8)}"
        self._tick_interval_seconds = tick_interval_seconds
        self._claim_batch_size = claim_batch_size
        self._execution_deadline_seconds = execution_deadline_seconds
        self._evaluator_semaphore = evaluator_semaphore or asyncio.Semaphore(claim_batch_size)
        self._db_semaphore = db_semaphore
        self._pending_tasks: set[asyncio.Task[None]] = set()
        self._publish_metrics = get_env_enable_prometheus()

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
        await self._run_db(self._publish_queue_metrics_with_slot)

    async def _publish_queue_metrics_with_slot(self) -> None:
        lag = await self._coordinator.lag()
        labels = {"evaluation_target": self._evaluation_target}
        ONLINE_EVAL_PENDING_WORK_UNITS.labels(**labels).set(lag.pending_count)
        ONLINE_EVAL_RUNNING_WORK_UNITS.labels(**labels).set(lag.running_count)
        ONLINE_EVAL_RETRYABLE_ERROR_WORK_UNITS.labels(**labels).set(lag.retryable_error_count)
        ONLINE_EVAL_EXHAUSTED_ERROR_WORK_UNITS.labels(**labels).set(lag.exhausted_error_count)
        ONLINE_EVAL_EXPIRED_WORK_UNITS.labels(**labels).set(lag.expired_count)
        ONLINE_EVAL_OLDEST_ACTIONABLE_AGE_SECONDS.labels(**labels).set(
            lag.oldest_actionable_age_seconds or 0.0
        )

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
        if self._db.should_not_insert_or_update:
            return
        units = await self._run_db(
            lambda: self._coordinator.claim(
                claimed_by=self._consumer_id,
                limit=self._claim_batch_size,
            )
        )
        if not units:
            return
        try:
            configurations = await self._executor.hydrate_configuration_snapshots(units)
            # Nothing awaits between here and the last create_task, so every claimed
            # unit is covered either by this handler or by its own task.
            tasks = [
                asyncio.create_task(self._process_unit(unit, configuration))
                for unit, configuration in zip(units, configurations, strict=True)
            ]
        except asyncio.CancelledError:
            # Batch hydration runs before any task exists, so stop()'s drain cannot
            # see these claims; releasing them keeps a shutdown from charging an
            # attempt to work that never started.
            for unit in units:
                await self._release_claim(unit)
            raise
        for task in tasks:
            self._pending_tasks.add(task)
            task.add_done_callback(self._pending_tasks.discard)
        # asyncio.wait does not propagate this task's cancellation to the unit
        # tasks; a shutdown mid-cycle leaves them to the stop() drain.
        done, _ = await asyncio.wait(tasks)
        for task in done:
            if not task.cancelled() and (exc := task.exception()) is not None:
                logger.error("Online-eval work unit task failed", exc_info=exc)

    async def _run_db(self, operation: Callable[[], Awaitable[_T]]) -> _T:
        if self._db_semaphore is None:
            return await operation()
        async with self._db_semaphore:
            return await operation()

    async def _process_unit(
        self,
        unit: ClaimedWorkUnit,
        configuration: Optional[ConfigurationSnapshotOutcome] = None,
    ) -> None:
        # The guard wraps the whole lifecycle, including the terminal transition:
        # a cancel delivered while a transition retries would otherwise escape from
        # inside an exception handler, past any sibling handler, holding the claim.
        try:
            await self._execute_unit(unit, configuration)
        except asyncio.CancelledError:
            await self._release_claim(unit)
            raise

    async def _release_claim(self, unit: ClaimedWorkUnit) -> None:
        """Return a claim to PENDING without counting an attempt, shielded so the
        release survives the cancellation that prompted it."""
        try:
            released = await asyncio.shield(
                self._run_db(
                    lambda: self._coordinator.release(
                        work_unit_id=unit.work_unit_id,
                        claimed_by=self._consumer_id,
                    )
                )
            )
            if not released:
                logger.warning(
                    f"Online-eval work unit {unit.work_unit_id} could not be released after "
                    "its claim was lost"
                )
        except Exception:
            logger.exception(
                f"Failed to release cancelled online-eval work unit {unit.work_unit_id}; "
                "leaving the row for lease-lapse reclaim"
            )

    async def _heartbeat(self, work_unit_id: int) -> bool:
        """Renew a lease outside the shared db semaphore: queueing liveness behind
        the bulk work it reports on turns saturation into correlated lease loss."""
        return await self._coordinator.heartbeat(
            work_unit_id=work_unit_id,
            claimed_by=self._consumer_id,
        )

    async def _acquire_with_heartbeat(
        self,
        unit: ClaimedWorkUnit,
        semaphore: asyncio.Semaphore,
    ) -> None:
        """Acquire a permit while keeping the lease alive. The queue is unbounded —
        the execution deadline only starts once a permit is held — but the lease
        started at claim time, so an unheartbeated wait silently loses the claim."""
        acquisition = asyncio.create_task(semaphore.acquire())
        heartbeat_enabled = True
        while True:
            try:
                done, _ = await asyncio.wait({acquisition}, timeout=HEARTBEAT_INTERVAL_SECONDS)
            except BaseException:
                # A permit granted while the wait was being torn down still has to
                # be handed back, or the limiter leaks capacity on every shutdown.
                if acquisition.done():
                    if not acquisition.cancelled() and acquisition.exception() is None:
                        semaphore.release()
                else:
                    await _cancel_and_await(acquisition)
                raise
            if done:
                await acquisition
                return
            if not heartbeat_enabled:
                continue
            try:
                if not await self._heartbeat(unit.work_unit_id):
                    logger.warning(
                        f"Online-eval work unit {unit.work_unit_id} heartbeat stopped after "
                        "its claim was lost while queued for an evaluator permit"
                    )
                    heartbeat_enabled = False
            except Exception:
                logger.exception(
                    f"Heartbeat failed for queued online-eval work unit {unit.work_unit_id}"
                )

    async def _execute_unit(
        self,
        unit: ClaimedWorkUnit,
        configuration: Optional[ConfigurationSnapshotOutcome] = None,
    ) -> None:
        hydrated_work_unit: Optional[HydratedWorkUnit] = None
        try:
            if configuration is None:
                hydrated = await self._executor.hydrate(unit)
            elif isinstance(configuration, SharedHydrationFailure):
                await self._release_claim(unit)
                return
            elif isinstance(configuration, Exception):
                raise configuration
            elif isinstance(configuration, HydratedConfigurationSnapshot):
                hydrated = self._executor.hydrate_from_snapshot(configuration)
            else:
                hydrated = configuration
            if isinstance(hydrated, HydrationFailure):
                error = hydrated.reason.value
                if hydrated.detail:
                    error = f"{error}: {hydrated.detail}"
                expired = await self._retry_transition(
                    action="expire",
                    work_unit_id=unit.work_unit_id,
                    transition=lambda: self._coordinator.expire(
                        work_unit_id=unit.work_unit_id,
                        claimed_by=self._consumer_id,
                        error=error,
                    ),
                )
                if not expired:
                    logger.warning(
                        f"Online-eval work unit {unit.work_unit_id} could not expire after its "
                        "claim was lost"
                    )
                return
            hydrated_work_unit = hydrated
            await self._acquire_with_heartbeat(unit, self._evaluator_semaphore)
            try:
                await self._evaluate_with_heartbeat(unit, hydrated)
            finally:
                self._evaluator_semaphore.release()
        except OnlineEvalStoragePaused:
            released = await self._retry_transition(
                action="pause",
                work_unit_id=unit.work_unit_id,
                transition=lambda: self._coordinator.release(
                    work_unit_id=unit.work_unit_id,
                    claimed_by=self._consumer_id,
                ),
            )
            if not released:
                logger.warning(
                    f"Online-eval work unit {unit.work_unit_id} could not pause after its "
                    "claim was lost"
                )
        except Exception as exc:
            disposition = classify(exc, hydrated_work_unit)
            if disposition.terminal:
                logger.error(
                    f"Online-eval work unit {unit.work_unit_id} reached terminal state "
                    f"{disposition.code}",
                    exc_info=exc,
                )
                expired = await self._retry_transition(
                    action="record terminal failure",
                    work_unit_id=unit.work_unit_id,
                    transition=lambda: self._coordinator.expire(
                        work_unit_id=unit.work_unit_id,
                        claimed_by=self._consumer_id,
                        error=disposition.error,
                    ),
                )
                if not expired:
                    logger.warning(
                        f"Online-eval work unit {unit.work_unit_id} terminal failure was not "
                        "recorded after its claim was lost"
                    )
                return
            count_attempt = disposition.count_attempt
            error = disposition.error
            transient = not count_attempt
            logger.exception(
                f"Online-eval work unit {unit.work_unit_id} failed "
                f"({'counting an attempt' if count_attempt else 'will retry without counting an attempt'})"  # noqa: E501
            )
            # Transient failures cool down flat and don't count attempts (an
            # outage retries until it heals); everything else backs off
            # exponentially on the attempt count and exhausts at MAX_ATTEMPTS.
            cooldown_seconds = (
                ERROR_COOLDOWN_SECONDS if transient else ERROR_COOLDOWN_SECONDS * (2**unit.attempts)
            )
            cooldown_until = datetime.now(timezone.utc) + timedelta(seconds=cooldown_seconds)
            failed = await self._retry_transition(
                action="record failure",
                work_unit_id=unit.work_unit_id,
                transition=lambda: self._coordinator.fail(
                    work_unit_id=unit.work_unit_id,
                    claimed_by=self._consumer_id,
                    error=error,
                    cooldown_until=cooldown_until,
                    count_attempt=count_attempt,
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
    ) -> bool:
        retry_index = 0
        while True:
            try:
                return await self._run_db(transition)
            except Exception:
                delay_seconds = _TRANSITION_RETRY_DELAYS_SECONDS[
                    min(retry_index, len(_TRANSITION_RETRY_DELAYS_SECONDS) - 1)
                ]
                retry_index += 1
                logger.warning(
                    f"Failed to {action} for online-eval work unit {work_unit_id}; "
                    f"retrying in {delay_seconds:g}s",
                    exc_info=True,
                )
                try:
                    heartbeat_succeeded = await self._heartbeat(work_unit_id)
                except Exception:
                    logger.warning(
                        f"Failed to heartbeat online-eval work unit {work_unit_id} while "
                        f"retrying {action}",
                        exc_info=True,
                    )
                else:
                    if not heartbeat_succeeded:
                        return False
                await asyncio.sleep(delay_seconds)

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
                        cause=(
                            ExecutionTimeoutCause.PROVIDER_DEADLINE_EXCEEDED
                            if hydrated.evaluator_kind == "LLM"
                            else ExecutionTimeoutCause.EVALUATOR_DEADLINE_EXCEEDED
                        ),
                        deadline_seconds=self._execution_deadline_seconds,
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
                        cause=(
                            ExecutionTimeoutCause.PROVIDER_DEADLINE_EXCEEDED
                            if hydrated.evaluator_kind == "LLM"
                            else ExecutionTimeoutCause.EVALUATOR_DEADLINE_EXCEEDED
                        ),
                        deadline_seconds=self._execution_deadline_seconds,
                    ) from None
                # A lost claim does not cancel the eval immediately. Publication
                # requires current RUNNING ownership and rejects this result if the
                # claim stays lost.
                if not heartbeat_enabled:
                    continue
                try:
                    heartbeat_succeeded = await self._heartbeat(unit.work_unit_id)
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
