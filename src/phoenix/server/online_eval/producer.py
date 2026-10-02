"""Online-eval producer daemon.

Materializes span-level eval work units from enabled project evaluators.
The producer runs on every replica. The ``span-producer`` lease is advisory: it keeps
one replica scanning at a time so scans aren't repeated, but no write is fenced on it.
The unique (span, project evaluator) work-unit key absorbs duplicate
inserts. Each tick takes the lease and deletes aged terminal work rows. When a frontier
is due, it also scans the lag-gated span id window per project evaluator and offers the
window's work as one batch: queued if it fits the room the queue has left, otherwise
dropped whole, and the cursor advances either way. A dropped batch leaves no work rows;
the cursor records the newest span ever dropped, ``overflowed_through_id``, and the
recent drop counts. A slow-cadence backstop sweep re-covers a bounded id window behind
the watermark, starting above that newest dropped span, to catch spans that became visible
after their window was scanned, filling only the room the queue has left.

Every cursor write is compare-and-set on the position it read, and a scan (frontier or
backstop) commits only if the cursor still holds the position it scanned against. The
reaper deletes terminal span work below the cursor minus ``backstop_lookback_span_ids``,
so no scan may commit against a position the cursor has left: its inserts could recreate
work whose finished rows were already reaped.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Any, Mapping, Optional, Sequence

from sqlalchemy import Select, delete, exists, func, select, text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import with_polymorphic

from phoenix.config import (
    get_env_enable_prometheus,
    get_env_online_eval_backstop_interval_seconds,
    get_env_online_eval_backstop_lookback_span_ids,
    get_env_online_eval_frontier_lag_seconds,
    get_env_online_eval_max_span_ids_per_tick,
    get_env_online_eval_retention_seconds,
)
from phoenix.db import models
from phoenix.db.eval_work import (
    live_eval_work_index_predicate,
    terminal_eval_work_index_predicate,
)
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.admission import max_queued
from phoenix.server.online_eval.derivation import sample_key
from phoenix.server.online_eval.leases import MaterializerLease, current_database_time
from phoenix.server.online_eval.project_evaluator_resolution import resolve_project_evaluators_bulk
from phoenix.server.online_eval.queue_health import span_overflow_window
from phoenix.server.prometheus import (
    ONLINE_EVAL_FRONTIER_GAP_SPAN_IDS,
    ONLINE_EVAL_INGEST_SPANS_PER_SECOND,
    ONLINE_EVAL_MATERIALIZED_WORK_UNITS,
    ONLINE_EVAL_OVERFLOWED_WORK_UNITS,
)
from phoenix.server.types import DaemonTask, DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter

logger = logging.getLogger(__name__)

TICK_INTERVAL_SECONDS = 10.0

_INSERT_BATCH_SIZE = 1000
_WORK_UNIT_UNIQUE_BY = ("span_rowid", "project_evaluator_id")
_CURSOR_ID = 1


@dataclass(frozen=True)
class _ActiveProjectEvaluator:
    project_evaluator_id: int
    project_id: int
    sampling_rate: float
    span_filter: SpanFilter

    def scan_stmt(self, low_exclusive: int, high_inclusive: int) -> Select[int]:
        stmt = (
            select(models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.project_id)
            .where(models.Span.id > low_exclusive, models.Span.id <= high_inclusive)
        )
        return self.span_filter(stmt)

    def materializable_scan_stmt(self, low_exclusive: int, high_inclusive: int) -> Select[int]:
        return self.scan_stmt(low_exclusive, high_inclusive).where(
            ~exists(
                select(1).where(
                    models.EvalWorkUnit.span_rowid == models.Span.id,
                    models.EvalWorkUnit.project_evaluator_id == self.project_evaluator_id,
                )
            ),
        )

    def sampled(self, span_ids: list[int]) -> list[int]:
        return [sid for sid in span_ids if sample_key(sid) < self.sampling_rate]


def _whole_span_batches(
    evaluator_indexes_by_span: Mapping[int, Sequence[int]],
    max_batch_size: int,
) -> list[list[int]]:
    """Group span ids, in arrival order, into batches of at most ``max_batch_size``
    evaluations without splitting a span. A span with more evaluations than that forms a
    batch alone."""
    batches: list[list[int]] = []
    batch: list[int] = []
    batch_size = 0
    for span_id in sorted(evaluator_indexes_by_span):
        span_size = len(evaluator_indexes_by_span[span_id])
        if batch and batch_size + span_size > max_batch_size:
            batches.append(batch)
            batch, batch_size = [], 0
        batch.append(span_id)
        batch_size += span_size
    if batch:
        batches.append(batch)
    return batches


def _overflowed_counts_with(
    overflowed_counts: Mapping[str, Any],
    dropped: Mapping[int, int],
    now: datetime,
) -> dict[str, dict[str, int]]:
    """The cursor's drop counts with ``dropped`` added to the current minute, keeping only
    the minutes queue health still reads."""
    window = span_overflow_window(overflowed_counts, now)
    if dropped:
        bucket = window.setdefault(now.replace(second=0, microsecond=0), {})
        for project_evaluator_id, count in dropped.items():
            bucket[project_evaluator_id] = bucket.get(project_evaluator_id, 0) + count
    return {
        minute.isoformat(): {
            str(project_evaluator_id): count for project_evaluator_id, count in counts.items()
        }
        for minute, counts in sorted(window.items())
    }


class OnlineEvalProducer(DaemonTask):
    """Materialize SPAN evaluation work from the span arrival log.

    ``produced_through_id`` is a scan position in that log: spans above it are still to be
    scanned, and spans at or below it were scanned for the SPAN project evaluators active
    when the position passed them. It starts at the newest span, so older spans, and spans
    an evaluator missed because it was enabled later, are reached only by the backstop's
    lookback (``backstop_lookback_span_ids``). Session and trace work are
    materialized from entity state instead, by ``EvalSweeper`` — a session or trace
    becomes eligible when it goes quiet, which no position in an arrival log can express.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        tick_interval_seconds: float = TICK_INTERVAL_SECONDS,
    ) -> None:
        super().__init__()
        self._db = db
        self._tick_interval_seconds = tick_interval_seconds
        self._lease = MaterializerLease(db, name="span-producer", holder=f"producer-{token_hex(8)}")
        self._frontier_lag_seconds = get_env_online_eval_frontier_lag_seconds()
        self._backstop_interval_seconds = get_env_online_eval_backstop_interval_seconds()
        self._backstop_lookback_span_ids = get_env_online_eval_backstop_lookback_span_ids()
        self._max_span_ids_per_tick = get_env_online_eval_max_span_ids_per_tick()
        self._retention_seconds = get_env_online_eval_retention_seconds()
        self._max_outstanding = max_queued("SPAN")
        self._last_backstop_at = time.monotonic()
        self._publish_metrics = get_env_enable_prometheus()
        ONLINE_EVAL_MATERIALIZED_WORK_UNITS.labels(evaluation_target="SPAN")
        ONLINE_EVAL_OVERFLOWED_WORK_UNITS.labels(evaluation_target="SPAN")
        self._last_ingest_sample: Optional[tuple[int, datetime]] = None

    async def _run(self) -> None:
        try:
            while self._running:
                try:
                    await self._tick()
                except Exception:
                    logger.exception("Online-eval producer tick failed")
                await asyncio.sleep(self._tick_interval_seconds)
        finally:
            # A second cancellation while stop() drains would abort the release and leave the
            # lease held until its 90 s TTL expires; the shield keeps the release running.
            await asyncio.shield(asyncio.ensure_future(self._lease.release()))

    async def _tick(self) -> None:
        if not await self._lease.acquire():
            return
        async with self._db() as session:
            now = await current_database_time(session, self._db.dialect)
            cursor = await self._load_cursor(session)
        if cursor is None:
            return
        if self._db.should_not_insert_or_update:
            await self._reap(now)
            return
        cursor = await self._clamp_cursor(cursor)
        if cursor is None:
            return
        produced_through_id = cursor.produced_through_id

        await self._reap(now)

        observed_high_water_id = cursor.observed_high_water_id
        pending_observation = (
            observed_high_water_id is not None
            and cursor.observed_at is not None
            and observed_high_water_id > produced_through_id
        )
        frontier: Optional[int] = None
        if (
            pending_observation
            and observed_high_water_id is not None
            and cursor.observed_at is not None
            and (now - cursor.observed_at).total_seconds() >= self._frontier_lag_seconds
        ):
            frontier = min(
                observed_high_water_id,
                produced_through_id + self._max_span_ids_per_tick,
            )

        budget = await self._admission_budget()
        active = await self._load_active_project_evaluators()

        advanced = False
        if frontier is not None:
            if not await self._lease.renew():
                return
            advanced, budget = await self._materialize_and_advance(
                active,
                cursor,
                frontier,
                budget,
                now,
            )
            if advanced:
                produced_through_id = frontier

        observation_consumed = advanced and frontier == observed_high_water_id
        if not pending_observation or observation_consumed:
            await self._record_observation(produced_through_id)
        else:
            await self._refresh_gauges(produced_through_id)

        if budget > 0 and time.monotonic() - self._last_backstop_at >= (
            self._backstop_interval_seconds
        ):
            if not await self._lease.renew():
                return
            await self._backstop_sweep(active, produced_through_id, budget)
            self._last_backstop_at = time.monotonic()

    async def _load_cursor(self, session: AsyncSession) -> Optional[models.EvalSpanCursor]:
        """Read the cursor, starting it at the current span high water on first use."""
        cursor = await session.get(models.EvalSpanCursor, _CURSOR_ID)
        if cursor is not None or self._db.should_not_insert_or_update:
            return cursor
        high_water = await session.scalar(select(func.max(models.Span.id))) or 0
        await session.execute(
            insert_on_conflict(
                {"id": _CURSOR_ID, "produced_through_id": high_water},
                table=models.EvalSpanCursor,
                dialect=self._db.dialect,
                unique_by=("id",),
                on_conflict=OnConflict.DO_NOTHING,
                constraint_name="pk_eval_span_cursors",
            )
        )
        return await session.get(models.EvalSpanCursor, _CURSOR_ID)

    async def _clamp_cursor(self, cursor: models.EvalSpanCursor) -> Optional[models.EvalSpanCursor]:
        """Lower the cursor to the live span high water, or return None if another
        producer moved it since it was loaded."""
        async with self._db() as session:
            max_span_id = await session.scalar(select(func.max(models.Span.id))) or 0
            if max_span_id >= cursor.produced_through_id:
                return cursor
            return await session.scalar(
                update(models.EvalSpanCursor)
                .where(
                    models.EvalSpanCursor.id == _CURSOR_ID,
                    models.EvalSpanCursor.produced_through_id == cursor.produced_through_id,
                )
                .values(
                    produced_through_id=max_span_id,
                    observed_high_water_id=None,
                    observed_at=None,
                )
                .returning(models.EvalSpanCursor)
            )

    async def _reap(self, now: datetime) -> None:
        retention_cutoff = now - timedelta(seconds=self._retention_seconds)
        # Terminal rows inside the backstop lookback window are never deleted,
        # regardless of age — they must remain to block backstop resurrection.
        reap_floor = (
            select(models.EvalSpanCursor.produced_through_id - self._backstop_lookback_span_ids)
            .where(models.EvalSpanCursor.id == _CURSOR_ID)
            .scalar_subquery()
        )
        async with self._db() as session:
            await session.execute(
                delete(models.EvalWorkUnit).where(
                    # SQLite reads a partial index only when the query repeats its predicate.
                    text(terminal_eval_work_index_predicate()),
                    models.EvalWorkUnit.updated_at < retention_cutoff,
                    models.EvalWorkUnit.span_rowid < reap_floor,
                )
            )

    async def _admission_budget(self) -> int:
        # The gate bounds the backlog that will eventually demand consumer
        # capacity — every non-terminal row, not just PENDING: RUNNING rows are
        # claimed but unfinished, and retryable ERROR rows return to the claim
        # pool after cooldown. Under a provider outage the entire pending
        # population migrates into retryable ERROR; a PENDING-only count would
        # see an empty queue and keep materializing into the outage. FAILED rows
        # are terminal (awaiting the reaper) and excluded.
        async with self._db() as session:
            outstanding = (
                select(1)
                .select_from(models.EvalWorkUnit)
                # SQLite reads a partial index only when the query repeats its predicate.
                .where(text(live_eval_work_index_predicate()))
                .limit(self._max_outstanding)
                .subquery()
            )
            outstanding_count = (
                await session.scalar(select(func.count()).select_from(outstanding)) or 0
            )
        return max(0, self._max_outstanding - outstanding_count)

    async def _load_active_project_evaluators(self) -> list[_ActiveProjectEvaluator]:
        """Load and resolve enabled project evaluators into scan-ready form.

        Skip policy: only *persistent* per-evaluator conditions (no resolvable
        version, filter fails to compile) are logged and skipped, so one bad
        project evaluator cannot stall the shared cursor forever. Anything else — e.g. a
        transient DB error during version resolution — propagates and aborts
        the tick without advancing the cursor (fail closed): advancing is an
        implicit claim that every enabled project evaluator either materialized or
        deliberately skipped the window, and a project evaluator that failed to load
        transiently did neither.
        """
        polymorphic_evaluator = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        active: list[_ActiveProjectEvaluator] = []
        async with self._db() as session:
            rows = (
                await session.execute(
                    select(models.ProjectEvaluator, polymorphic_evaluator)
                    .join(
                        polymorphic_evaluator,
                        models.ProjectEvaluator.evaluator_id == polymorphic_evaluator.id,
                    )
                    .where(
                        models.ProjectEvaluator.enabled,
                        models.ProjectEvaluator.evaluation_target == "SPAN",
                    )
                )
            ).all()
            project_evaluator_pairs = [
                (project_evaluator, evaluator) for project_evaluator, evaluator in rows
            ]
            resolved_project_evaluators = await resolve_project_evaluators_bulk(
                session, project_evaluator_pairs
            )
            for (project_evaluator, evaluator), resolved in zip(
                project_evaluator_pairs,
                resolved_project_evaluators,
                strict=True,
            ):
                # NOT wrapped in a per-evaluator except: an unexpected exception
                # here (e.g. a transient DB error on a version lookup) must
                # abort the tick so the cursor cannot advance past a window
                # this project evaluator never scanned. See the docstring's skip policy.
                if resolved is None:
                    logger.warning(
                        f"Skipping project evaluator {project_evaluator.id}: "
                        f"no resolvable version for evaluator {evaluator.id}"
                    )
                    continue
                try:
                    span_filter = SpanFilter(resolved.filter_condition)
                except Exception:
                    # SpanFilter construction is pure parsing (no I/O), so a
                    # failure here is deterministic — a persistent condition,
                    # same as an unresolvable version: skip-and-advance rather
                    # than stalling every other project evaluator on one bad DSL string.
                    logger.exception(
                        f"Skipping project evaluator {project_evaluator.id}: "
                        "filter_condition failed to compile"
                    )
                    continue
                active.append(
                    _ActiveProjectEvaluator(
                        project_evaluator_id=project_evaluator.id,
                        project_id=project_evaluator.project_id,
                        sampling_rate=project_evaluator.sampling_rate,
                        span_filter=span_filter,
                    )
                )
        return active

    async def _materialize_and_advance(
        self,
        active: list[_ActiveProjectEvaluator],
        cursor: models.EvalSpanCursor,
        frontier: int,
        budget: int,
        now: datetime,
    ) -> tuple[bool, int]:
        """Offer the window to every project evaluator and advance past it, returning whether
        the cursor advanced and the room left in the queue. The window is one batch, or, when
        it holds more evaluations than the queue does, consecutive batches of whole spans no
        larger than the queue. A batch that does not fit is dropped whole: any rule for which
        part to keep would break the nested sampling every evaluator shares.

        A dropped batch leaves no work rows. The compare-and-set that advances the cursor
        also raises ``overflowed_through_id`` to the newest dropped span and adds the drops to
        ``overflowed_counts``, so all three commit together or not at all."""
        low_exclusive = cursor.produced_through_id
        dropped: Counter[int] = Counter()
        newest_dropped_span_id: Optional[int] = None
        queued_count = 0
        async with self._db() as session:
            evaluator_indexes_by_span: dict[int, list[int]] = {}
            for index, project_evaluator in enumerate(active):
                span_ids = await self._scan(session, project_evaluator, low_exclusive, frontier)
                for span_id in project_evaluator.sampled(span_ids):
                    evaluator_indexes_by_span.setdefault(span_id, []).append(index)
            for batch in _whole_span_batches(evaluator_indexes_by_span, self._max_outstanding):
                batch_size = sum(len(evaluator_indexes_by_span[span_id]) for span_id in batch)
                if batch_size > budget:
                    for span_id in batch:
                        for index in evaluator_indexes_by_span[span_id]:
                            dropped[active[index].project_evaluator_id] += 1
                    newest_dropped_span_id = batch[-1]
                    continue
                span_ids_by_evaluator: dict[int, list[int]] = {}
                for span_id in batch:
                    for index in evaluator_indexes_by_span[span_id]:
                        span_ids_by_evaluator.setdefault(index, []).append(span_id)
                for index, span_ids in span_ids_by_evaluator.items():
                    queued_count += await self._insert_work_units(session, active[index], span_ids)
                budget -= batch_size
            advance: dict[str, Any] = {
                "produced_through_id": frontier,
                "overflowed_counts": _overflowed_counts_with(
                    cursor.overflowed_counts, dropped, now
                ),
            }
            if newest_dropped_span_id is not None:
                advance["overflowed_through_id"] = max(
                    newest_dropped_span_id, cursor.overflowed_through_id or 0
                )
            advanced = (
                await session.scalar(
                    update(models.EvalSpanCursor)
                    .where(
                        models.EvalSpanCursor.id == _CURSOR_ID,
                        models.EvalSpanCursor.produced_through_id == low_exclusive,
                    )
                    .values(**advance)
                    .returning(models.EvalSpanCursor.id)
                )
                is not None
            )
            if not advanced:
                await session.rollback()
                logger.warning("Online-eval producer frontier rolled back: the cursor moved")
                return False, budget
        self._count_queued(queued_count)
        if dropped_count := sum(dropped.values()):
            logger.warning(
                f"Online-eval span queue full: dropped {dropped_count} evaluations "
                f"with room for {budget}"
            )
            if self._publish_metrics:
                ONLINE_EVAL_OVERFLOWED_WORK_UNITS.labels(evaluation_target="SPAN").inc(
                    dropped_count
                )
        return True, budget

    async def _record_observation(self, produced_through_id: int) -> None:
        async with self._db() as session:
            high_water = await session.scalar(select(func.max(models.Span.id)))
            if high_water is None or high_water <= produced_through_id:
                self._publish_frontier_gap(0)
                return
            # Stamp the observation with a timestamp taken AFTER the high-water
            # read, never the tick-start time: the reap/gate/materialize work
            # preceding this call can consume a large fraction of the frontier
            # lag (unboundedly so on a first-run backfill), and a stale stamp
            # makes the next tick over-age the observation — eroding the
            # commit-visibility guard against the id-vs-commit-order race and
            # leaving late-visible spans to the slower backstop. A post-read
            # stamp errs conservative.
            observed_at = await current_database_time(session, self._db.dialect)
            observed = await session.scalar(
                update(models.EvalSpanCursor)
                .where(
                    models.EvalSpanCursor.id == _CURSOR_ID,
                    models.EvalSpanCursor.produced_through_id == produced_through_id,
                )
                .values(observed_high_water_id=high_water, observed_at=observed_at)
                .returning(models.EvalSpanCursor.id)
            )
        if observed is None:
            return
        self._publish_frontier_gap(high_water - produced_through_id)
        self._publish_ingest_rate(high_water, observed_at)

    async def _refresh_gauges(self, produced_through_id: int) -> None:
        """Publish the frontier gap and ingest rate on a tick that leaves its pending
        observation unconsumed, e.g. while the frontier stops short of it."""
        if not self._publish_metrics:
            return
        async with self._db() as session:
            if not await self._cursor_is_at(session, produced_through_id):
                return
            high_water = await session.scalar(select(func.max(models.Span.id))) or 0
            observed_at = await current_database_time(session, self._db.dialect)
        self._publish_frontier_gap(max(high_water - produced_through_id, 0))
        self._publish_ingest_rate(high_water, observed_at)

    def _publish_frontier_gap(self, gap: int) -> None:
        """How far the arrival log has run ahead of what this producer has materialized."""
        if self._publish_metrics:
            ONLINE_EVAL_FRONTIER_GAP_SPAN_IDS.set(gap)

    def _publish_ingest_rate(self, high_water: int, observed_at: datetime) -> None:
        """Span arrival rate, differenced across this producer's own observations.

        Sampled at the producer's tick because the producer is what observes the
        watermark; reading it from a consumer took the sample at the wrong cadence and
        went dark whenever consumers did.
        """
        previous, self._last_ingest_sample = self._last_ingest_sample, (high_water, observed_at)
        if not self._publish_metrics or previous is None:
            return
        last_high_water, last_observed_at = previous
        elapsed = (observed_at - last_observed_at).total_seconds()
        if elapsed > 0:
            ONLINE_EVAL_INGEST_SPANS_PER_SECOND.set(max(high_water - last_high_water, 0) / elapsed)

    async def _backstop_sweep(
        self,
        active: list[_ActiveProjectEvaluator],
        watermark: int,
        budget: int,
    ) -> int:
        if watermark <= 0:
            return budget
        queued_count = 0
        async with self._db() as session:
            # Window is [watermark - lookback, watermark], matching the reaper's floor
            # exactly so every retained terminal row is inside the swept range, and starts
            # above the newest dropped span, which left no row to block re-offering it.
            overflowed_through_id = await session.scalar(
                select(models.EvalSpanCursor.overflowed_through_id).where(
                    models.EvalSpanCursor.id == _CURSOR_ID
                )
            )
            low_exclusive = max(
                watermark - self._backstop_lookback_span_ids - 1,
                overflowed_through_id or 0,
                0,
            )
            for index, project_evaluator in enumerate(active):
                span_ids = await self._scan(session, project_evaluator, low_exclusive, watermark)
                sampled_span_ids = project_evaluator.sampled(span_ids)
                admitted_span_ids = sampled_span_ids[:budget]
                queued_count += await self._insert_work_units(
                    session, project_evaluator, admitted_span_ids
                )
                budget -= len(admitted_span_ids)
                if len(admitted_span_ids) < len(sampled_span_ids) or (
                    budget == 0 and index < len(active) - 1
                ):
                    logger.warning(
                        f"Online-eval producer backstop truncated at insertion budget; "
                        f"{budget} budget remaining"
                    )
                    break
            if not await self._cursor_is_at(session, watermark):
                await session.rollback()
                logger.warning("Online-eval producer backstop rolled back: the cursor moved")
                return budget
        self._count_queued(queued_count)
        return budget

    async def _scan(
        self,
        session: AsyncSession,
        project_evaluator: _ActiveProjectEvaluator,
        low_exclusive: int,
        high_inclusive: int,
    ) -> list[int]:
        """Span ids in the window that still need work for this evaluator; none when its
        filter fails when run, so one broken filter does not hold the cursor for the rest."""
        try:
            async with session.begin_nested():
                return list(
                    await session.scalars(
                        project_evaluator.materializable_scan_stmt(low_exclusive, high_inclusive)
                    )
                )
        except (DBAPIError, OverflowError) as error:
            logger.warning(
                f"Skipping project evaluator {project_evaluator.project_evaluator_id} for span "
                f"ids {low_exclusive + 1} to {high_inclusive}: its filter condition failed when "
                f"run: {error.orig if isinstance(error, DBAPIError) else error}"
            )
            return []

    async def _cursor_is_at(self, session: AsyncSession, position: int) -> bool:
        """Whether the cursor still holds the position a scan was taken against.

        Once the cursor moves, its holder may reap terminal work in the scanned window
        before a scan reads it, and committing that scan's inserts recreates the work.
        """
        produced_through_id = await session.scalar(
            select(models.EvalSpanCursor.produced_through_id).where(
                models.EvalSpanCursor.id == _CURSOR_ID
            )
        )
        return produced_through_id == position

    async def _insert_work_units(
        self,
        session: AsyncSession,
        project_evaluator: _ActiveProjectEvaluator,
        span_ids: list[int],
    ) -> int:
        """Insert PENDING work for the spans that have none, returning how many rows."""
        if not span_ids:
            return 0
        inserted_count = 0
        records = [
            {
                "span_rowid": span_rowid,
                "project_evaluator_id": project_evaluator.project_evaluator_id,
            }
            for span_rowid in span_ids
        ]
        for start in range(0, len(records), _INSERT_BATCH_SIZE):
            batch = records[start : start + _INSERT_BATCH_SIZE]
            inserted_ids = await session.scalars(
                insert_on_conflict(
                    *batch,
                    table=models.EvalWorkUnit,
                    dialect=self._db.dialect,
                    unique_by=_WORK_UNIT_UNIQUE_BY,
                    on_conflict=OnConflict.DO_NOTHING,
                ).returning(models.EvalWorkUnit.id)
            )
            inserted_count += len(inserted_ids.all())
        return inserted_count

    def _count_queued(self, queued_count: int) -> None:
        """Count work queued by a scan whose transaction has committed."""
        if self._publish_metrics and queued_count:
            ONLINE_EVAL_MATERIALIZED_WORK_UNITS.labels(evaluation_target="SPAN").inc(queued_count)
