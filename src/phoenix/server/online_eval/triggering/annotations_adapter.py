"""Announces annotation inserts and edits to the signal log by scanning for them.

Annotations arrive on many paths — the app, the REST API, bulk ingest, the SDKs — so this
arm covers all of them by scanning `span_annotations`, `trace_annotations`, and
`project_session_annotations` rather than by instrumenting every writer. Each tick walks a
table twice: forward by id for rows it has never seen, and forward by `updated_at` for
rows edited below that id. Both walks stop short of the present by the frontier lag, and
they overlap on a freshly inserted row — the log collapses the repeat.

Annotations that online evaluation wrote itself are excluded by the scan query, so no
signal row is ever written for them.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Any, Optional

from sqlalchemy import ColumnElement, Select, and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from phoenix.config import get_env_online_eval_frontier_lag_seconds
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.derivation import ONLINE_EVAL_IDENTIFIER_PREFIX
from phoenix.server.online_eval.leases import DatabaseLease, LeaseLost
from phoenix.server.online_eval.triggering.log import AnnotationUpserted, append
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

ANNOTATION_DELTA_LEASE_TTL_SECONDS = 90.0
TICK_INTERVAL_SECONDS = 10.0

_LEASE_NAME = "annotation-delta"
_CONSUMER_GROUP = "annotation-delta"
_MAX_ANNOTATION_IDS_PER_TICK = 1000
# How many edited rows one tick may announce. The time slice alone does not bound the
# work: a bulk re-annotation lands its whole batch inside one window, and a tick that
# fails rolls back everything it did. With the cap the position advances inside the
# window, so the next tick resumes rather than repeating.
_MAX_EDIT_ROWS_PER_TICK = 1000
# How far the edit walk may advance in one tick. After an outage it is behind by the
# length of the outage, and stepping it forward in slices keeps any one tick bounded.
_MAX_EDIT_CATCHUP = timedelta(minutes=5)


@dataclass(frozen=True)
class _AnnotationSource:
    """One annotation table, and where this adapter keeps its two positions in it."""

    annotation_kind: models.AnnotationKind
    evaluation_target: models.EvaluationTarget
    id_column: InstrumentedAttribute[int]
    updated_at_column: InstrumentedAttribute[datetime]
    scan: Select[Any]


@dataclass(frozen=True)
class _Observation:
    """A high water mark in an annotation table, and when it was read."""

    high_water_id: int
    observed_at: datetime


def _window_is_open(
    walked_through: datetime,
    walked_through_id: int,
    through: datetime,
) -> bool:
    """Whether the window still holds anything past the edit walk's position.

    The position is a stamp and an id within it, so a walk the row cap parked part way
    through a run of rows sharing one stamp still has that run's tail to cover, even
    though the window's end has not moved since.
    """
    if walked_through < through:
        return True
    return walked_through == through and walked_through_id > 0


def _after(
    source: "_AnnotationSource",
    updated_at: datetime,
    annotation_id: int,
) -> ColumnElement[bool]:
    """Rows past the edit walk's position, which is a stamp and an id within it.

    Spelled as a disjunction rather than a row-value comparison because both dialects
    have to plan it against the `updated_at` index.
    """
    return or_(
        source.updated_at_column > updated_at,
        and_(
            source.updated_at_column == updated_at,
            source.id_column > annotation_id,
        ),
    )


def _span_annotation_scan() -> Select[Any]:
    return (
        select(
            models.SpanAnnotation.id,
            models.SpanAnnotation.span_rowid.label("target_rowid"),
            models.SpanAnnotation.updated_at,
            models.SpanAnnotation.name,
            models.SpanAnnotation.label,
            models.SpanAnnotation.score,
            models.SpanAnnotation.annotator_kind,
            models.SpanAnnotation.source,
            models.SpanAnnotation.user_id,
            models.SpanAnnotation.identifier,
            models.ProjectSession.project_id,
            models.ProjectSession.id.label("project_session_rowid"),
        )
        .join(models.Span, models.SpanAnnotation.span_rowid == models.Span.id)
        .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
        .join(models.ProjectSession, models.Trace.project_session_rowid == models.ProjectSession.id)
        .where(~models.SpanAnnotation.identifier.startswith(ONLINE_EVAL_IDENTIFIER_PREFIX))
    )


def _trace_annotation_scan() -> Select[Any]:
    return (
        select(
            models.TraceAnnotation.id,
            models.TraceAnnotation.trace_rowid.label("target_rowid"),
            models.TraceAnnotation.updated_at,
            models.TraceAnnotation.name,
            models.TraceAnnotation.label,
            models.TraceAnnotation.score,
            models.TraceAnnotation.annotator_kind,
            models.TraceAnnotation.source,
            models.TraceAnnotation.user_id,
            models.TraceAnnotation.identifier,
            models.ProjectSession.project_id,
            models.ProjectSession.id.label("project_session_rowid"),
        )
        .join(models.Trace, models.TraceAnnotation.trace_rowid == models.Trace.id)
        .join(models.ProjectSession, models.Trace.project_session_rowid == models.ProjectSession.id)
        .where(~models.TraceAnnotation.identifier.startswith(ONLINE_EVAL_IDENTIFIER_PREFIX))
    )


def _session_annotation_scan() -> Select[Any]:
    return (
        select(
            models.ProjectSessionAnnotation.id,
            models.ProjectSessionAnnotation.project_session_id.label("target_rowid"),
            models.ProjectSessionAnnotation.updated_at,
            models.ProjectSessionAnnotation.name,
            models.ProjectSessionAnnotation.label,
            models.ProjectSessionAnnotation.score,
            models.ProjectSessionAnnotation.annotator_kind,
            models.ProjectSessionAnnotation.source,
            models.ProjectSessionAnnotation.user_id,
            models.ProjectSessionAnnotation.identifier,
            models.ProjectSession.project_id,
            models.ProjectSession.id.label("project_session_rowid"),
        )
        .join(
            models.ProjectSession,
            models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
        )
        .where(
            ~models.ProjectSessionAnnotation.identifier.startswith(ONLINE_EVAL_IDENTIFIER_PREFIX)
        )
    )


# Each source joins through to the session its annotation belongs to, so an annotation on
# a trace that is in no session drops out of the scan and announces nothing.
_SOURCES = (
    _AnnotationSource(
        annotation_kind="span",
        evaluation_target="SPAN",
        id_column=models.SpanAnnotation.id,
        updated_at_column=models.SpanAnnotation.updated_at,
        scan=_span_annotation_scan(),
    ),
    _AnnotationSource(
        annotation_kind="trace",
        evaluation_target="TRACE",
        id_column=models.TraceAnnotation.id,
        updated_at_column=models.TraceAnnotation.updated_at,
        scan=_trace_annotation_scan(),
    ),
    _AnnotationSource(
        annotation_kind="session",
        evaluation_target="SESSION",
        id_column=models.ProjectSessionAnnotation.id,
        updated_at_column=models.ProjectSessionAnnotation.updated_at,
        scan=_session_annotation_scan(),
    ),
)


class AnnotationDeltaAdapter(DaemonTask):
    """Announces upserted annotations as signals, one leased scan tick at a time.

    Its durable state is two positions per annotation table, kept in `eval_work_cursors`:
    ``produced_through_id`` is the id the insert walk has reached, and ``observed_at`` is
    the ``updated_at`` the edit walk has reached.
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
        self._holder_id = f"annotation-delta-{token_hex(8)}"
        # Both walks stop this far short of the present, and the lag must exceed the
        # longest plausible annotation-write transaction. `updated_at` is stamped with the
        # writing transaction's start time on PostgreSQL, so a slow writer can commit a
        # row stamped earlier than one that has already been walked past; a lag shorter
        # than that transaction loses the row. The sweeper's ambient arm, not a longer
        # lag, is what eventually re-covers a session whose annotation was missed.
        self._frontier_lag_seconds = get_env_online_eval_frontier_lag_seconds()
        # The pending observation is a gate, not a position, so it is not persisted:
        # whoever takes the lease next re-reads the high water mark and waits one lag
        # before its first insert walk, which costs latency and never coverage.
        self._observations: dict[models.AnnotationKind, _Observation] = {}
        self._lease = DatabaseLease(
            db,
            entity=models.EvalWorkLease,
            key=(models.EvalWorkLease.name == _LEASE_NAME,),
            holder_column=models.EvalWorkLease.holder,
            heartbeat_column=models.EvalWorkLease.heartbeat_at,
            holder_id=self._holder_id,
            ttl_seconds=ANNOTATION_DELTA_LEASE_TTL_SECONDS,
        )

    async def _run(self) -> None:
        try:
            while self._running:
                try:
                    await self._tick()
                except Exception:
                    logger.exception("Annotation delta adapter tick failed")
                await asyncio.sleep(self._tick_interval_seconds)
        finally:
            await self._release_lease()

    async def _tick(self) -> None:
        mutations_allowed = not self._db.should_not_insert_or_update
        lease_id = await self._lease.acquire(
            models.EvalWorkLease.id,
            bootstrap=self._insert_lease if mutations_allowed else None,
        )
        if lease_id is None:
            return
        try:
            if not mutations_allowed:
                await self._lease.renew()
                return
            for source in _SOURCES:
                await self._scan(source)
        except LeaseLost:
            logger.warning("Annotation delta adapter tick aborted after losing its lease")

    async def _insert_lease(self, session: AsyncSession) -> None:
        await session.execute(
            insert_on_conflict(
                {"name": _LEASE_NAME},
                table=models.EvalWorkLease,
                dialect=self._db.dialect,
                unique_by=("name",),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )

    async def _release_lease(self) -> None:
        try:
            await self._lease.release()
        except Exception:
            logger.exception("Failed to release annotation delta adapter lease")

    async def _scan(self, source: _AnnotationSource) -> None:
        async with self._db() as session:
            cursor = await self._cursor(session, source)
            now = await self._lease.database_now(session)
            edits_through = cursor.observed_at
            if edits_through is None:
                positions = await self._start_at_the_present(session, source, now)
            else:
                positions = await self._walk(session, source, cursor, edits_through, now)
            if positions:
                await session.execute(
                    update(models.EvalWorkCursor)
                    .where(models.EvalWorkCursor.id == cursor.id)
                    .values(**positions)
                )
            await self._lease.fence(session)

    async def _cursor(
        self,
        session: AsyncSession,
        source: _AnnotationSource,
    ) -> models.EvalWorkCursor:
        stmt = select(models.EvalWorkCursor).where(
            models.EvalWorkCursor.evaluation_target == source.evaluation_target,
            models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
        )
        cursor = await session.scalar(stmt)
        if cursor is None:
            await session.execute(
                insert_on_conflict(
                    {
                        "evaluation_target": source.evaluation_target,
                        "consumer_group": _CONSUMER_GROUP,
                        "produced_through_id": 0,
                    },
                    table=models.EvalWorkCursor,
                    dialect=self._db.dialect,
                    unique_by=("evaluation_target", "consumer_group"),
                    on_conflict=OnConflict.DO_NOTHING,
                )
            )
            cursor = await session.scalar(stmt)
        if cursor is None:
            raise RuntimeError(f"No {source.annotation_kind} annotation cursor to scan from")
        return cursor

    async def _start_at_the_present(
        self,
        session: AsyncSession,
        source: _AnnotationSource,
        now: datetime,
    ) -> dict[str, Any]:
        """Place both walks at the present, so nothing written before now is announced."""
        high_water = await session.scalar(select(func.max(source.id_column)))
        latest_edit = await session.scalar(select(func.max(source.updated_at_column)))
        return {
            "produced_through_id": high_water or 0,
            # The table's own newest stamp when it has one, so the starting point sits in
            # the same clock domain as the values the edit walk compares against. An empty
            # table has no stamp to start from and nothing to skip past either: the edit
            # walk sees no row until the insert walk has advanced past it.
            "observed_at": latest_edit or now - timedelta(seconds=self._frontier_lag_seconds),
            "edits_through_id": high_water or 0,
        }

    async def _walk(
        self,
        session: AsyncSession,
        source: _AnnotationSource,
        cursor: models.EvalWorkCursor,
        edits_walked_through: datetime,
        now: datetime,
    ) -> dict[str, Any]:
        positions: dict[str, Any] = {}
        # The edit frontier is read from the table the walk reads, not from the database
        # clock: `updated_at` is stamped by whoever wrote the row, so a frontier taken
        # from a clock the writers do not share would step past edits whenever the two
        # drift apart by more than the lag, and the id walk cannot recover them. Waiting
        # for the table's own newest stamp to clear the lag is the evidence that a window
        # has closed. A table nobody writes to therefore holds its last edits until the
        # next write reaches it, which costs latency rather than coverage.
        latest_edit = await session.scalar(select(func.max(source.updated_at_column)))
        if latest_edit is not None:
            edits_through = min(
                latest_edit - timedelta(seconds=self._frontier_lag_seconds),
                edits_walked_through + _MAX_EDIT_CATCHUP,
            )
            if _window_is_open(edits_walked_through, cursor.edits_through_id, edits_through):
                rows = await self._announce(
                    session,
                    source,
                    edge="updated",
                    stmt=source.scan.where(
                        source.id_column <= cursor.produced_through_id,
                        _after(source, edits_walked_through, cursor.edits_through_id),
                        source.updated_at_column <= edits_through,
                    )
                    .order_by(source.updated_at_column, source.id_column)
                    .limit(_MAX_EDIT_ROWS_PER_TICK),
                )
                if len(rows) < _MAX_EDIT_ROWS_PER_TICK:
                    # The window held no more rows, so the position moves to its end. A
                    # row stamped exactly there is read again next tick and collapses.
                    positions["observed_at"] = edits_through
                    positions["edits_through_id"] = 0
                else:
                    # The cap cut the window short. Advancing only to the last row that
                    # was actually announced leaves the rest of the window for the next
                    # tick, so a failure repeats one capped slice rather than the whole
                    # window, forever.
                    positions["observed_at"] = rows[-1].updated_at
                    positions["edits_through_id"] = rows[-1].id

        frontier = await self._insert_frontier(session, source, cursor, now)
        if frontier is not None:
            await self._announce(
                session,
                source,
                edge="created",
                stmt=source.scan.where(
                    source.id_column > cursor.produced_through_id,
                    source.id_column <= frontier,
                ).order_by(source.id_column),
            )
            positions["produced_through_id"] = frontier
        return positions

    async def _insert_frontier(
        self,
        session: AsyncSession,
        source: _AnnotationSource,
        cursor: models.EvalWorkCursor,
        now: datetime,
    ) -> Optional[int]:
        """The id to walk to this tick, or None while the frontier gate is closed.

        A pending observation is held until it has been walked past. Re-reading the high
        water mark every tick would reset its age instead, and the gate would then never
        open at any tick interval shorter than the lag.
        """
        observation = self._observations.get(source.annotation_kind)
        if observation is None:
            high_water = await session.scalar(select(func.max(source.id_column)))
            if high_water is None or high_water <= cursor.produced_through_id:
                return None
            observation = _Observation(high_water_id=high_water, observed_at=now)
            self._observations[source.annotation_kind] = observation
        if (now - observation.observed_at).total_seconds() < self._frontier_lag_seconds:
            return None
        if observation.high_water_id <= cursor.produced_through_id:
            del self._observations[source.annotation_kind]
            return None
        frontier = min(
            observation.high_water_id,
            cursor.produced_through_id + _MAX_ANNOTATION_IDS_PER_TICK,
        )
        if frontier == observation.high_water_id:
            del self._observations[source.annotation_kind]
        return frontier

    async def _announce(
        self,
        session: AsyncSession,
        source: _AnnotationSource,
        *,
        edge: models.AnnotationEdge,
        stmt: Select[Any],
    ) -> Sequence[Any]:
        """Log every row `stmt` selects, in the order it selects them."""
        rows = (await session.execute(stmt)).all()
        for row in rows:
            await append(
                session,
                AnnotationUpserted(
                    annotation_kind=source.annotation_kind,
                    annotation_id=row.id,
                    target_rowid=row.target_rowid,
                    edge=edge,
                    updated_at=row.updated_at,
                    name=row.name,
                    label=row.label,
                    score=row.score,
                    annotator_kind=row.annotator_kind,
                    source=row.source,
                    user_id=row.user_id,
                    identifier=row.identifier,
                ),
                project_id=row.project_id,
                project_session_rowid=row.project_session_rowid,
            )
        return rows
