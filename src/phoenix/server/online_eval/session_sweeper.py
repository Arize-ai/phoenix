"""Materialize session evaluation work after session activity becomes old enough."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Optional, Sequence

from sqlalchemy import (
    Float,
    Insert,
    and_,
    cast,
    func,
    literal,
    or_,
    select,
    text,
    type_coerce,
    union_all,
    update,
)
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, with_polymorphic
from typing_extensions import assert_never

from phoenix.config import get_env_enable_prometheus, get_env_online_eval_max_session_outstanding
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.coordinator import LEASE_ATTEMPTS_EXHAUSTED_ERROR
from phoenix.server.online_eval.db_coordinator import work_unit_lease_lapsed
from phoenix.server.online_eval.derivation import MAX_ATTEMPTS, config_fingerprint
from phoenix.server.online_eval.producer import resolve_criteria
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
_MAX_ELIGIBLE_PAIRS_PER_TICK = 1000
_MAX_SESSION_WORK_INSERT_PARAMETERS = 30_000
_SESSION_WORK_INSERT_PARAMETERS_PER_ROW = 7
_SESSION_WORK_INSERT_BATCH_SIZE = (
    _MAX_SESSION_WORK_INSERT_PARAMETERS // _SESSION_WORK_INSERT_PARAMETERS_PER_ROW
)


def _session_work_insert_statement(
    work_records: Sequence[dict[str, object]],
    dialect: SupportedSQLDialect,
) -> Insert:
    index_elements = (
        models.EvalSessionWorkUnit.project_session_rowid,
        models.EvalSessionWorkUnit.evaluator_id,
        models.EvalSessionWorkUnit.config_fingerprint,
    )
    live_work = text("status IN ('PENDING', 'RUNNING') OR status = 'ERROR' AND attempts < 3")
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return (
            insert_postgresql(models.EvalSessionWorkUnit)
            .values(work_records)
            .on_conflict_do_nothing(
                index_elements=index_elements,
                index_where=live_work,
            )
        )
    if dialect is SupportedSQLDialect.SQLITE:
        return (
            insert_sqlite(models.EvalSessionWorkUnit)
            .values(work_records)
            .on_conflict_do_nothing(
                index_elements=index_elements,
                index_where=live_work,
            )
        )
    assert_never(dialect)


@dataclass(frozen=True)
class _SessionCriteria:
    criteria_id: int
    project_id: int
    evaluator_id: int
    fingerprint: str
    delay_seconds: int


@dataclass(frozen=True)
class _EligiblePair:
    project_session_rowid: int
    evaluator_id: int
    criteria_id: int
    config_fingerprint: str
    evaluated_through: datetime


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
        cursor_id = await self._acquire_cursor()
        if cursor_id is None:
            return
        if not await self._materialize_and_renew(cursor_id):
            self._lease_held = False
            logger.warning("Session evaluation sweeper lost its lease")

    async def _acquire_cursor(self) -> Optional[int]:
        for _ in range(2):
            async with self._db() as session:
                database_now = await self._database_now(session)
                cursor_id = await session.scalar(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.evaluation_target == "SESSION",
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                        or_(
                            models.EvalWorkCursor.claimed_by.is_(None),
                            models.EvalWorkCursor.claimed_by == self._sweeper_id,
                            models.EvalWorkCursor.claimed_at
                            < database_now - timedelta(seconds=SESSION_SWEEP_LEASE_TTL_SECONDS),
                        ),
                    )
                    .values(claimed_by=self._sweeper_id, claimed_at=database_now)
                    .returning(models.EvalWorkCursor.id)
                )
            if cursor_id is not None:
                self._lease_held = True
                return cursor_id
            async with self._db() as session:
                row_exists = await session.scalar(
                    select(models.EvalWorkCursor.id).where(
                        models.EvalWorkCursor.evaluation_target == "SESSION",
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                    )
                )
                if row_exists is not None:
                    break
                await session.execute(
                    insert_on_conflict(
                        {
                            "evaluation_target": "SESSION",
                            "consumer_group": self._consumer_group,
                            "produced_through_id": 0,
                        },
                        table=models.EvalWorkCursor,
                        dialect=self._db.dialect,
                        unique_by=("evaluation_target", "consumer_group"),
                        on_conflict=OnConflict.DO_NOTHING,
                    )
                )
        self._lease_held = False
        return None

    async def _materialize_and_renew(self, cursor_id: int) -> bool:
        started_at = time.monotonic()
        if self._publish_metrics:
            ONLINE_EVAL_SESSION_SWEEP_ATTEMPTS.inc()
        materialized_work_count = 0
        renewed: Optional[int] = None
        try:
            async with self._db() as session:
                database_now = await self._database_now(session)
                materialized_work_count = await self._sweep(session, database_now)
                renewed_at = await self._database_now(session)
                renewed = await session.scalar(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.id == cursor_id,
                        models.EvalWorkCursor.claimed_by == self._sweeper_id,
                    )
                    .values(claimed_at=renewed_at)
                    .returning(models.EvalWorkCursor.id)
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
        return renewed is not None

    async def _database_now(self, session: AsyncSession) -> datetime:
        database_now = await session.scalar(select(type_coerce(func.now(), models.UtcTimeStamp())))
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
        criteria_rows: list[_SessionCriteria] = []
        for criteria, evaluator in rows:
            resolved = await resolve_criteria(session, criteria, evaluator)
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
                )
            )
        return criteria_rows

    async def _sweep(self, session: AsyncSession, database_now: datetime) -> int:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(
                models.EvalSessionWorkUnit.status == "RUNNING",
                models.EvalSessionWorkUnit.attempts >= MAX_ATTEMPTS - 1,
                work_unit_lease_lapsed(database_now, models.EvalSessionWorkUnit),
            )
            .values(
                status="ERROR",
                attempts=MAX_ATTEMPTS,
                error=func.coalesce(
                    models.EvalSessionWorkUnit.error,
                    LEASE_ATTEMPTS_EXHAUSTED_ERROR,
                ),
            )
        )
        criteria = await self._load_criteria(session)
        work_budget = await self._admission_budget(session)
        eligible_pairs, eligible_pair_count = await self._load_eligible_pairs(
            session,
            database_now,
            criteria,
            limit=min(work_budget, _MAX_ELIGIBLE_PAIRS_PER_TICK),
        )
        if self._publish_metrics:
            await self._publish_eligibility_metrics(session, eligible_pair_count)
        if work_budget == 0 or not eligible_pairs:
            return 0

        work_records = [
            {
                "project_session_rowid": pair.project_session_rowid,
                "evaluator_id": pair.evaluator_id,
                "criteria_id": pair.criteria_id,
                "config_fingerprint": pair.config_fingerprint,
                "evaluated_through": pair.evaluated_through,
            }
            for pair in eligible_pairs
        ]

        inserted_count = 0
        if work_records:
            for start in range(0, len(work_records), _SESSION_WORK_INSERT_BATCH_SIZE):
                result = await session.execute(
                    _session_work_insert_statement(
                        work_records[start : start + _SESSION_WORK_INSERT_BATCH_SIZE],
                        self._db.dialect,
                    )
                )
                inserted_count += result.rowcount  # type: ignore[attr-defined]
        return inserted_count

    async def _load_eligible_pairs(
        self,
        session: AsyncSession,
        database_now: datetime,
        criteria: Sequence[_SessionCriteria],
        *,
        limit: int,
    ) -> tuple[list[_EligiblePair], int]:
        if not criteria:
            return [], 0
        statements = []
        for criterion in criteria:
            live_work = aliased(models.EvalSessionWorkUnit)
            successful_work = aliased(models.EvalSessionWorkUnit)
            successful_watermark = (
                select(func.max(successful_work.evaluated_through))
                .where(
                    successful_work.project_session_rowid == models.ProjectSession.id,
                    successful_work.evaluator_id == criterion.evaluator_id,
                    successful_work.config_fingerprint == criterion.fingerprint,
                    successful_work.status == "DONE",
                )
                .correlate(models.ProjectSession)
                .scalar_subquery()
            )
            successful_result_exists = (
                select(1)
                .select_from(successful_work)
                .where(
                    successful_work.project_session_rowid == models.ProjectSession.id,
                    successful_work.evaluator_id == criterion.evaluator_id,
                    successful_work.config_fingerprint == criterion.fingerprint,
                    successful_work.status == "DONE",
                )
                .correlate(models.ProjectSession)
                .exists()
            )
            live_work_exists = (
                select(1)
                .select_from(live_work)
                .where(
                    live_work.project_session_rowid == models.ProjectSession.id,
                    live_work.evaluator_id == criterion.evaluator_id,
                    live_work.config_fingerprint == criterion.fingerprint,
                    or_(
                        live_work.status.in_(("PENDING", "RUNNING")),
                        and_(
                            live_work.status == "ERROR",
                            live_work.attempts < MAX_ATTEMPTS,
                        ),
                    ),
                )
                .correlate(models.ProjectSession)
                .exists()
            )
            if self._db.dialect is SupportedSQLDialect.SQLITE:
                due_at = (
                    cast(func.julianday(models.ProjectSession.last_span_ingested_at), Float)
                    * 86_400
                    + criterion.delay_seconds
                )
            else:
                due_at = (
                    func.extract("epoch", models.ProjectSession.last_span_ingested_at)
                    + criterion.delay_seconds
                )
            statements.append(
                select(
                    models.ProjectSession.id.label("project_session_rowid"),
                    literal(criterion.evaluator_id).label("evaluator_id"),
                    literal(criterion.criteria_id).label("criteria_id"),
                    literal(criterion.fingerprint).label("config_fingerprint"),
                    models.ProjectSession.last_span_ingested_at.label("evaluated_through"),
                    due_at.label("effective_due_time"),
                ).where(
                    models.ProjectSession.project_id == criterion.project_id,
                    models.ProjectSession.content_complete.is_(True),
                    models.ProjectSession.last_span_ingested_at.is_not(None),
                    models.ProjectSession.last_span_ingested_at
                    <= database_now - timedelta(seconds=criterion.delay_seconds),
                    ~successful_result_exists,
                    ~live_work_exists,
                    or_(
                        successful_watermark.is_(None),
                        successful_watermark < models.ProjectSession.last_span_ingested_at,
                    ),
                )
            )
        relation = union_all(*statements).subquery()
        eligible_pair_count = (
            await session.scalar(select(func.count()).select_from(relation))
        ) or 0
        if limit == 0:
            return [], eligible_pair_count
        rows = (
            await session.execute(
                select(relation)
                .order_by(
                    relation.c.effective_due_time,
                    relation.c.project_session_rowid,
                    relation.c.criteria_id,
                )
                .limit(limit)
            )
        ).all()
        pairs = [
            _EligiblePair(
                project_session_rowid=row.project_session_rowid,
                evaluator_id=row.evaluator_id,
                criteria_id=row.criteria_id,
                config_fingerprint=row.config_fingerprint,
                evaluated_through=row.evaluated_through,
            )
            for row in rows
        ]
        return pairs, eligible_pair_count

    async def _publish_eligibility_metrics(
        self,
        session: AsyncSession,
        eligible_pair_count: int,
    ) -> None:
        ONLINE_EVAL_SESSION_ELIGIBLE_PAIR_BACKLOG.set(eligible_pair_count)
        watermark_rows = (
            await session.execute(
                select(
                    models.ProjectSession.last_span_ingested_at,
                    models.EvalSessionWorkUnit.evaluated_through,
                )
                .join(
                    models.EvalSessionWorkUnit,
                    models.EvalSessionWorkUnit.project_session_rowid == models.ProjectSession.id,
                )
                .where(
                    models.EvalSessionWorkUnit.status == "DONE",
                    models.ProjectSession.last_span_ingested_at.is_not(None),
                )
            )
        ).all()
        watermark_lag_seconds = max(
            (
                max((last_span_ingested_at - evaluated_through).total_seconds(), 0.0)
                for last_span_ingested_at, evaluated_through in watermark_rows
                if last_span_ingested_at is not None
            ),
            default=0.0,
        )
        ONLINE_EVAL_SESSION_RESULT_WATERMARK_LAG_SECONDS.set(watermark_lag_seconds)

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
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.evaluation_target == "SESSION",
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                        models.EvalWorkCursor.claimed_by == self._sweeper_id,
                    )
                    .values(claimed_by=None, claimed_at=None)
                )
        except Exception:
            logger.exception("Failed to release session evaluation sweep lease")
