"""Materialize session evaluation work after session activity becomes old enough."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Any, Optional, Sequence

from sqlalchemy import (
    ColumnElement,
    Float,
    Insert,
    Integer,
    String,
    and_,
    any_,
    bindparam,
    cast,
    column,
    func,
    literal,
    or_,
    select,
    text,
    type_coerce,
    update,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, with_polymorphic
from sqlalchemy.sql import Select
from sqlalchemy.sql.selectable import Subquery
from typing_extensions import assert_never

from phoenix.config import get_env_enable_prometheus, get_env_online_eval_max_session_outstanding
from phoenix.db import models
from phoenix.db.eval_work import live_eval_work_index_predicate
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.criteria_resolution import resolve_criteria_bulk
from phoenix.server.online_eval.db_coordinator import reap_lapsed_leases
from phoenix.server.online_eval.derivation import (
    MAX_ATTEMPTS,
    STALE_FINGERPRINT_ERROR,
    config_fingerprint,
)
from phoenix.server.online_eval.session_policy import session_criteria_is_schedulable
from phoenix.server.prometheus import (
    ONLINE_EVAL_SESSION_ELIGIBLE_PAIR_BACKLOG,
    ONLINE_EVAL_SESSION_MATERIALIZED_WORK_UNITS,
    ONLINE_EVAL_SESSION_RESULT_WATERMARK_LAG_SECONDS,
    ONLINE_EVAL_SESSION_SWEEP_ATTEMPTS,
    ONLINE_EVAL_SESSION_SWEEP_DURATION_SECONDS,
    ONLINE_EVAL_SESSION_SWEEP_FAILURES,
    ONLINE_EVAL_SESSION_SWEEP_SUCCESSES,
)
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

SESSION_SWEEP_LEASE_TTL_SECONDS = 90.0
SESSION_SWEEP_INTERVAL_SECONDS = 10.0

_CONSUMER_GROUP = "default"
_SESSION_SWEEP_LEASE_NAME = "session-sweep"
_MAX_ELIGIBLE_PAIRS_PER_TICK = 1000
# Only work terminated within this window feeds the watermark-lag gauge; the table has
# no retention, so an unbounded aggregate would scan more rows on every tick forever.
_WATERMARK_LAG_WINDOW_SECONDS = 86_400.0

_LIVE_WORK_INDEX_PREDICATE = text(live_eval_work_index_predicate())

_SESSION_WORK_INSERT_COLUMNS = (
    "project_session_rowid",
    "evaluator_id",
    "criteria_id",
    "config_fingerprint",
    "evaluated_through",
)


@dataclass(frozen=True)
class _SessionCriteria:
    criteria_id: int
    project_id: int
    evaluator_id: int
    fingerprint: str
    delay_seconds: int
    created_at: datetime


def _criteria_relation(
    criteria: Sequence[_SessionCriteria],
    dialect: SupportedSQLDialect,
) -> Subquery:
    """Return a portable inline relation for resolved session criteria."""
    rows = []
    parameters: dict[str, Any] = {}
    for index, criterion in enumerate(criteria):
        row_parameters = {
            f"sc{index}_criteria_id": criterion.criteria_id,
            f"sc{index}_project_id": criterion.project_id,
            f"sc{index}_evaluator_id": criterion.evaluator_id,
            f"sc{index}_config_fingerprint": criterion.fingerprint,
            f"sc{index}_delay_seconds": criterion.delay_seconds,
            f"sc{index}_created_at": criterion.created_at,
        }
        parameters.update(row_parameters)
        placeholders = [f":{name}" for name in row_parameters]
        if index == 0:
            created_at_type = (
                "TIMESTAMP WITH TIME ZONE" if dialect is SupportedSQLDialect.POSTGRESQL else "TEXT"
            )
            placeholders = [
                f"CAST({placeholders[0]} AS INTEGER)",
                f"CAST({placeholders[1]} AS INTEGER)",
                f"CAST({placeholders[2]} AS INTEGER)",
                f"CAST({placeholders[3]} AS VARCHAR)",
                f"CAST({placeholders[4]} AS INTEGER)",
                f"CAST({placeholders[5]} AS {created_at_type})",
            ]
        rows.append(f"({', '.join(placeholders)})")
    statement = text(
        "SELECT "
        "sc.column1 AS criteria_id, "
        "sc.column2 AS project_id, "
        "sc.column3 AS evaluator_id, "
        "sc.column4 AS config_fingerprint, "
        "sc.column5 AS delay_seconds, "
        "sc.column6 AS created_at "
        f"FROM (VALUES {', '.join(rows)}) AS sc"
    )
    return (
        statement.bindparams(**parameters)
        .columns(
            column("criteria_id", Integer),
            column("project_id", Integer),
            column("evaluator_id", Integer),
            column("config_fingerprint", String),
            column("delay_seconds", Integer),
            column("created_at", models.UtcTimeStamp()),
        )
        .subquery("sweep_criteria")
    )


def _live_work_exists(criteria_relation: Subquery) -> ColumnElement[bool]:
    """Whether the session still holds a live dedup key for this criterion."""
    live_work = aliased(models.EvalSessionWorkUnit)
    return (
        select(1)
        .select_from(live_work)
        .where(
            live_work.project_session_rowid == models.ProjectSession.id,
            live_work.evaluator_id == criteria_relation.c.evaluator_id,
            live_work.config_fingerprint == criteria_relation.c.config_fingerprint,
            or_(
                live_work.status.in_(("PENDING", "RUNNING")),
                and_(
                    live_work.status == "ERROR",
                    live_work.attempts < MAX_ATTEMPTS,
                ),
            ),
        )
        .correlate(models.ProjectSession, criteria_relation)
        .exists()
    )


def _eligible_pairs_statement(
    criteria_relation: Subquery,
    database_now: datetime,
    dialect: SupportedSQLDialect,
) -> Select[Any]:
    successful_work = aliased(models.EvalSessionWorkUnit)
    terminal_work = aliased(models.EvalSessionWorkUnit)
    terminal_watermark = (
        select(func.max(terminal_work.evaluated_through))
        .where(
            terminal_work.project_session_rowid == models.ProjectSession.id,
            terminal_work.evaluator_id == criteria_relation.c.evaluator_id,
            terminal_work.config_fingerprint == criteria_relation.c.config_fingerprint,
            or_(
                terminal_work.status == "DONE",
                and_(
                    terminal_work.status == "EXPIRED",
                    or_(
                        terminal_work.error.is_(None),
                        terminal_work.error != STALE_FINGERPRINT_ERROR,
                    ),
                ),
                and_(
                    terminal_work.status == "ERROR",
                    terminal_work.attempts >= MAX_ATTEMPTS,
                ),
            ),
        )
        .correlate(models.ProjectSession, criteria_relation)
        .scalar_subquery()
    )
    successful_result_exists = (
        select(1)
        .select_from(successful_work)
        .where(
            successful_work.project_session_rowid == models.ProjectSession.id,
            successful_work.evaluator_id == criteria_relation.c.evaluator_id,
            successful_work.config_fingerprint == criteria_relation.c.config_fingerprint,
            successful_work.status == "DONE",
        )
        .correlate(models.ProjectSession, criteria_relation)
        .exists()
    )
    if dialect is SupportedSQLDialect.SQLITE:
        due_at = (
            cast(func.julianday(models.ProjectSession.last_span_ingested_at), Float) * 86_400
            + criteria_relation.c.delay_seconds
        )
        current_time = cast(func.julianday(database_now), Float) * 86_400
    else:
        due_at = (
            func.extract("epoch", models.ProjectSession.last_span_ingested_at)
            + criteria_relation.c.delay_seconds
        )
        current_time = func.extract("epoch", literal(database_now))
    return (
        select(
            models.ProjectSession.id.label("project_session_rowid"),
            criteria_relation.c.criteria_id,
            criteria_relation.c.evaluator_id,
            criteria_relation.c.config_fingerprint,
            models.ProjectSession.last_span_ingested_at.label("evaluated_through"),
            due_at.label("effective_due_time"),
        )
        .select_from(models.ProjectSession)
        .join(
            criteria_relation,
            models.ProjectSession.project_id == criteria_relation.c.project_id,
        )
        .where(
            models.ProjectSession.content_complete.is_(True),
            models.ProjectSession.last_span_ingested_at.is_not(None),
            models.ProjectSession.last_span_ingested_at >= criteria_relation.c.created_at,
            due_at <= current_time,
            ~successful_result_exists,
            ~_live_work_exists(criteria_relation),
            or_(
                terminal_watermark.is_(None),
                terminal_watermark < models.ProjectSession.last_span_ingested_at,
            ),
        )
    )


def _session_work_insert_statement(
    eligible_pairs: Subquery,
    dialect: SupportedSQLDialect,
    *,
    project_session_rowids: Optional[Sequence[int]] = None,
) -> Insert:
    """Insert work from a globally ordered page whose PostgreSQL sessions are locked."""
    index_elements = (
        models.EvalSessionWorkUnit.project_session_rowid,
        models.EvalSessionWorkUnit.evaluator_id,
        models.EvalSessionWorkUnit.config_fingerprint,
    )
    candidates = select(
        eligible_pairs.c.project_session_rowid,
        eligible_pairs.c.evaluator_id,
        eligible_pairs.c.criteria_id,
        eligible_pairs.c.config_fingerprint,
        eligible_pairs.c.evaluated_through,
    ).where(literal(True))
    if project_session_rowids is not None:
        candidates = candidates.where(
            eligible_pairs.c.project_session_rowid.in_(project_session_rowids)
        )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return (
            insert_postgresql(models.EvalSessionWorkUnit)
            .from_select(list(_SESSION_WORK_INSERT_COLUMNS), candidates)
            .on_conflict_do_nothing(
                index_elements=index_elements,
                index_where=_LIVE_WORK_INDEX_PREDICATE,
            )
            .returning(models.EvalSessionWorkUnit.criteria_id)
        )
    if dialect is SupportedSQLDialect.SQLITE:
        return (
            insert_sqlite(models.EvalSessionWorkUnit)
            .from_select(list(_SESSION_WORK_INSERT_COLUMNS), candidates)
            .on_conflict_do_nothing(
                index_elements=index_elements,
                index_where=_LIVE_WORK_INDEX_PREDICATE,
            )
            .returning(models.EvalSessionWorkUnit.criteria_id)
        )
    assert_never(dialect)


class SessionEvalSweeper(DaemonTask):
    """Create pending work for eligible project sessions."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        consumer_group: str = _CONSUMER_GROUP,
        tick_interval_seconds: float = SESSION_SWEEP_INTERVAL_SECONDS,
    ) -> None:
        super().__init__()
        self._db = db
        self._consumer_group = consumer_group
        self._tick_interval_seconds = tick_interval_seconds
        self._max_outstanding = get_env_online_eval_max_session_outstanding()
        self._publish_metrics = get_env_enable_prometheus()
        self._sweeper_id = f"session-sweeper-{token_hex(8)}"
        self._lease_name = f"{_SESSION_SWEEP_LEASE_NAME}:{consumer_group}"
        self._lease_held = False

    async def _run(self) -> None:
        try:
            while self._running:
                try:
                    await self._tick()
                except Exception:
                    logger.exception("Session evaluation sweep failed")
                await asyncio.sleep(self._tick_interval_seconds)
        finally:
            await self._release_lease()

    async def _tick(self) -> None:
        mutations_allowed = not self._db.should_not_insert_or_update
        lease_id = await self._acquire_lease(allow_insert=mutations_allowed)
        if lease_id is None:
            return
        renewed = (
            await self._materialize_and_renew(lease_id)
            if mutations_allowed
            else await self._renew_lease(lease_id)
        )
        if not renewed:
            self._lease_held = False
            logger.warning("Session evaluation sweeper lost its lease")

    async def _acquire_lease(self, *, allow_insert: bool = True) -> Optional[int]:
        for _ in range(2):
            async with self._db() as session:
                database_now = await self._database_now(session)
                lease_id = await session.scalar(
                    update(models.EvalWorkLease)
                    .where(
                        models.EvalWorkLease.name == self._lease_name,
                        or_(
                            models.EvalWorkLease.holder.is_(None),
                            models.EvalWorkLease.holder == self._sweeper_id,
                            models.EvalWorkLease.heartbeat_at
                            < database_now - timedelta(seconds=SESSION_SWEEP_LEASE_TTL_SECONDS),
                        ),
                    )
                    .values(holder=self._sweeper_id, heartbeat_at=database_now)
                    .returning(models.EvalWorkLease.id)
                )
            if lease_id is not None:
                self._lease_held = True
                return lease_id
            async with self._db() as session:
                row_exists = await session.scalar(
                    select(models.EvalWorkLease.id).where(
                        models.EvalWorkLease.name == self._lease_name
                    )
                )
                if row_exists is not None:
                    break
                if not allow_insert:
                    break
                await session.execute(
                    insert_on_conflict(
                        {"name": self._lease_name},
                        table=models.EvalWorkLease,
                        dialect=self._db.dialect,
                        unique_by=("name",),
                        on_conflict=OnConflict.DO_NOTHING,
                    )
                )
        self._lease_held = False
        return None

    async def _renew_lease(self, lease_id: int) -> bool:
        async with self._db() as session:
            renewed_at = await self._database_now(session)
            renewed = await session.scalar(
                update(models.EvalWorkLease)
                .where(
                    models.EvalWorkLease.id == lease_id,
                    models.EvalWorkLease.holder == self._sweeper_id,
                )
                .values(heartbeat_at=renewed_at)
                .returning(models.EvalWorkLease.id)
            )
        return renewed is not None

    async def _materialize_and_renew(self, lease_id: int) -> bool:
        started_at = time.monotonic()
        if self._publish_metrics:
            ONLINE_EVAL_SESSION_SWEEP_ATTEMPTS.inc()
        materialized_work_count = 0
        eligible_pair_count: Optional[int] = None
        renewed: Optional[int] = None
        try:
            async with self._db() as session:
                database_now = await self._database_now(session)
                materialized_work_count, eligible_pair_count = await self._sweep(
                    session, database_now
                )
                renewed_at = await self._database_now(session)
                renewed = await session.scalar(
                    update(models.EvalWorkLease)
                    .where(
                        models.EvalWorkLease.id == lease_id,
                        models.EvalWorkLease.holder == self._sweeper_id,
                    )
                    .values(heartbeat_at=renewed_at)
                    .returning(models.EvalWorkLease.id)
                )
                if renewed is None:
                    await session.rollback()
        except Exception:
            if self._publish_metrics:
                ONLINE_EVAL_SESSION_SWEEP_FAILURES.inc()
            raise
        finally:
            if self._publish_metrics:
                ONLINE_EVAL_SESSION_SWEEP_DURATION_SECONDS.observe(time.monotonic() - started_at)
        if self._publish_metrics:
            if renewed is None:
                ONLINE_EVAL_SESSION_SWEEP_FAILURES.inc()
            else:
                ONLINE_EVAL_SESSION_SWEEP_SUCCESSES.inc()
                ONLINE_EVAL_SESSION_MATERIALIZED_WORK_UNITS.inc(materialized_work_count)
                await self._publish_eligibility_metrics(eligible_pair_count)
        return renewed is not None

    async def _database_now(self, session: AsyncSession) -> datetime:
        clock = (
            func.statement_timestamp()
            if self._db.dialect is SupportedSQLDialect.POSTGRESQL
            else func.now()
        )
        database_now = await session.scalar(select(type_coerce(clock, models.UtcTimeStamp())))
        if database_now is None:
            raise RuntimeError("Database did not return its current time")
        return database_now

    async def _load_criteria(self, session: AsyncSession) -> list[_SessionCriteria]:
        polymorphic_evaluator = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        rows = (
            await session.execute(
                select(models.ProjectEvaluatorCriteria, polymorphic_evaluator)
                .join(
                    polymorphic_evaluator,
                    models.ProjectEvaluatorCriteria.evaluator_id == polymorphic_evaluator.id,
                )
                .where(
                    session_criteria_is_schedulable(models.ProjectEvaluatorCriteria),
                )
            )
        ).all()
        criteria_evaluators = [(criteria, evaluator) for criteria, evaluator in rows]
        criteria_rows: list[_SessionCriteria] = []
        resolved_rows = await resolve_criteria_bulk(session, criteria_evaluators)
        for (criteria, evaluator), resolved in zip(
            criteria_evaluators,
            resolved_rows,
            strict=True,
        ):
            if resolved is None:
                logger.warning(
                    f"Skipping criteria {criteria.id}: "
                    f"no resolvable version for evaluator {evaluator.id}"
                )
                continue
            criteria_rows.append(
                _SessionCriteria(
                    criteria_id=criteria.id,
                    project_id=criteria.project_id,
                    evaluator_id=criteria.evaluator_id,
                    fingerprint=config_fingerprint(resolved),
                    delay_seconds=criteria.evaluation_delay_seconds,
                    created_at=criteria.created_at,
                )
            )
        return criteria_rows

    async def _sweep(
        self,
        session: AsyncSession,
        database_now: datetime,
    ) -> tuple[int, Optional[int]]:
        """Materialize this tick's work, returning (work created, pairs found eligible)."""
        await reap_lapsed_leases(session, models.EvalSessionWorkUnit)
        work_budget = await self._admission_budget(session)
        if work_budget == 0:
            return 0, None
        criteria = await self._load_criteria(session)
        return await self._load_eligible_pairs(
            session,
            database_now,
            criteria,
            limit=min(work_budget, _MAX_ELIGIBLE_PAIRS_PER_TICK),
        )

    async def _load_eligible_pairs(
        self,
        session: AsyncSession,
        database_now: datetime,
        criteria: Sequence[_SessionCriteria],
        *,
        limit: int,
    ) -> tuple[int, Optional[int]]:
        if not criteria:
            return 0, 0 if self._publish_metrics else None
        criteria_relation = _criteria_relation(criteria, self._db.dialect)
        relation = _eligible_pairs_statement(
            criteria_relation,
            database_now,
            self._db.dialect,
        ).subquery("eligible_pairs")
        eligible_pair_count = None
        if self._publish_metrics:
            eligible_pair_count = (
                await session.scalar(select(func.count()).select_from(relation))
            ) or 0
        eligible_page = (
            select(relation)
            .order_by(
                relation.c.effective_due_time,
                relation.c.project_session_rowid,
                relation.c.criteria_id,
            )
            .limit(limit)
            .subquery("eligible_pair_page")
        )
        locked_project_session_rowids: Optional[Sequence[int]] = None
        if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
            page_criteria_ids = tuple(
                dict.fromkeys(await session.scalars(select(eligible_page.c.criteria_id)))
            )
            if not page_criteria_ids:
                return 0, eligible_pair_count
            page_criteria_ids_parameter = bindparam(
                "page_criteria_ids",
                page_criteria_ids,
                type_=ARRAY(Integer),
            )
            locked_criteria_ids = tuple(
                await session.scalars(
                    select(models.ProjectEvaluatorCriteria.id)
                    .where(
                        models.ProjectEvaluatorCriteria.id == any_(page_criteria_ids_parameter),
                    )
                    .order_by(models.ProjectEvaluatorCriteria.id)
                    .with_for_update()
                )
            )
            if len(locked_criteria_ids) != len(page_criteria_ids):
                return 0, eligible_pair_count
            page_ids = tuple(
                dict.fromkeys(await session.scalars(select(eligible_page.c.project_session_rowid)))
            )
            if not page_ids:
                return 0, eligible_pair_count
            page_ids_parameter = bindparam(
                "page_ids",
                page_ids,
                type_=ARRAY(Integer),
            )
            locked_project_session_rowids = tuple(
                await session.scalars(
                    select(models.ProjectSession.id)
                    .where(
                        models.ProjectSession.id == any_(page_ids_parameter),
                        models.ProjectSession.content_complete.is_(True),
                    )
                    .order_by(models.ProjectSession.id)
                    .with_for_update()
                )
            )
            if not locked_project_session_rowids:
                return 0, eligible_pair_count
        inserted_count = len(
            (
                await session.scalars(
                    _session_work_insert_statement(
                        eligible_page,
                        self._db.dialect,
                        project_session_rowids=locked_project_session_rowids,
                    )
                )
            ).all()
        )
        return inserted_count, eligible_pair_count

    async def _publish_eligibility_metrics(self, eligible_pair_count: Optional[int]) -> None:
        """Publish the sweep's observation gauges from a session of its own.

        Reporting is not materialization: this runs after the work has been committed
        and the lease renewed, over its own read session, so a failing aggregate costs
        a stale gauge rather than the sweep that already succeeded.
        """
        if eligible_pair_count is not None:
            ONLINE_EVAL_SESSION_ELIGIBLE_PAIR_BACKLOG.set(eligible_pair_count)
        try:
            async with self._db.read() as session:
                database_now = await self._database_now(session)
                await self._publish_watermark_lag(session, database_now)
        except Exception:
            logger.exception("Failed to publish session evaluation watermark lag")

    async def _publish_watermark_lag(
        self,
        session: AsyncSession,
        database_now: datetime,
    ) -> None:
        if self._db.dialect is SupportedSQLDialect.SQLITE:
            lag_seconds = (
                cast(func.julianday(models.ProjectSession.last_span_ingested_at), Float)
                - cast(func.julianday(models.EvalSessionWorkUnit.evaluated_through), Float)
            ) * 86_400
        else:
            lag_seconds = func.extract(
                "epoch",
                models.ProjectSession.last_span_ingested_at
                - models.EvalSessionWorkUnit.evaluated_through,
            )
        watermark_lag_seconds = await session.scalar(
            select(func.max(lag_seconds))
            .select_from(models.EvalSessionWorkUnit)
            .join(
                models.ProjectSession,
                models.EvalSessionWorkUnit.project_session_rowid == models.ProjectSession.id,
            )
            .where(
                models.EvalSessionWorkUnit.status == "DONE",
                models.EvalSessionWorkUnit.updated_at
                >= database_now - timedelta(seconds=_WATERMARK_LAG_WINDOW_SECONDS),
                models.ProjectSession.last_span_ingested_at.is_not(None),
            )
        )
        ONLINE_EVAL_SESSION_RESULT_WATERMARK_LAG_SECONDS.set(
            max(float(watermark_lag_seconds or 0.0), 0.0)
        )

    async def _admission_budget(self, session: AsyncSession) -> int:
        outstanding = (
            select(1)
            .select_from(models.EvalSessionWorkUnit)
            .where(
                or_(
                    models.EvalSessionWorkUnit.status.in_(("PENDING", "RUNNING")),
                    and_(
                        models.EvalSessionWorkUnit.status == "ERROR",
                        models.EvalSessionWorkUnit.attempts < MAX_ATTEMPTS,
                    ),
                )
            )
            .limit(self._max_outstanding)
            .subquery()
        )
        outstanding_count = await session.scalar(select(func.count()).select_from(outstanding)) or 0
        budget = max(0, self._max_outstanding - outstanding_count)
        if budget == 0:
            logger.warning(
                f"Session evaluation admission gate closed: "
                f"{outstanding_count} outstanding work units reached "
                f"{self._max_outstanding}"
            )
        return budget

    async def _release_lease(self) -> None:
        if not self._lease_held:
            return
        self._lease_held = False
        try:
            async with self._db() as session:
                await session.execute(
                    update(models.EvalWorkLease)
                    .where(
                        models.EvalWorkLease.name == self._lease_name,
                        models.EvalWorkLease.holder == self._sweeper_id,
                    )
                    .values(holder=None, heartbeat_at=None)
                )
        except Exception:
            logger.exception("Failed to release session evaluation sweep lease")
