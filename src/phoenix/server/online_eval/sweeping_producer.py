"""Sweeping evaluation producers: add trace and session evaluations once the trace or
session has gone quiet for its evaluator's delay."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Any, Callable, ClassVar, Literal, Optional, Sequence

from sqlalchemy import (
    ColumnElement,
    Float,
    Insert,
    Integer,
    and_,
    case,
    cast,
    column,
    func,
    literal,
    or_,
    select,
    text,
    true,
    update,
)
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlalchemy.sql.selectable import ScalarSelect, Subquery
from typing_extensions import assert_never

from phoenix.config import get_env_enable_prometheus
from phoenix.db import models
from phoenix.db.eval_work import (
    REOFFERED_STATUSES,
    swept_target_terminal_index_predicate,
)
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.clock import (
    TERMINAL_METRICS_WINDOW_SECONDS,
    VISIBILITY_LAG_SECONDS,
    current_database_time,
)
from phoenix.server.online_eval.derivation import sample_key
from phoenix.server.online_eval.leases import ScanLease
from phoenix.server.online_eval.project_evaluator_resolution import (
    load_enabled_project_evaluator_pairs,
    resolve_project_evaluators_bulk,
)
from phoenix.server.prometheus import (
    ONLINE_EVAL_ADDED_WORK_UNITS,
    ONLINE_EVAL_DECIDED_THROUGH_LAG_SECONDS,
    ONLINE_EVAL_SWEEP_ATTEMPTS,
    ONLINE_EVAL_SWEEP_DURATION_SECONDS,
    ONLINE_EVAL_SWEEP_ELIGIBLE_EVALUATIONS,
    ONLINE_EVAL_SWEEP_FAILURES,
    ONLINE_EVAL_SWEEP_SUCCESSES,
)
from phoenix.server.session_filters import get_filtered_session_rowids_subquery
from phoenix.server.trace_filters import get_filtered_trace_rowids_subquery
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

SWEEP_INTERVAL_SECONDS = 10.0

_MAX_EVALUATIONS_PER_TICK = 1000
_LOCK_TIMEOUT_MILLISECONDS = 500
_LOCK_CONFLICT_SQLSTATES = frozenset({"55P03", "40P01"})  # lock_not_available, deadlock_detected

_SweptTargetModel = type[models.ProjectSession] | type[models.Trace]
_SweptWorkUnitModel = type[models.EvalSessionWorkUnit] | type[models.EvalTraceWorkUnit]


class _PageRowDeletedError(Exception):
    """A project evaluator or target on the page was deleted before its work was inserted.

    The page is read without locks, so the insert's foreign keys are what catch the
    deletion; the tick rolls back and the next tick's page no longer holds the row. On
    PostgreSQL the tick waits on a deletion that hasn't committed, and if it doesn't
    commit within the lock timeout the tick ends in ``_LockConflictError`` instead.
    """


class _LockConflictError(Exception):
    """The tick gave up a lock wait, or was chosen to break a deadlock, and rolled back."""


def _is_lock_conflict(error: DBAPIError) -> bool:
    return getattr(error.orig, "sqlstate", None) in _LOCK_CONFLICT_SQLSTATES


@dataclass(frozen=True)
class _SweptTarget:
    """The tables, columns and filter one swept target is read through."""

    evaluation_target: Literal["TRACE", "SESSION"]
    target_model: _SweptTargetModel
    target_project_id_column: str
    sample_key_column: str
    work_unit_model: _SweptWorkUnitModel
    work_unit_target_column: str
    filtered_target_rowids_subquery: Callable[
        [str, Sequence[int], Sequence[int]], ScalarSelect[int]
    ]
    lease_name: str


@dataclass(frozen=True)
class _SweepOutcome:
    queued_count: int
    eligible_count: Optional[int]
    full_page_decided: bool
    """The page reached the per-tick limit and wrote at least one decision, so more
    evaluations may already be due."""


@dataclass(frozen=True)
class _SweepProjectEvaluator:
    project_evaluator_id: int
    project_id: int
    delay_seconds: int
    created_at: datetime
    sweep_start: datetime
    filter_condition: str
    sampling_rate: float


def _project_evaluator_relation(
    project_evaluators: Sequence[_SweepProjectEvaluator],
    dialect: SupportedSQLDialect,
) -> Subquery:
    """Return a portable inline relation for resolved project evaluators.

    Bind names are keyed off ``project_evaluator_id`` rather than row position: several of these
    relations are unioned into one statement, and ``text()`` binds are not unique, so
    position-keyed names from different relations would silently overwrite each other.
    """
    rows = []
    parameters: dict[str, Any] = {}
    for index, project_evaluator in enumerate(project_evaluators):
        prefix = f"sc{project_evaluator.project_evaluator_id}"
        row_parameters = {
            f"{prefix}_project_evaluator_id": project_evaluator.project_evaluator_id,
            f"{prefix}_project_id": project_evaluator.project_id,
            f"{prefix}_delay_seconds": project_evaluator.delay_seconds,
            f"{prefix}_sweep_start": project_evaluator.sweep_start,
            f"{prefix}_sampling_rate": project_evaluator.sampling_rate,
        }
        parameters.update(row_parameters)
        placeholders = [f":{name}" for name in row_parameters]
        if index == 0:
            timestamp_type = (
                "TIMESTAMP WITH TIME ZONE" if dialect is SupportedSQLDialect.POSTGRESQL else "TEXT"
            )
            placeholders = [
                f"CAST({placeholders[0]} AS INTEGER)",
                f"CAST({placeholders[1]} AS INTEGER)",
                f"CAST({placeholders[2]} AS INTEGER)",
                f"CAST({placeholders[3]} AS {timestamp_type})",
                f"CAST({placeholders[4]} AS FLOAT)",
            ]
        rows.append(f"({', '.join(placeholders)})")
    statement = text(
        "SELECT "
        "sc.column1 AS project_evaluator_id, "
        "sc.column2 AS project_id, "
        "sc.column3 AS delay_seconds, "
        "sc.column4 AS sweep_start, "
        "sc.column5 AS sampling_rate "
        f"FROM (VALUES {', '.join(rows)}) AS sc"
    )
    return (
        statement.bindparams(**parameters)
        .columns(
            column("project_evaluator_id", Integer),
            column("project_id", Integer),
            column("delay_seconds", Integer),
            column("sweep_start", models.UtcTimeStamp()),
            column("sampling_rate", Float),
        )
        .subquery("sweep_evaluators")
    )


def _due_evaluations_relation(
    target: _SweptTarget,
    project_evaluators: Sequence[_SweepProjectEvaluator],
    database_now: datetime,
    dialect: SupportedSQLDialect,
) -> Subquery:
    project_evaluator_relation = _project_evaluator_relation(project_evaluators, dialect)
    target_model = target.target_model
    work = aliased(target.work_unit_model)
    if dialect is SupportedSQLDialect.SQLITE:
        due_at = (
            cast(func.julianday(target_model.last_span_ingested_at), Float) * 86_400
            + project_evaluator_relation.c.delay_seconds
        )
        current_time = cast(func.julianday(database_now), Float) * 86_400
    else:
        due_at = (
            func.extract("epoch", target_model.last_span_ingested_at)
            + project_evaluator_relation.c.delay_seconds
        )
        current_time = func.extract("epoch", literal(database_now))
    return (
        select(
            target_model.id.label("target_rowid"),
            getattr(target_model, target.sample_key_column).label("sample_identity"),
            project_evaluator_relation.c.project_evaluator_id,
            project_evaluator_relation.c.sampling_rate,
            target_model.last_span_ingested_at.label("decided_through"),
            due_at.label("effective_due_time"),
        )
        .select_from(target_model)
        .join(
            project_evaluator_relation,
            getattr(target_model, target.target_project_id_column)
            == project_evaluator_relation.c.project_id,
        )
        .outerjoin(
            work,
            and_(
                getattr(work, target.work_unit_target_column) == target_model.id,
                work.project_evaluator_id == project_evaluator_relation.c.project_evaluator_id,
            ),
        )
        .where(
            target_model.last_span_ingested_at.is_not(None),
            target_model.last_span_ingested_at >= project_evaluator_relation.c.sweep_start,
            due_at <= current_time,
            or_(
                work.id.is_(None),
                _reofferable(work, target_model.last_span_ingested_at),
            ),
        )
        .subquery("due_evaluations")
    )


def _work_write_statement(
    target: _SweptTarget,
    decisions: Sequence[dict[str, Any]],
    dialect: SupportedSQLDialect,
) -> Insert:
    """Write scheduling decisions: insert a row for a new evaluation, or re-offer its row in
    place when it ended without a result before the target's latest activity."""
    work_unit_model = target.work_unit_model
    index_elements = (
        getattr(work_unit_model, target.work_unit_target_column),
        work_unit_model.project_evaluator_id,
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        statement = insert_postgresql(work_unit_model).values(decisions)
        excluded = statement.excluded
        return statement.on_conflict_do_update(
            index_elements=index_elements,
            set_=_reoffer_values(excluded),
            where=_reofferable(work_unit_model, excluded.decided_through),
        ).returning(work_unit_model.status)
    if dialect is SupportedSQLDialect.SQLITE:
        sqlite_statement = insert_sqlite(work_unit_model).values(decisions)
        sqlite_excluded = sqlite_statement.excluded
        return sqlite_statement.on_conflict_do_update(
            index_elements=index_elements,
            set_=_reoffer_values(sqlite_excluded),
            where=_reofferable(work_unit_model, sqlite_excluded.decided_through),
        ).returning(work_unit_model.status)
    assert_never(dialect)


def _reoffer_values(excluded: Any) -> dict[str, Any]:
    """The new decision, with the retry state of the previous offer cleared."""
    return {
        "status": excluded.status,
        "decided_through": excluded.decided_through,
        "attempts": 0,
        "error": None,
        "claimed_at": None,
        "claimed_by": None,
        "cooldown_until": None,
        "created_at": excluded.created_at,
        "updated_at": excluded.updated_at,
    }


def _reofferable(work_unit: Any, activity_through: Any) -> ColumnElement[bool]:
    """A failed, expired, or content-lost session or trace is retried when new spans arrive
    after it failed; spans that arrived while it was running might not trigger a retry."""
    reofferable: ColumnElement[bool] = and_(
        work_unit.status.in_(REOFFERED_STATUSES),
        work_unit.decided_through < activity_through,
    )
    return reofferable


class SweepingEvaluationProducer(DaemonTask):
    """Adds evaluations for one swept target once a target has gone quiet; subclasses fix
    the target."""

    _target: ClassVar[_SweptTarget]

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        tick_interval_seconds: float = SWEEP_INTERVAL_SECONDS,
    ) -> None:
        super().__init__()
        target = self._target
        evaluation_target = target.evaluation_target
        self._db = db
        self._evaluation_target = evaluation_target
        self._metric_labels = {"evaluation_target": evaluation_target}
        ONLINE_EVAL_SWEEP_ELIGIBLE_EVALUATIONS.labels(**self._metric_labels)
        ONLINE_EVAL_ADDED_WORK_UNITS.labels(**self._metric_labels)
        ONLINE_EVAL_DECIDED_THROUGH_LAG_SECONDS.labels(**self._metric_labels)
        ONLINE_EVAL_SWEEP_ATTEMPTS.labels(**self._metric_labels)
        ONLINE_EVAL_SWEEP_DURATION_SECONDS.labels(**self._metric_labels)
        ONLINE_EVAL_SWEEP_FAILURES.labels(**self._metric_labels)
        ONLINE_EVAL_SWEEP_SUCCESSES.labels(**self._metric_labels)
        self._tick_interval_seconds = tick_interval_seconds
        self._visibility_lag = timedelta(seconds=VISIBILITY_LAG_SECONDS)
        self._publish_metrics = get_env_enable_prometheus()
        self._lease = ScanLease(
            db,
            name=target.lease_name,
            holder=f"{evaluation_target.lower()}-producer-{token_hex(8)}",
        )

    async def _run(self) -> None:
        try:
            while self._running:
                full_page_decided = False
                try:
                    full_page_decided = await self._tick()
                except _PageRowDeletedError as error:
                    logger.warning(
                        f"{self._evaluation_target} evaluation sweep rolled back: a project "
                        f"evaluator or {self._evaluation_target.lower()} on its page was "
                        f"deleted before its work was inserted ({error})"
                    )
                except _LockConflictError as error:
                    logger.warning(
                        f"{self._evaluation_target} evaluation sweep rolled back: it gave way "
                        f"to a concurrent transaction holding a lock it needed ({error})"
                    )
                except Exception:
                    logger.exception(f"{self._evaluation_target} evaluation sweep failed")
                await asyncio.sleep(0 if full_page_decided else self._tick_interval_seconds)
        finally:
            # A second cancellation while stop() drains would abort the release and leave the
            # lease held until its 90 s TTL expires; the shield keeps the release running.
            await asyncio.shield(asyncio.ensure_future(self._lease.release()))

    async def _tick(self) -> bool:
        """Run one tick, returning whether it decided a full page and still holds the lease,
        so the next tick can start at once."""
        if not await self._lease.acquire():
            return False
        full_page_decided = False
        if not self._db.should_not_insert_or_update:
            full_page_decided = await self._run_sweep()
        return await self._lease.renew() and full_page_decided

    async def _run_sweep(self) -> bool:
        started_at = time.monotonic()
        labels = self._metric_labels
        if self._publish_metrics:
            ONLINE_EVAL_SWEEP_ATTEMPTS.labels(**labels).inc()
        try:
            async with self._db() as session:
                if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
                    # The sweep retries every tick, so it gives up a lock wait before
                    # PostgreSQL's deadlock check (1 s by default) picks which side to abort.
                    await session.execute(
                        text(f"SET LOCAL lock_timeout = '{_LOCK_TIMEOUT_MILLISECONDS}ms'")
                    )
                database_now = await current_database_time(session, self._db.dialect)
                outcome = await self._sweep(session, database_now)
        except Exception as error:
            if self._publish_metrics:
                ONLINE_EVAL_SWEEP_FAILURES.labels(**labels).inc()
            if isinstance(error, DBAPIError) and _is_lock_conflict(error):
                raise _LockConflictError(str(error.orig)) from error
            raise
        finally:
            if self._publish_metrics:
                ONLINE_EVAL_SWEEP_DURATION_SECONDS.labels(**labels).observe(
                    time.monotonic() - started_at
                )
        if self._publish_metrics:
            ONLINE_EVAL_SWEEP_SUCCESSES.labels(**labels).inc()
            ONLINE_EVAL_ADDED_WORK_UNITS.labels(**labels).inc(outcome.queued_count)
            await self._publish_eligibility_metrics(outcome.eligible_count)
        return outcome.full_page_decided

    async def _load_evaluators(self, session: AsyncSession) -> list[_SweepProjectEvaluator]:
        project_evaluator_pairs = await load_enabled_project_evaluator_pairs(
            session, self._evaluation_target
        )
        project_evaluator_rows: list[_SweepProjectEvaluator] = []
        resolved_rows = await resolve_project_evaluators_bulk(session, project_evaluator_pairs)
        for (project_evaluator, evaluator), resolved in zip(
            project_evaluator_pairs,
            resolved_rows,
            strict=True,
        ):
            if resolved is None:
                logger.warning(
                    f"Skipping project_evaluator {project_evaluator.id}: "
                    f"no resolvable version for evaluator {evaluator.id}"
                )
                continue
            if project_evaluator.filter_condition and not self._filter_compiles(project_evaluator):
                continue
            project_evaluator_rows.append(
                _SweepProjectEvaluator(
                    project_evaluator_id=project_evaluator.id,
                    project_id=project_evaluator.project_id,
                    delay_seconds=project_evaluator.evaluation_delay_seconds,
                    created_at=project_evaluator.created_at,
                    sweep_start=(project_evaluator.swept_through_at or project_evaluator.created_at)
                    - self._visibility_lag,
                    filter_condition=project_evaluator.filter_condition,
                    sampling_rate=project_evaluator.sampling_rate,
                )
            )
        return project_evaluator_rows

    def _filter_compiles(self, project_evaluator: models.ProjectEvaluator) -> bool:
        """Whether this evaluator's stored filter compiles in this target's filter language."""
        try:
            self._target.filtered_target_rowids_subquery(
                project_evaluator.filter_condition,
                [project_evaluator.project_id],
                (),
            )
        except Exception as error:
            logger.warning(
                f"Skipping project_evaluator {project_evaluator.id}: "
                f"filter condition does not compile for {self._evaluation_target} "
                f"evaluation: {error}"
            )
            return False
        return True

    async def _sweep(
        self,
        session: AsyncSession,
        database_now: datetime,
    ) -> _SweepOutcome:
        """Decide this tick's due evaluations."""
        project_evaluators = await self._load_evaluators(session)
        return await self._decide_due_evaluations(
            session,
            database_now,
            project_evaluators,
            limit=_MAX_EVALUATIONS_PER_TICK,
        )

    async def _decide_due_evaluations(
        self,
        session: AsyncSession,
        database_now: datetime,
        project_evaluators: Sequence[_SweepProjectEvaluator],
        *,
        limit: int,
    ) -> _SweepOutcome:
        if not project_evaluators:
            return _SweepOutcome(
                queued_count=0,
                eligible_count=0 if self._publish_metrics else None,
                full_page_decided=False,
            )
        target = self._target
        relation = _due_evaluations_relation(
            target,
            project_evaluators,
            database_now,
            self._db.dialect,
        )
        rows = (
            await session.execute(
                select(relation)
                .order_by(
                    relation.c.effective_due_time,
                    relation.c.target_rowid,
                    relation.c.project_evaluator_id,
                )
                .limit(limit)
            )
        ).all()
        page_full = len(rows) >= limit
        if not page_full:
            await self._advance_sweep_positions_to_due_time(
                session,
                project_evaluators,
                database_now,
            )
        else:
            await self._advance_sweep_positions_through_page(session, rows)
        filter_verdicts = await self._read_filter_verdicts(session, project_evaluators, rows)
        decisions: list[dict[str, Any]] = []
        for row in rows:
            passes_filter = filter_verdicts.get((row.project_evaluator_id, row.target_rowid))
            if passes_filter is None:
                continue
            if not passes_filter:
                status: models.SweptTargetWorkStatus = "FILTERED_OUT"
            elif sample_key(row.sample_identity) >= row.sampling_rate:
                status = "SAMPLED_OUT"
            else:
                status = "PENDING"
            decisions.append(
                {
                    target.work_unit_target_column: row.target_rowid,
                    "project_evaluator_id": row.project_evaluator_id,
                    "decided_through": row.decided_through,
                    "status": status,
                }
            )
        eligible_count = sum(filter_verdicts.values()) if self._publish_metrics else None
        if not decisions:
            return _SweepOutcome(
                queued_count=0,
                eligible_count=eligible_count,
                full_page_decided=False,
            )
        try:
            written_statuses = (
                await session.scalars(
                    _work_write_statement(
                        target,
                        decisions,
                        self._db.dialect,
                    )
                )
            ).all()
        except IntegrityError as error:
            raise _PageRowDeletedError(str(error.orig)) from error
        return _SweepOutcome(
            queued_count=written_statuses.count("PENDING"),
            eligible_count=eligible_count,
            full_page_decided=page_full and bool(written_statuses),
        )

    async def _read_filter_verdicts(
        self,
        session: AsyncSession,
        project_evaluators: Sequence[_SweepProjectEvaluator],
        rows: Sequence[Any],
    ) -> dict[tuple[int, int], bool]:
        """Whether each evaluation on the page passes its evaluator's filter, keyed by
        (project evaluator, target), for evaluations whose target is still at the activity
        the page read.

        Each evaluator's statement reads its targets' activity together with the filter, so
        an evaluation is decided on the content its target had, quiet, at the page read; the
        consumer later evaluates whatever content the target has when it runs. An evaluation
        whose target has moved on is left out and stays undecided until a later tick sees the
        target quiet, and so are the evaluations of an evaluator whose filter fails when it
        runs.
        """
        target = self._target
        target_model = target.target_model
        decided_through = {row.target_rowid: row.decided_through for row in rows}
        verdicts: dict[tuple[int, int], bool] = {}
        for project_evaluator in project_evaluators:
            target_rowids = tuple(
                row.target_rowid
                for row in rows
                if row.project_evaluator_id == project_evaluator.project_evaluator_id
            )
            if not target_rowids:
                continue
            passes_filter: ColumnElement[bool] = (
                target_model.id.in_(
                    target.filtered_target_rowids_subquery(
                        project_evaluator.filter_condition,
                        [project_evaluator.project_id],
                        target_rowids,
                    )
                )
                if project_evaluator.filter_condition
                else true()
            )
            try:
                async with session.begin_nested():
                    result = (
                        await session.execute(
                            select(
                                target_model.id,
                                target_model.last_span_ingested_at,
                                passes_filter,
                            ).where(target_model.id.in_(target_rowids))
                        )
                    ).all()
            except (DBAPIError, OverflowError) as error:
                if isinstance(error, DBAPIError) and _is_lock_conflict(error):
                    raise
                logger.warning(
                    f"Skipping project_evaluator {project_evaluator.project_evaluator_id} this "
                    "tick: its filter condition failed when run: "
                    f"{error.orig if isinstance(error, DBAPIError) else error}"
                )
                continue
            for target_rowid, activity_through, passes in result:
                if activity_through == decided_through[target_rowid]:
                    verdicts[(project_evaluator.project_evaluator_id, target_rowid)] = passes
        return verdicts

    async def _advance_sweep_positions_to_due_time(
        self,
        session: AsyncSession,
        project_evaluators: Sequence[_SweepProjectEvaluator],
        database_now: datetime,
    ) -> None:
        """Record that every loaded evaluator has swept everything already due to it."""
        await self._write_sweep_positions(
            session,
            {
                project_evaluator.project_evaluator_id: max(
                    project_evaluator.created_at,
                    database_now - timedelta(seconds=project_evaluator.delay_seconds),
                )
                for project_evaluator in project_evaluators
            },
        )

    async def _advance_sweep_positions_through_page(
        self,
        session: AsyncSession,
        rows: Sequence[Any],
    ) -> None:
        """Record how far a truncated page reached, per evaluator."""
        sweep_positions: dict[int, datetime] = {}
        for row in rows:
            reached = sweep_positions.get(row.project_evaluator_id)
            if reached is None or row.decided_through > reached:
                sweep_positions[row.project_evaluator_id] = row.decided_through
        await self._write_sweep_positions(session, sweep_positions)

    async def _write_sweep_positions(
        self,
        session: AsyncSession,
        sweep_positions: dict[int, datetime],
    ) -> None:
        if not sweep_positions:
            return
        project_evaluator_ids = sorted(sweep_positions)
        sweep_position = case(
            {
                project_evaluator_id: literal(
                    sweep_positions[project_evaluator_id], models.UtcTimeStamp()
                )
                for project_evaluator_id in project_evaluator_ids
            },
            value=models.ProjectEvaluator.id,
        )
        await session.execute(
            update(models.ProjectEvaluator)
            .where(
                models.ProjectEvaluator.id.in_(project_evaluator_ids),
                or_(
                    models.ProjectEvaluator.swept_through_at.is_(None),
                    models.ProjectEvaluator.swept_through_at < sweep_position,
                ),
            )
            .values(
                swept_through_at=sweep_position,
                # Pinned: the column's onupdate would restamp every enabled evaluator a tick.
                updated_at=models.ProjectEvaluator.updated_at,
            )
        )

    async def _publish_eligibility_metrics(self, eligible_count: Optional[int]) -> None:
        """Publish the sweep's observation gauges from a session of its own.

        Reporting is not part of the sweep: this runs after the work has been committed,
        over its own read session, so a failing aggregate costs a stale gauge rather than
        the sweep that already succeeded.
        """
        if eligible_count is not None:
            ONLINE_EVAL_SWEEP_ELIGIBLE_EVALUATIONS.labels(**self._metric_labels).set(eligible_count)
        try:
            async with self._db.read() as session:
                database_now = await current_database_time(session, self._db.dialect)
                await self._publish_decided_through_lag(session, database_now)
        except Exception:
            logger.exception(
                f"Failed to publish {self._evaluation_target} evaluation decided-through lag"
            )

    async def _publish_decided_through_lag(
        self,
        session: AsyncSession,
        database_now: datetime,
    ) -> None:
        target = self._target
        target_model = target.target_model
        work_unit_model = target.work_unit_model
        if self._db.dialect is SupportedSQLDialect.SQLITE:
            lag_seconds = (
                cast(func.julianday(target_model.last_span_ingested_at), Float)
                - cast(func.julianday(work_unit_model.decided_through), Float)
            ) * 86_400
        else:
            lag_seconds = func.extract(
                "epoch",
                target_model.last_span_ingested_at - work_unit_model.decided_through,
            )
        decided_through_lag_seconds = await session.scalar(
            select(func.max(lag_seconds))
            .select_from(work_unit_model)
            .join(
                target_model,
                getattr(work_unit_model, target.work_unit_target_column) == target_model.id,
            )
            .where(
                # SQLite reads a partial index only when the query repeats its predicate.
                text(swept_target_terminal_index_predicate()),
                work_unit_model.status == "DONE",
                work_unit_model.updated_at
                >= database_now - timedelta(seconds=TERMINAL_METRICS_WINDOW_SECONDS),
                target_model.last_span_ingested_at.is_not(None),
            )
        )
        ONLINE_EVAL_DECIDED_THROUGH_LAG_SECONDS.labels(**self._metric_labels).set(
            max(float(decided_through_lag_seconds or 0.0), 0.0)
        )


class TraceEvaluationProducer(SweepingEvaluationProducer):
    _target = _SweptTarget(
        evaluation_target="TRACE",
        target_model=models.Trace,
        target_project_id_column="project_rowid",
        sample_key_column="trace_id",
        work_unit_model=models.EvalTraceWorkUnit,
        work_unit_target_column="trace_rowid",
        filtered_target_rowids_subquery=lambda condition, project_rowids, candidate_rowids: (
            get_filtered_trace_rowids_subquery(
                condition,
                project_rowids,
                candidate_trace_rowids=candidate_rowids,
            )
        ),
        lease_name="trace-producer",
    )


class SessionEvaluationProducer(SweepingEvaluationProducer):
    _target = _SweptTarget(
        evaluation_target="SESSION",
        target_model=models.ProjectSession,
        target_project_id_column="project_id",
        sample_key_column="session_id",
        work_unit_model=models.EvalSessionWorkUnit,
        work_unit_target_column="project_session_rowid",
        filtered_target_rowids_subquery=lambda condition, project_rowids, candidate_rowids: (
            get_filtered_session_rowids_subquery(
                condition,
                project_rowids,
                candidate_session_rowids=candidate_rowids,
            )
        ),
        lease_name="session-producer",
    )
