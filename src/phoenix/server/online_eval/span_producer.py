"""The span evaluation producer: adds span evaluations to the queue as spans arrive.

The producer runs on every replica. The ``span-producer`` scan lease is advisory: it keeps
one replica scanning at a time so scans aren't repeated, but no write is fenced on it.
The unique (span, project evaluator) work-unit key absorbs duplicate inserts. Each tick
takes the lease and runs retention cleanup, which deletes old finished work. When the high
water is older than the visibility lag, the tick scans the window from the span cursor to
the window end per project evaluator and adds the work it finds. A window spans at most
``max_span_ids_per_tick`` ids, and after a window cut at that limit the next tick starts at
once. An hourly catch-up scan re-reads a bounded id window behind the span cursor for spans
an earlier scan passed over: those of an evaluator enabled while that scan ran, those of an
evaluator whose filter failed when run, and spans that committed later than the visibility lag.

The high water and when it was seen are kept in memory, so a replica that takes the lease
over waits the visibility lag before its first scan. The cursor only moves forward, except
where the clamp lowers it to the live high water because SQLite reuses span ids. Retention
cleanup deletes finished span work below the retention floor, the cursor minus
``catch_up_scan_lookback_span_ids``, so the catch-up scan does not queue those spans again.
A scan that stalls while another replica moves the cursor on and runs retention cleanup can
still queue a few old spans again, which is accepted.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Optional

from sqlalchemy import Select, delete, exists, func, select, text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import get_env_enable_prometheus, get_env_online_eval_retention_seconds
from phoenix.db import models
from phoenix.db.eval_work import terminal_index_predicate
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.clock import VISIBILITY_LAG_SECONDS, current_database_time
from phoenix.server.online_eval.derivation import sample_key
from phoenix.server.online_eval.leases import ScanLease
from phoenix.server.online_eval.project_evaluator_resolution import (
    load_enabled_project_evaluator_pairs,
    resolve_project_evaluators_bulk,
)
from phoenix.server.online_eval.project_evaluator_state import (
    load_states,
    lower_span_starts,
)
from phoenix.server.prometheus import (
    ONLINE_EVAL_ADDED_WORK_UNITS,
    ONLINE_EVAL_INGEST_SPANS_PER_SECOND,
    ONLINE_EVAL_SPAN_CURSOR_LAG_SPAN_IDS,
)
from phoenix.server.types import DaemonTask, DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter

logger = logging.getLogger(__name__)

TICK_INTERVAL_SECONDS = 10.0
CATCH_UP_SCAN_INTERVAL_SECONDS = 3600.0
CATCH_UP_SCAN_LOOKBACK_SPAN_IDS = 100_000
"""How far behind the cursor the catch-up scan reads. Retention cleanup keeps finished work
this far behind the cursor, so a catch-up scan does not queue a span whose finished work was
deleted."""
MAX_SPAN_IDS_PER_TICK = 10_000

_INSERT_BATCH_SIZE = 1000
_WORK_UNIT_UNIQUE_BY = ("span_rowid", "project_evaluator_id")


@dataclass(frozen=True)
class _ActiveProjectEvaluator:
    project_evaluator_id: int
    project_id: int
    sampling_rate: float
    span_filter: SpanFilter
    span_start_rowid: Optional[int] = None

    def scan_stmt(self, low_exclusive: int, high_inclusive: int) -> Select[int]:
        if self.span_start_rowid is not None:
            low_exclusive = max(low_exclusive, self.span_start_rowid)
        stmt = (
            select(models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.project_id)
            .where(models.Span.id > low_exclusive, models.Span.id <= high_inclusive)
        )
        return self.span_filter(stmt)

    def new_work_scan_stmt(self, low_exclusive: int, high_inclusive: int) -> Select[int]:
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


class SpanEvaluationProducer(DaemonTask):
    """Add span evaluations from the span arrival log.

    The span cursor, ``produced_through_id``, is a scan position in that log: spans above
    it are still to be scanned, and spans at or below it were scanned for the SPAN project
    evaluators active when the cursor passed them. It starts at the newest span, so older
    spans are reached only by the catch-up scan's lookback
    (``catch_up_scan_lookback_span_ids``), and no scan reaches an evaluator's span start
    (``project_evaluator_state.span_start_rowid``): an evaluator evaluates only spans that
    arrive after it is created, enabled, or given a new filter or sampling rate. Trace and
    session evaluations are added
    by the sweeping producers instead: a trace or session is due when it goes quiet, which
    no position in an arrival log can express.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        tick_interval_seconds: float = TICK_INTERVAL_SECONDS,
        visibility_lag_seconds: float = VISIBILITY_LAG_SECONDS,
        catch_up_scan_interval_seconds: float = CATCH_UP_SCAN_INTERVAL_SECONDS,
        catch_up_scan_lookback_span_ids: int = CATCH_UP_SCAN_LOOKBACK_SPAN_IDS,
        max_span_ids_per_tick: int = MAX_SPAN_IDS_PER_TICK,
    ) -> None:
        super().__init__()
        self._db = db
        self._tick_interval_seconds = tick_interval_seconds
        self._lease = ScanLease(db, name="span-producer", holder=f"span-producer-{token_hex(8)}")
        self._visibility_lag_seconds = visibility_lag_seconds
        self._catch_up_scan_interval_seconds = catch_up_scan_interval_seconds
        self._catch_up_scan_lookback_span_ids = catch_up_scan_lookback_span_ids
        self._max_span_ids_per_tick = max_span_ids_per_tick
        self._retention_seconds = get_env_online_eval_retention_seconds()
        self._last_catch_up_scan_at = time.monotonic()
        self._publish_metrics = get_env_enable_prometheus()
        ONLINE_EVAL_ADDED_WORK_UNITS.labels(evaluation_target="SPAN")
        self._last_ingest_sample: Optional[tuple[int, datetime]] = None
        # The high water and the database time it was read, until the cursor passes it.
        self._observation: Optional[tuple[int, datetime]] = None

    async def _run(self) -> None:
        try:
            while self._running:
                window_was_cut = False
                try:
                    window_was_cut = await self._tick()
                except Exception:
                    logger.exception("Online-eval span producer tick failed")
                await asyncio.sleep(0 if window_was_cut else self._tick_interval_seconds)
        finally:
            # A second cancellation while stop() drains would abort the release and leave the
            # lease held until its 90 s TTL expires; the shield keeps the release running.
            await asyncio.shield(asyncio.ensure_future(self._lease.release()))

    async def _tick(self) -> bool:
        """Run one tick, returning whether the cursor advanced through a window cut at
        ``max_span_ids_per_tick``, so that more of the observed spans are already due."""
        if not await self._lease.acquire():
            return False
        async with self._db() as session:
            now = await current_database_time(session, self._db.dialect)
            cursor = await self._load_cursor(session)
        if cursor is None:
            return False
        if self._db.should_not_insert_or_update:
            await self._retention_cleanup(now)
            return False
        cursor = await self._clamp_cursor(cursor)
        if cursor is None:
            return False
        produced_through_id = cursor.produced_through_id

        await self._retention_cleanup(now)

        # The observation the cursor has yet to pass, scanned up to once it is older than the
        # visibility lag.
        pending = self._observation
        if pending is not None and pending[0] <= produced_through_id:
            pending = None
        window_end: Optional[int] = None
        if pending is not None:
            high_water, observed_at = pending
            if (now - observed_at).total_seconds() >= self._visibility_lag_seconds:
                window_end = min(high_water, produced_through_id + self._max_span_ids_per_tick)

        active = await self._load_active_project_evaluators()

        if window_end is not None:
            if not await self._lease.renew():
                return False
            await self._scan_window_and_advance(active, produced_through_id, window_end)
            produced_through_id = window_end
            if pending is not None and window_end == pending[0]:
                pending = None

        if pending is None:
            await self._record_observation(produced_through_id)
        else:
            await self._refresh_gauges(produced_through_id)

        if time.monotonic() - self._last_catch_up_scan_at >= self._catch_up_scan_interval_seconds:
            if not await self._lease.renew():
                return False
            await self._catch_up_scan(active, produced_through_id)
            self._last_catch_up_scan_at = time.monotonic()
        return window_end is not None and pending is not None

    async def _load_cursor(self, session: AsyncSession) -> Optional[models.EvalSpanCursor]:
        """Read the cursor, starting it at the current span high water on first use."""
        cursor = await session.get(models.EvalSpanCursor, models.SPAN_CURSOR_ID)
        if cursor is not None or self._db.should_not_insert_or_update:
            return cursor
        high_water = await session.scalar(select(func.max(models.Span.id))) or 0
        await session.execute(
            insert_on_conflict(
                {"id": models.SPAN_CURSOR_ID, "produced_through_id": high_water},
                table=models.EvalSpanCursor,
                dialect=self._db.dialect,
                unique_by=("id",),
                on_conflict=OnConflict.DO_NOTHING,
                constraint_name="pk_eval_span_cursors",
            )
        )
        return await session.get(models.EvalSpanCursor, models.SPAN_CURSOR_ID)

    async def _clamp_cursor(self, cursor: models.EvalSpanCursor) -> Optional[models.EvalSpanCursor]:
        """Lower the cursor, and every span start above it, to the live span high water, or
        return None if another producer moved the cursor since it was loaded. SQLite reuses
        the ids of deleted newest spans, so new spans arrive at or below the old position."""
        async with self._db() as session:
            max_span_id = await session.scalar(select(func.max(models.Span.id))) or 0
            if max_span_id >= cursor.produced_through_id:
                return cursor
            clamped = await session.scalar(
                update(models.EvalSpanCursor)
                .where(
                    models.EvalSpanCursor.id == models.SPAN_CURSOR_ID,
                    models.EvalSpanCursor.produced_through_id == cursor.produced_through_id,
                )
                .values(produced_through_id=max_span_id)
                .returning(models.EvalSpanCursor)
            )
            if clamped is not None:
                await lower_span_starts(session, max_span_id)
                # The reused ids arrive after the observation, so they wait a fresh one.
                self._observation = None
            return clamped

    async def _retention_cleanup(self, now: datetime) -> None:
        retention_cutoff = now - timedelta(seconds=self._retention_seconds)
        # Finished rows inside the catch-up scan's lookback are never deleted, regardless of
        # age: they keep the catch-up scan from queueing their spans again.
        retention_floor = (
            select(
                models.EvalSpanCursor.produced_through_id - self._catch_up_scan_lookback_span_ids
            )
            .where(models.EvalSpanCursor.id == models.SPAN_CURSOR_ID)
            .scalar_subquery()
        )
        async with self._db() as session:
            await session.execute(
                delete(models.EvalWorkUnit).where(
                    # SQLite reads a partial index only when the query repeats its predicate.
                    text(terminal_index_predicate()),
                    models.EvalWorkUnit.updated_at < retention_cutoff,
                    models.EvalWorkUnit.span_rowid < retention_floor,
                )
            )

    async def _load_active_project_evaluators(self) -> list[_ActiveProjectEvaluator]:
        """Load and resolve enabled project evaluators into scan-ready form.

        Skip policy: only *persistent* per-evaluator conditions (no resolvable
        version, filter fails to compile) are logged and skipped, so one bad
        project evaluator cannot stall the shared cursor forever. Anything else — e.g. a
        transient DB error during version resolution — propagates and aborts
        the tick without advancing the cursor (fail closed): advancing is an
        implicit claim that every enabled project evaluator either queued or
        deliberately skipped the window, and a project evaluator that failed to load
        transiently did neither.
        """
        active: list[_ActiveProjectEvaluator] = []
        async with self._db() as session:
            project_evaluator_pairs = await load_enabled_project_evaluator_pairs(session, "SPAN")
            resolved_project_evaluators = await resolve_project_evaluators_bulk(
                session, project_evaluator_pairs
            )
            states = await load_states(
                session, [project_evaluator.id for project_evaluator, _ in project_evaluator_pairs]
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
                        span_start_rowid=(
                            state.span_start_rowid
                            if (state := states.get(project_evaluator.id))
                            else None
                        ),
                    )
                )
        return active

    async def _scan_window_and_advance(
        self,
        active: list[_ActiveProjectEvaluator],
        low_exclusive: int,
        window_end: int,
    ) -> None:
        """Queue the window's work and move the cursor up to the window end, unless another
        producer has already moved it past."""
        async with self._db() as session:
            queued_count = await self._queue_window(session, active, low_exclusive, window_end)
            await session.execute(
                update(models.EvalSpanCursor)
                .where(
                    models.EvalSpanCursor.id == models.SPAN_CURSOR_ID,
                    models.EvalSpanCursor.produced_through_id < window_end,
                )
                .values(produced_through_id=window_end)
            )
        self._count_queued(queued_count)

    async def _record_observation(self, produced_through_id: int) -> None:
        async with self._db() as session:
            high_water = await session.scalar(select(func.max(models.Span.id)))
            if high_water is None or high_water <= produced_through_id:
                self._publish_span_cursor_lag(0)
                return
            # Stamp the observation with a time taken after the high-water read, never the
            # tick start: the cleanup and scan work before this call can take much of the
            # visibility lag, and a stale stamp ages the observation early, leaving spans
            # that commit late to the slower catch-up scan.
            observed_at = await current_database_time(session, self._db.dialect)
        self._observation = (high_water, observed_at)
        self._publish_span_cursor_lag(high_water - produced_through_id)
        self._publish_ingest_rate(high_water, observed_at)

    async def _refresh_gauges(self, produced_through_id: int) -> None:
        """Publish the span cursor lag and ingest rate on a tick that leaves its pending
        observation unconsumed: the observation is still aging, or its window was cut."""
        if not self._publish_metrics:
            return
        async with self._db() as session:
            high_water = await session.scalar(select(func.max(models.Span.id))) or 0
            observed_at = await current_database_time(session, self._db.dialect)
        self._publish_span_cursor_lag(max(high_water - produced_through_id, 0))
        self._publish_ingest_rate(high_water, observed_at)

    def _publish_span_cursor_lag(self, lag: int) -> None:
        """How far the high water has run ahead of the span cursor."""
        if self._publish_metrics:
            ONLINE_EVAL_SPAN_CURSOR_LAG_SPAN_IDS.set(lag)

    def _publish_ingest_rate(self, high_water: int, observed_at: datetime) -> None:
        """Span arrival rate, differenced across this producer's own observations.

        Sampled at the producer's tick because the producer is what observes the high
        water; reading it from a consumer took the sample at the wrong cadence and went dark
        whenever consumers did.
        """
        previous, self._last_ingest_sample = self._last_ingest_sample, (high_water, observed_at)
        if not self._publish_metrics or previous is None:
            return
        last_high_water, last_observed_at = previous
        elapsed = (observed_at - last_observed_at).total_seconds()
        if elapsed > 0:
            ONLINE_EVAL_INGEST_SPANS_PER_SECOND.set(max(high_water - last_high_water, 0) / elapsed)

    async def _catch_up_scan(
        self,
        active: list[_ActiveProjectEvaluator],
        span_cursor: int,
    ) -> None:
        """Queue the work the lookback window still needs."""
        if span_cursor <= 0:
            return
        # Window is [span_cursor - lookback, span_cursor], matching the retention floor
        # exactly so every retained finished row is inside the scanned range.
        low_exclusive = max(span_cursor - self._catch_up_scan_lookback_span_ids - 1, 0)
        async with self._db() as session:
            queued_count = await self._queue_window(session, active, low_exclusive, span_cursor)
        self._count_queued(queued_count)

    async def _queue_window(
        self,
        session: AsyncSession,
        active: list[_ActiveProjectEvaluator],
        low_exclusive: int,
        high_inclusive: int,
    ) -> int:
        """Queue every sampled span in the window that has no work yet, evaluator by
        evaluator, returning how many rows were queued."""
        queued_count = 0
        for project_evaluator in active:
            sampled_span_ids = project_evaluator.sampled(
                await self._scan(session, project_evaluator, low_exclusive, high_inclusive)
            )
            queued_count += await self._insert_work_units(
                session, project_evaluator, sampled_span_ids
            )
        return queued_count

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
                        project_evaluator.new_work_scan_stmt(low_exclusive, high_inclusive)
                    )
                )
        except (DBAPIError, OverflowError) as error:
            logger.warning(
                f"Skipping project evaluator {project_evaluator.project_evaluator_id} for span "
                f"ids {low_exclusive + 1} to {high_inclusive}: its filter condition failed when "
                f"run: {error.orig if isinstance(error, DBAPIError) else error}"
            )
            return []

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
            ONLINE_EVAL_ADDED_WORK_UNITS.labels(evaluation_target="SPAN").inc(queued_count)
