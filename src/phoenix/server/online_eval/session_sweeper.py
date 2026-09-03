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
    union_all,
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
from phoenix.db.eval_work import (
    SESSION_DECLINED_STATUSES,
    live_eval_session_work_index_predicate,
)
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.db_coordinator import reap_lapsed_leases
from phoenix.server.online_eval.derivation import (
    MAX_ATTEMPTS,
    STALE_FINGERPRINT_ERROR,
    config_fingerprint,
    sample_key,
)
from phoenix.server.online_eval.project_evaluator_resolution import resolve_project_evaluators_bulk
from phoenix.server.online_eval.session_policy import session_project_evaluator_is_schedulable
from phoenix.server.prometheus import (
    ONLINE_EVAL_SESSION_ELIGIBLE_PAIR_BACKLOG,
    ONLINE_EVAL_SESSION_MATERIALIZED_WORK_UNITS,
    ONLINE_EVAL_SESSION_RESULT_WATERMARK_LAG_SECONDS,
    ONLINE_EVAL_SESSION_SWEEP_ATTEMPTS,
    ONLINE_EVAL_SESSION_SWEEP_DURATION_SECONDS,
    ONLINE_EVAL_SESSION_SWEEP_FAILURES,
    ONLINE_EVAL_SESSION_SWEEP_SUCCESSES,
)
from phoenix.server.session_filters import get_filtered_session_rowids_subquery
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

_LIVE_WORK_INDEX_PREDICATE = text(live_eval_session_work_index_predicate())


@dataclass(frozen=True)
class _SessionProjectEvaluator:
    project_evaluator_id: int
    project_id: int
    evaluator_id: int
    fingerprint: str
    delay_seconds: int
    created_at: datetime
    filter_condition: str
    sampling_rate: float


def _project_evaluator_relation(
    project_evaluators: Sequence[_SessionProjectEvaluator],
    dialect: SupportedSQLDialect,
) -> Subquery:
    """Return a portable inline relation for resolved session project evaluators.

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
            f"{prefix}_evaluator_id": project_evaluator.evaluator_id,
            f"{prefix}_config_fingerprint": project_evaluator.fingerprint,
            f"{prefix}_delay_seconds": project_evaluator.delay_seconds,
            f"{prefix}_created_at": project_evaluator.created_at,
            f"{prefix}_sampling_rate": project_evaluator.sampling_rate,
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
                f"CAST({placeholders[6]} AS FLOAT)",
            ]
        rows.append(f"({', '.join(placeholders)})")
    statement = text(
        "SELECT "
        "sc.column1 AS project_evaluator_id, "
        "sc.column2 AS project_id, "
        "sc.column3 AS evaluator_id, "
        "sc.column4 AS config_fingerprint, "
        "sc.column5 AS delay_seconds, "
        "sc.column6 AS created_at, "
        "sc.column7 AS sampling_rate "
        f"FROM (VALUES {', '.join(rows)}) AS sc"
    )
    return (
        statement.bindparams(**parameters)
        .columns(
            column("project_evaluator_id", Integer),
            column("project_id", Integer),
            column("evaluator_id", Integer),
            column("config_fingerprint", String),
            column("delay_seconds", Integer),
            column("created_at", models.UtcTimeStamp()),
            column("sampling_rate", Float),
        )
        .subquery("sweep_evaluators")
    )


def _live_work_exists(project_evaluator_relation: Subquery) -> ColumnElement[bool]:
    """Whether the session still holds a live dedup key for this criterion."""
    live_work = aliased(models.EvalSessionWorkUnit)
    return (
        select(1)
        .select_from(live_work)
        .where(
            live_work.project_session_rowid == models.ProjectSession.id,
            live_work.evaluator_id == project_evaluator_relation.c.evaluator_id,
            live_work.config_fingerprint == project_evaluator_relation.c.config_fingerprint,
            or_(
                live_work.status.in_(("PENDING", "RUNNING")),
                live_work.status.in_(SESSION_DECLINED_STATUSES),
                and_(
                    live_work.status == "ERROR",
                    live_work.attempts < MAX_ATTEMPTS,
                ),
            ),
        )
        .correlate(models.ProjectSession, project_evaluator_relation)
        .exists()
    )


def _eligible_pairs_statement(
    project_evaluator_relation: Subquery,
    database_now: datetime,
    dialect: SupportedSQLDialect,
    *,
    filter_matches: ColumnElement[bool],
) -> Select[Any]:
    successful_work = aliased(models.EvalSessionWorkUnit)
    terminal_work = aliased(models.EvalSessionWorkUnit)
    terminal_watermark = (
        select(func.max(terminal_work.evaluated_through))
        .where(
            terminal_work.project_session_rowid == models.ProjectSession.id,
            terminal_work.evaluator_id == project_evaluator_relation.c.evaluator_id,
            terminal_work.config_fingerprint == project_evaluator_relation.c.config_fingerprint,
            or_(
                terminal_work.status == "DONE",
                terminal_work.status.in_(SESSION_DECLINED_STATUSES),
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
        .correlate(models.ProjectSession, project_evaluator_relation)
        .scalar_subquery()
    )
    successful_result_exists = (
        select(1)
        .select_from(successful_work)
        .where(
            successful_work.project_session_rowid == models.ProjectSession.id,
            successful_work.evaluator_id == project_evaluator_relation.c.evaluator_id,
            successful_work.config_fingerprint == project_evaluator_relation.c.config_fingerprint,
            successful_work.status == "DONE",
        )
        .correlate(models.ProjectSession, project_evaluator_relation)
        .exists()
    )
    if dialect is SupportedSQLDialect.SQLITE:
        due_at = (
            cast(func.julianday(models.ProjectSession.last_span_ingested_at), Float) * 86_400
            + project_evaluator_relation.c.delay_seconds
        )
        current_time = cast(func.julianday(database_now), Float) * 86_400
    else:
        due_at = (
            func.extract("epoch", models.ProjectSession.last_span_ingested_at)
            + project_evaluator_relation.c.delay_seconds
        )
        current_time = func.extract("epoch", literal(database_now))
    return (
        select(
            models.ProjectSession.id.label("project_session_rowid"),
            models.ProjectSession.session_id,
            project_evaluator_relation.c.project_evaluator_id,
            project_evaluator_relation.c.evaluator_id,
            project_evaluator_relation.c.config_fingerprint,
            project_evaluator_relation.c.sampling_rate,
            models.ProjectSession.last_span_ingested_at.label("evaluated_through"),
            due_at.label("effective_due_time"),
            filter_matches.label("filter_matches"),
        )
        .select_from(models.ProjectSession)
        .join(
            project_evaluator_relation,
            models.ProjectSession.project_id == project_evaluator_relation.c.project_id,
        )
        .where(
            models.ProjectSession.content_complete.is_(True),
            models.ProjectSession.last_span_ingested_at.is_not(None),
            models.ProjectSession.last_span_ingested_at >= project_evaluator_relation.c.created_at,
            due_at <= current_time,
            ~successful_result_exists,
            ~_live_work_exists(project_evaluator_relation),
            or_(
                terminal_watermark.is_(None),
                terminal_watermark < models.ProjectSession.last_span_ingested_at,
            ),
        )
    )


def _eligible_pairs_relation(
    project_evaluators: Sequence[_SessionProjectEvaluator],
    database_now: datetime,
    dialect: SupportedSQLDialect,
) -> Subquery:
    statements: list[Select[Any]] = []
    unfiltered = [pe for pe in project_evaluators if not pe.filter_condition]
    if unfiltered:
        statements.append(
            _eligible_pairs_statement(
                _project_evaluator_relation(unfiltered, dialect),
                database_now,
                dialect,
                filter_matches=literal(True),
            )
        )
    for project_evaluator in project_evaluators:
        if not project_evaluator.filter_condition:
            continue
        filter_matches = models.ProjectSession.id.in_(
            get_filtered_session_rowids_subquery(
                project_evaluator.filter_condition,
                [project_evaluator.project_id],
            )
        )
        statements.append(
            _eligible_pairs_statement(
                _project_evaluator_relation([project_evaluator], dialect),
                database_now,
                dialect,
                filter_matches=filter_matches,
            )
        )
    if len(statements) == 1:
        return statements[0].subquery("eligible_pairs")
    return union_all(*statements).subquery("eligible_pairs")


def _session_work_insert_statement(
    decisions: Sequence[dict[str, Any]],
    dialect: SupportedSQLDialect,
) -> Insert:
    """Insert scheduling decisions whose PostgreSQL evaluator and session rows are locked."""
    index_elements = (
        models.EvalSessionWorkUnit.project_session_rowid,
        models.EvalSessionWorkUnit.evaluator_id,
        models.EvalSessionWorkUnit.config_fingerprint,
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return (
            insert_postgresql(models.EvalSessionWorkUnit)
            .values(decisions)
            .on_conflict_do_nothing(
                index_elements=index_elements,
                index_where=_LIVE_WORK_INDEX_PREDICATE,
            )
            .returning(models.EvalSessionWorkUnit.status)
        )
    if dialect is SupportedSQLDialect.SQLITE:
        return (
            insert_sqlite(models.EvalSessionWorkUnit)
            .values(decisions)
            .on_conflict_do_nothing(
                index_elements=index_elements,
                index_where=_LIVE_WORK_INDEX_PREDICATE,
            )
            .returning(models.EvalSessionWorkUnit.status)
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
            # Shielded so the second cancellation the daemon's stop timeout issues does
            # not abandon the release's open session and leave the lease held until its
            # TTL lapses, and awaited on that cancellation so the release finishes here
            # rather than as an orphan nothing is waiting on.
            release = asyncio.ensure_future(self._release_lease())
            try:
                await asyncio.shield(release)
            except asyncio.CancelledError:
                if not release.done():
                    await asyncio.wait([release])
                raise

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

    async def _load_evaluators(self, session: AsyncSession) -> list[_SessionProjectEvaluator]:
        polymorphic_evaluator = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        rows = (
            await session.execute(
                select(models.ProjectEvaluator, polymorphic_evaluator)
                .join(
                    polymorphic_evaluator,
                    models.ProjectEvaluator.evaluator_id == polymorphic_evaluator.id,
                )
                .where(
                    session_project_evaluator_is_schedulable(models.ProjectEvaluator),
                )
            )
        ).all()
        project_evaluator_pairs = [
            (project_evaluator, evaluator) for project_evaluator, evaluator in rows
        ]
        project_evaluator_rows: list[_SessionProjectEvaluator] = []
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
            project_evaluator_rows.append(
                _SessionProjectEvaluator(
                    project_evaluator_id=project_evaluator.id,
                    project_id=project_evaluator.project_id,
                    evaluator_id=project_evaluator.evaluator_id,
                    fingerprint=config_fingerprint(resolved),
                    delay_seconds=project_evaluator.evaluation_delay_seconds,
                    created_at=project_evaluator.created_at,
                    filter_condition=project_evaluator.filter_condition,
                    sampling_rate=project_evaluator.sampling_rate,
                )
            )
        return project_evaluator_rows

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
        project_evaluators = await self._load_evaluators(session)
        return await self._load_eligible_pairs(
            session,
            database_now,
            project_evaluators,
            limit=min(work_budget, _MAX_ELIGIBLE_PAIRS_PER_TICK),
        )

    async def _load_eligible_pairs(
        self,
        session: AsyncSession,
        database_now: datetime,
        project_evaluators: Sequence[_SessionProjectEvaluator],
        *,
        limit: int,
    ) -> tuple[int, Optional[int]]:
        if not project_evaluators:
            return 0, 0 if self._publish_metrics else None
        relation = _eligible_pairs_relation(
            project_evaluators,
            database_now,
            self._db.dialect,
        )
        eligible_pair_count = None
        if self._publish_metrics:
            eligible_pair_count = (
                await session.scalar(
                    select(func.count())
                    .select_from(relation)
                    .where(relation.c.filter_matches.is_(True))
                )
            ) or 0
        eligible_page = (
            select(relation)
            .order_by(
                relation.c.effective_due_time,
                relation.c.project_session_rowid,
                relation.c.project_evaluator_id,
            )
            .limit(limit)
            .subquery("eligible_pair_page")
        )
        locked_project_evaluator_ids: Optional[Sequence[int]] = None
        locked_project_session_rowids: Optional[Sequence[int]] = None
        if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
            page_project_evaluator_ids = tuple(
                dict.fromkeys(await session.scalars(select(eligible_page.c.project_evaluator_id)))
            )
            if not page_project_evaluator_ids:
                return 0, eligible_pair_count
            page_project_evaluator_ids_parameter = bindparam(
                "page_project_evaluator_ids",
                page_project_evaluator_ids,
                type_=ARRAY(Integer),
            )
            locked_project_evaluator_ids = tuple(
                await session.scalars(
                    select(models.ProjectEvaluator.id)
                    .where(
                        models.ProjectEvaluator.id == any_(page_project_evaluator_ids_parameter),
                    )
                    .order_by(models.ProjectEvaluator.id)
                    .with_for_update()
                )
            )
            if len(locked_project_evaluator_ids) != len(page_project_evaluator_ids):
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
        selected_page = select(eligible_page)
        if locked_project_evaluator_ids is not None:
            selected_page = selected_page.where(
                eligible_page.c.project_evaluator_id.in_(locked_project_evaluator_ids)
            )
        if locked_project_session_rowids is not None:
            selected_page = selected_page.where(
                eligible_page.c.project_session_rowid.in_(locked_project_session_rowids)
            )
        rows = (await session.execute(selected_page)).all()
        decisions: list[dict[str, Any]] = []
        for row in rows:
            if not row.filter_matches:
                status: models.EvalSessionWorkStatus = "FILTERED_OUT"
            elif sample_key(row.session_id) >= row.sampling_rate:
                status = "SAMPLED_OUT"
            else:
                status = "PENDING"
            decisions.append(
                {
                    "project_session_rowid": row.project_session_rowid,
                    "evaluator_id": row.evaluator_id,
                    "project_evaluator_id": row.project_evaluator_id,
                    "config_fingerprint": row.config_fingerprint,
                    "evaluated_through": row.evaluated_through,
                    "status": status,
                }
            )
        if not decisions:
            return 0, eligible_pair_count
        inserted_statuses = (
            await session.scalars(
                _session_work_insert_statement(
                    decisions,
                    self._db.dialect,
                )
            )
        ).all()
        return inserted_statuses.count("PENDING"), eligible_pair_count

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
