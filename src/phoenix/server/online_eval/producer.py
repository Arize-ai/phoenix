"""Online-eval producer daemon.

Materializes span-level eval work units from enabled project evaluators.
The producer runs on every replica. The ``span-producer`` lease is advisory: it keeps
one replica scanning at a time so scans aren't repeated, but no write is fenced on it.
The unique (span, project evaluator) work-unit key absorbs duplicate
inserts. Each tick takes the lease and deletes aged terminal work rows. When a frontier
is due, it also scans the lag-gated span id window per project evaluator and inserts the
work units it finds. A window spans at most ``max_span_ids_per_tick`` ids, and after a
window cut at that limit the next tick starts at once. A slow-cadence backstop sweep
re-covers a bounded id window behind the watermark to catch spans that became visible
after their window was scanned.

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
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Optional

from sqlalchemy import Select, delete, exists, func, select, text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import get_env_enable_prometheus, get_env_online_eval_retention_seconds
from phoenix.db import models
from phoenix.db.eval_work import terminal_eval_work_index_predicate
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.derivation import sample_key
from phoenix.server.online_eval.leases import MaterializerLease, current_database_time
from phoenix.server.online_eval.project_evaluator_resolution import (
    load_enabled_project_evaluator_pairs,
    resolve_project_evaluators_bulk,
)
from phoenix.server.prometheus import (
    ONLINE_EVAL_FRONTIER_GAP_SPAN_IDS,
    ONLINE_EVAL_INGEST_SPANS_PER_SECOND,
    ONLINE_EVAL_MATERIALIZED_WORK_UNITS,
)
from phoenix.server.types import DaemonTask, DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter

logger = logging.getLogger(__name__)

TICK_INTERVAL_SECONDS = 10.0
FRONTIER_LAG_SECONDS = 60.0
"""How long a span id or ingest time is given to become visible before a scan relies on it:
the producer scans up to an observed high water once it is this old, and the sweepers re-read
this far behind their watermarks."""
BACKSTOP_INTERVAL_SECONDS = 3600.0
BACKSTOP_LOOKBACK_SPAN_IDS = 100_000
"""How far behind the cursor the backstop scans. The reaper keeps terminal work this far
behind the cursor, so a backstop scan never queues a span whose finished work was reaped."""
MAX_SPAN_IDS_PER_TICK = 10_000

_INSERT_BATCH_SIZE = 1000
_WORK_UNIT_UNIQUE_BY = ("span_rowid", "project_evaluator_id")
_CURSOR_ID = 1


async def current_span_rowid_floor(session: AsyncSession) -> int:
    """The span floor for a span evaluator that starts now: the producer's position, or the
    newest span before the producer has run."""
    produced_through_id = await session.scalar(
        select(models.EvalSpanCursor.produced_through_id).where(
            models.EvalSpanCursor.id == _CURSOR_ID
        )
    )
    if produced_through_id is not None:
        return produced_through_id
    return await session.scalar(select(func.max(models.Span.id))) or 0


@dataclass(frozen=True)
class _ActiveProjectEvaluator:
    project_evaluator_id: int
    project_id: int
    sampling_rate: float
    span_filter: SpanFilter
    span_rowid_floor: Optional[int] = None

    def scan_stmt(self, low_exclusive: int, high_inclusive: int) -> Select[int]:
        if self.span_rowid_floor is not None:
            low_exclusive = max(low_exclusive, self.span_rowid_floor)
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


class OnlineEvalProducer(DaemonTask):
    """Materialize SPAN evaluation work from the span arrival log.

    ``produced_through_id`` is a scan position in that log: spans above it are still to be
    scanned, and spans at or below it were scanned for the SPAN project evaluators active
    when the position passed them. It starts at the newest span, so older spans are reached
    only by the backstop's lookback (``backstop_lookback_span_ids``), and no scan reaches an
    evaluator's ``span_rowid_floor``: an evaluator evaluates only spans that arrive after it
    is created, enabled, or given a new filter or sampling rate. Session and trace work are
    materialized from entity state instead, by ``EvalSweeper`` — a session or trace
    becomes eligible when it goes quiet, which no position in an arrival log can express.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        tick_interval_seconds: float = TICK_INTERVAL_SECONDS,
        frontier_lag_seconds: float = FRONTIER_LAG_SECONDS,
        backstop_interval_seconds: float = BACKSTOP_INTERVAL_SECONDS,
        backstop_lookback_span_ids: int = BACKSTOP_LOOKBACK_SPAN_IDS,
        max_span_ids_per_tick: int = MAX_SPAN_IDS_PER_TICK,
    ) -> None:
        super().__init__()
        self._db = db
        self._tick_interval_seconds = tick_interval_seconds
        self._lease = MaterializerLease(db, name="span-producer", holder=f"producer-{token_hex(8)}")
        self._frontier_lag_seconds = frontier_lag_seconds
        self._backstop_interval_seconds = backstop_interval_seconds
        self._backstop_lookback_span_ids = backstop_lookback_span_ids
        self._max_span_ids_per_tick = max_span_ids_per_tick
        self._retention_seconds = get_env_online_eval_retention_seconds()
        self._last_backstop_at = time.monotonic()
        self._publish_metrics = get_env_enable_prometheus()
        ONLINE_EVAL_MATERIALIZED_WORK_UNITS.labels(evaluation_target="SPAN")
        self._last_ingest_sample: Optional[tuple[int, datetime]] = None

    async def _run(self) -> None:
        try:
            while self._running:
                window_was_cut = False
                try:
                    window_was_cut = await self._tick()
                except Exception:
                    logger.exception("Online-eval producer tick failed")
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
            await self._reap(now)
            return False
        cursor = await self._clamp_cursor(cursor)
        if cursor is None:
            return False
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

        active = await self._load_active_project_evaluators()

        advanced = False
        if frontier is not None:
            if not await self._lease.renew():
                return False
            advanced = await self._materialize_and_advance(active, produced_through_id, frontier)
            if advanced:
                produced_through_id = frontier

        observation_consumed = advanced and frontier == observed_high_water_id
        if not pending_observation or observation_consumed:
            await self._record_observation(produced_through_id)
        else:
            await self._refresh_gauges(produced_through_id)

        if time.monotonic() - self._last_backstop_at >= self._backstop_interval_seconds:
            if not await self._lease.renew():
                return False
            await self._backstop_sweep(active, produced_through_id)
            self._last_backstop_at = time.monotonic()
        return advanced and not observation_consumed

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
        """Lower the cursor, and every span floor above it, to the live span high water, or
        return None if another producer moved the cursor since it was loaded. SQLite reuses
        the ids of deleted newest spans, so new spans arrive at or below the old position."""
        async with self._db() as session:
            max_span_id = await session.scalar(select(func.max(models.Span.id))) or 0
            if max_span_id >= cursor.produced_through_id:
                return cursor
            clamped = await session.scalar(
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
            if clamped is not None:
                await session.execute(
                    update(models.ProjectEvaluator)
                    .where(models.ProjectEvaluator.span_rowid_floor > max_span_id)
                    .values(
                        span_rowid_floor=max_span_id,
                        updated_at=models.ProjectEvaluator.updated_at,
                    )
                )
            return clamped

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
        active: list[_ActiveProjectEvaluator] = []
        async with self._db() as session:
            project_evaluator_pairs = await load_enabled_project_evaluator_pairs(session, "SPAN")
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
                        span_rowid_floor=project_evaluator.span_rowid_floor,
                    )
                )
        return active

    async def _materialize_and_advance(
        self,
        active: list[_ActiveProjectEvaluator],
        low_exclusive: int,
        frontier: int,
    ) -> bool:
        """Queue the window's work and advance the cursor past the window, returning whether
        the cursor advanced."""
        async with self._db() as session:
            queued_count = await self._queue_window(session, active, low_exclusive, frontier)
            advanced = (
                await session.scalar(
                    update(models.EvalSpanCursor)
                    .where(
                        models.EvalSpanCursor.id == _CURSOR_ID,
                        models.EvalSpanCursor.produced_through_id == low_exclusive,
                    )
                    .values(produced_through_id=frontier)
                    .returning(models.EvalSpanCursor.id)
                )
                is not None
            )
            if not advanced:
                await session.rollback()
                logger.warning("Online-eval producer frontier rolled back: the cursor moved")
                return False
        self._count_queued(queued_count)
        return True

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
        observation unconsumed: the observation is still aging, or its window was cut."""
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
    ) -> None:
        """Queue the work the lookback window still needs."""
        if watermark <= 0:
            return
        # Window is [watermark - lookback, watermark], matching the reaper's floor
        # exactly so every retained terminal row is inside the swept range.
        low_exclusive = max(watermark - self._backstop_lookback_span_ids - 1, 0)
        async with self._db() as session:
            queued_count = await self._queue_window(session, active, low_exclusive, watermark)
            if not await self._cursor_is_at(session, watermark):
                await session.rollback()
                logger.warning("Online-eval producer backstop rolled back: the cursor moved")
                return
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
