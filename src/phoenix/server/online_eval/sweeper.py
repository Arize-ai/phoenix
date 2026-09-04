"""Materialize evaluation work after entity activity becomes old enough."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Any, Callable, Optional, Sequence

from sqlalchemy import (
    ColumnElement,
    Float,
    Insert,
    Integer,
    String,
    and_,
    any_,
    bindparam,
    case,
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
from sqlalchemy.sql.elements import TextClause
from sqlalchemy.sql.selectable import ScalarSelect, Subquery
from typing_extensions import assert_never

from phoenix.config import (
    get_env_enable_prometheus,
    get_env_online_eval_frontier_lag_seconds,
)
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
    ONLINE_EVAL_ELIGIBLE_PAIR_BACKLOG,
    ONLINE_EVAL_MATERIALIZED_WORK_UNITS,
    ONLINE_EVAL_RESULT_WATERMARK_LAG_SECONDS,
    ONLINE_EVAL_SWEEP_ATTEMPTS,
    ONLINE_EVAL_SWEEP_DURATION_SECONDS,
    ONLINE_EVAL_SWEEP_FAILURES,
    ONLINE_EVAL_SWEEP_SUCCESSES,
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

_EntityModel = type[models.ProjectSession]
_WorkUnitModel = type[models.EvalSessionWorkUnit]


@dataclass(frozen=True)
class _SweepTarget:
    """The tables, columns and predicates one evaluation target sweeps over."""

    entity_model: _EntityModel
    entity_project_id_column: str
    sample_key_column: str
    work_unit_model: _WorkUnitModel
    work_unit_target_column: str
    live_work_index_predicate: TextClause
    filtered_entity_rowids_subquery: Callable[[str, Sequence[int]], ScalarSelect[int]]
    is_evaluable: Callable[[], ColumnElement[bool]]
    project_evaluator_is_schedulable: Callable[[type[models.ProjectEvaluator]], ColumnElement[bool]]
    lease_name_prefix: str


_SWEEP_TARGETS: dict[models.EvaluationTarget, _SweepTarget] = {
    "SESSION": _SweepTarget(
        entity_model=models.ProjectSession,
        entity_project_id_column="project_id",
        sample_key_column="session_id",
        work_unit_model=models.EvalSessionWorkUnit,
        work_unit_target_column="project_session_rowid",
        live_work_index_predicate=text(live_eval_session_work_index_predicate()),
        filtered_entity_rowids_subquery=get_filtered_session_rowids_subquery,
        is_evaluable=lambda: models.ProjectSession.content_complete.is_(True),
        project_evaluator_is_schedulable=session_project_evaluator_is_schedulable,
        lease_name_prefix=_SESSION_SWEEP_LEASE_NAME,
    ),
}


@dataclass(frozen=True)
class _SweepProjectEvaluator:
    project_evaluator_id: int
    project_id: int
    evaluator_id: int
    fingerprint: str
    delay_seconds: int
    created_at: datetime
    sweep_floor: datetime
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
            f"{prefix}_evaluator_id": project_evaluator.evaluator_id,
            f"{prefix}_config_fingerprint": project_evaluator.fingerprint,
            f"{prefix}_delay_seconds": project_evaluator.delay_seconds,
            f"{prefix}_sweep_floor": project_evaluator.sweep_floor,
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
                f"CAST({placeholders[3]} AS VARCHAR)",
                f"CAST({placeholders[4]} AS INTEGER)",
                f"CAST({placeholders[5]} AS {timestamp_type})",
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
        "sc.column6 AS sweep_floor, "
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
            column("sweep_floor", models.UtcTimeStamp()),
            column("sampling_rate", Float),
        )
        .subquery("sweep_evaluators")
    )


def _holds_live_key(work_unit: Any) -> ColumnElement[bool]:
    """Whether a work-unit row still sits inside the live-key index's predicate."""
    return or_(
        work_unit.status.in_(("PENDING", "RUNNING")),
        work_unit.status.in_(SESSION_DECLINED_STATUSES),
        and_(
            work_unit.status == "ERROR",
            work_unit.attempts < MAX_ATTEMPTS,
        ),
    )


def _live_work_exists(
    target: _SweepTarget,
    project_evaluator_relation: Subquery,
) -> ColumnElement[bool]:
    """Whether the entity still holds a live dedup key for this criterion."""
    live_work = aliased(target.work_unit_model)
    return (
        select(1)
        .select_from(live_work)
        .where(
            getattr(live_work, target.work_unit_target_column) == target.entity_model.id,
            live_work.evaluator_id == project_evaluator_relation.c.evaluator_id,
            live_work.config_fingerprint == project_evaluator_relation.c.config_fingerprint,
            _holds_live_key(live_work),
        )
        .correlate(target.entity_model, project_evaluator_relation)
        .exists()
    )


def _eligible_pairs_statement(
    target: _SweepTarget,
    project_evaluator_relation: Subquery,
    database_now: datetime,
    dialect: SupportedSQLDialect,
    *,
    filter_matches: ColumnElement[bool],
) -> Select[Any]:
    entity_model = target.entity_model
    target_column = target.work_unit_target_column
    successful_work = aliased(target.work_unit_model)
    terminal_work = aliased(target.work_unit_model)
    terminal_watermark = (
        select(func.max(terminal_work.evaluated_through))
        .where(
            getattr(terminal_work, target_column) == entity_model.id,
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
        .correlate(entity_model, project_evaluator_relation)
        .scalar_subquery()
    )
    successful_result_exists = (
        select(1)
        .select_from(successful_work)
        .where(
            getattr(successful_work, target_column) == entity_model.id,
            successful_work.evaluator_id == project_evaluator_relation.c.evaluator_id,
            successful_work.config_fingerprint == project_evaluator_relation.c.config_fingerprint,
            successful_work.status == "DONE",
        )
        .correlate(entity_model, project_evaluator_relation)
        .exists()
    )
    if dialect is SupportedSQLDialect.SQLITE:
        due_at = (
            cast(func.julianday(entity_model.last_span_ingested_at), Float) * 86_400
            + project_evaluator_relation.c.delay_seconds
        )
        current_time = cast(func.julianday(database_now), Float) * 86_400
    else:
        due_at = (
            func.extract("epoch", entity_model.last_span_ingested_at)
            + project_evaluator_relation.c.delay_seconds
        )
        current_time = func.extract("epoch", literal(database_now))
    return (
        select(
            entity_model.id.label("entity_rowid"),
            getattr(entity_model, target.sample_key_column).label("sample_identity"),
            project_evaluator_relation.c.project_evaluator_id,
            project_evaluator_relation.c.evaluator_id,
            project_evaluator_relation.c.config_fingerprint,
            project_evaluator_relation.c.sampling_rate,
            entity_model.last_span_ingested_at.label("evaluated_through"),
            due_at.label("effective_due_time"),
            filter_matches.label("filter_matches"),
        )
        .select_from(entity_model)
        .join(
            project_evaluator_relation,
            getattr(entity_model, target.entity_project_id_column)
            == project_evaluator_relation.c.project_id,
        )
        .where(
            target.is_evaluable(),
            entity_model.last_span_ingested_at.is_not(None),
            entity_model.last_span_ingested_at >= project_evaluator_relation.c.sweep_floor,
            due_at <= current_time,
            ~successful_result_exists,
            ~_live_work_exists(target, project_evaluator_relation),
            or_(
                terminal_watermark.is_(None),
                terminal_watermark < entity_model.last_span_ingested_at,
            ),
        )
    )


def _eligible_pairs_relation(
    target: _SweepTarget,
    project_evaluators: Sequence[_SweepProjectEvaluator],
    database_now: datetime,
    dialect: SupportedSQLDialect,
) -> Subquery:
    statements: list[Select[Any]] = []
    unfiltered = [pe for pe in project_evaluators if not pe.filter_condition]
    if unfiltered:
        statements.append(
            _eligible_pairs_statement(
                target,
                _project_evaluator_relation(unfiltered, dialect),
                database_now,
                dialect,
                filter_matches=literal(True),
            )
        )
    for project_evaluator in project_evaluators:
        if not project_evaluator.filter_condition:
            continue
        filter_matches = target.entity_model.id.in_(
            target.filtered_entity_rowids_subquery(
                project_evaluator.filter_condition,
                [project_evaluator.project_id],
            )
        )
        statements.append(
            _eligible_pairs_statement(
                target,
                _project_evaluator_relation([project_evaluator], dialect),
                database_now,
                dialect,
                filter_matches=filter_matches,
            )
        )
    if len(statements) == 1:
        return statements[0].subquery("eligible_pairs")
    return union_all(*statements).subquery("eligible_pairs")


def _work_insert_statement(
    target: _SweepTarget,
    decisions: Sequence[dict[str, Any]],
    dialect: SupportedSQLDialect,
) -> Insert:
    """Insert scheduling decisions whose PostgreSQL evaluator and entity rows are locked."""
    work_unit_model = target.work_unit_model
    index_elements = (
        getattr(work_unit_model, target.work_unit_target_column),
        work_unit_model.evaluator_id,
        work_unit_model.config_fingerprint,
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return (
            insert_postgresql(work_unit_model)
            .values(decisions)
            .on_conflict_do_nothing(
                index_elements=index_elements,
                index_where=target.live_work_index_predicate,
            )
            .returning(work_unit_model.status)
        )
    if dialect is SupportedSQLDialect.SQLITE:
        return (
            insert_sqlite(work_unit_model)
            .values(decisions)
            .on_conflict_do_nothing(
                index_elements=index_elements,
                index_where=target.live_work_index_predicate,
            )
            .returning(work_unit_model.status)
        )
    assert_never(dialect)


class EvalSweeper(DaemonTask):
    """Create pending work for eligible entities of one evaluation target."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        evaluation_target: models.EvaluationTarget,
        max_outstanding: int,
        consumer_group: str = _CONSUMER_GROUP,
        tick_interval_seconds: float = SESSION_SWEEP_INTERVAL_SECONDS,
    ) -> None:
        super().__init__()
        if (target := _SWEEP_TARGETS.get(evaluation_target)) is None:
            raise ValueError(f"Online evaluation sweeping does not support {evaluation_target}")
        self._db = db
        self._evaluation_target = evaluation_target
        self._target = target
        self._metric_labels = {"evaluation_target": evaluation_target}
        self._consumer_group = consumer_group
        self._tick_interval_seconds = tick_interval_seconds
        self._max_outstanding = max_outstanding
        self._late_commit_margin = timedelta(seconds=get_env_online_eval_frontier_lag_seconds())
        self._publish_metrics = get_env_enable_prometheus()
        self._sweeper_id = f"{evaluation_target.lower()}-sweeper-{token_hex(8)}"
        self._lease_name = f"{target.lease_name_prefix}:{consumer_group}"
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
        labels = self._metric_labels
        if self._publish_metrics:
            ONLINE_EVAL_SWEEP_ATTEMPTS.labels(**labels).inc()
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
                ONLINE_EVAL_SWEEP_FAILURES.labels(**labels).inc()
            raise
        finally:
            if self._publish_metrics:
                ONLINE_EVAL_SWEEP_DURATION_SECONDS.labels(**labels).observe(
                    time.monotonic() - started_at
                )
        if self._publish_metrics:
            if renewed is None:
                ONLINE_EVAL_SWEEP_FAILURES.labels(**labels).inc()
            else:
                ONLINE_EVAL_SWEEP_SUCCESSES.labels(**labels).inc()
                ONLINE_EVAL_MATERIALIZED_WORK_UNITS.labels(**labels).inc(materialized_work_count)
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

    async def _load_evaluators(self, session: AsyncSession) -> list[_SweepProjectEvaluator]:
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
                    self._target.project_evaluator_is_schedulable(models.ProjectEvaluator),
                )
            )
        ).all()
        project_evaluator_pairs = [
            (project_evaluator, evaluator) for project_evaluator, evaluator in rows
        ]
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
            project_evaluator_rows.append(
                _SweepProjectEvaluator(
                    project_evaluator_id=project_evaluator.id,
                    project_id=project_evaluator.project_id,
                    evaluator_id=project_evaluator.evaluator_id,
                    fingerprint=config_fingerprint(resolved),
                    delay_seconds=project_evaluator.evaluation_delay_seconds,
                    created_at=project_evaluator.created_at,
                    sweep_floor=(project_evaluator.swept_through_at or project_evaluator.created_at)
                    - self._late_commit_margin,
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
        await reap_lapsed_leases(session, self._target.work_unit_model)
        work_budget = await self._admission_budget(session)
        if work_budget == 0:
            return 0, None
        project_evaluators = await self._load_evaluators(session)
        materialized_work_count, eligible_pair_count = await self._load_eligible_pairs(
            session,
            database_now,
            project_evaluators,
            limit=min(work_budget, _MAX_ELIGIBLE_PAIRS_PER_TICK),
        )
        await self._revive_stale_fingerprint_work(
            session,
            project_evaluators,
            limit=work_budget - materialized_work_count,
        )
        return materialized_work_count, eligible_pair_count

    async def _load_eligible_pairs(
        self,
        session: AsyncSession,
        database_now: datetime,
        project_evaluators: Sequence[_SweepProjectEvaluator],
        *,
        limit: int,
    ) -> tuple[int, Optional[int]]:
        if not project_evaluators:
            return 0, 0 if self._publish_metrics else None
        target = self._target
        relation = _eligible_pairs_relation(
            target,
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
                relation.c.entity_rowid,
                relation.c.project_evaluator_id,
            )
            .limit(limit)
            .subquery("eligible_pair_page")
        )
        rows: Sequence[Any] = ()
        page_project_evaluator_id_per_row: Sequence[int] = ()
        if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
            page_project_evaluator_id_per_row = tuple(
                await session.scalars(select(eligible_page.c.project_evaluator_id))
            )
            page_row_count = len(page_project_evaluator_id_per_row)
        else:
            rows = (await session.execute(select(eligible_page))).all()
            page_row_count = len(rows)
        locked_project_evaluator_ids: tuple[int, ...] = ()
        page_project_evaluator_ids: tuple[int, ...] = ()
        if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
            page_project_evaluator_ids = tuple(dict.fromkeys(page_project_evaluator_id_per_row))
            if page_project_evaluator_ids:
                page_project_evaluator_ids_parameter = bindparam(
                    "page_project_evaluator_ids",
                    page_project_evaluator_ids,
                    type_=ARRAY(Integer),
                )
                locked_project_evaluator_ids = tuple(
                    await session.scalars(
                        select(models.ProjectEvaluator.id)
                        .where(
                            models.ProjectEvaluator.id
                            == any_(page_project_evaluator_ids_parameter),
                        )
                        .order_by(models.ProjectEvaluator.id)
                        .with_for_update()
                    )
                )
                if len(locked_project_evaluator_ids) != len(page_project_evaluator_ids):
                    return 0, eligible_pair_count
        if page_row_count < limit:
            await self._advance_watermarks_to_due_horizon(
                session,
                project_evaluators,
                database_now,
            )
        if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
            if not page_project_evaluator_ids:
                return 0, eligible_pair_count
            page_ids = tuple(
                dict.fromkeys(await session.scalars(select(eligible_page.c.entity_rowid)))
            )
            if not page_ids:
                return 0, eligible_pair_count
            page_ids_parameter = bindparam(
                "page_ids",
                page_ids,
                type_=ARRAY(Integer),
            )
            locked_entity_rowids = tuple(
                await session.scalars(
                    select(target.entity_model.id)
                    .where(
                        target.entity_model.id == any_(page_ids_parameter),
                        target.is_evaluable(),
                    )
                    .order_by(target.entity_model.id)
                    .with_for_update()
                )
            )
            if not locked_entity_rowids:
                return 0, eligible_pair_count
            rows = (
                await session.execute(
                    select(eligible_page).where(
                        eligible_page.c.project_evaluator_id.in_(locked_project_evaluator_ids),
                        eligible_page.c.entity_rowid.in_(locked_entity_rowids),
                    )
                )
            ).all()
        if page_row_count >= limit:
            await self._advance_watermarks_through_swept_rows(session, rows)
        decisions: list[dict[str, Any]] = []
        for row in rows:
            if not row.filter_matches:
                status: models.EvalSessionWorkStatus = "FILTERED_OUT"
            elif sample_key(row.sample_identity) >= row.sampling_rate:
                status = "SAMPLED_OUT"
            else:
                status = "PENDING"
            decisions.append(
                {
                    target.work_unit_target_column: row.entity_rowid,
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
                _work_insert_statement(
                    target,
                    decisions,
                    self._db.dialect,
                )
            )
        ).all()
        return inserted_statuses.count("PENDING"), eligible_pair_count

    async def _revive_stale_fingerprint_work(
        self,
        session: AsyncSession,
        project_evaluators: Sequence[_SweepProjectEvaluator],
        *,
        limit: int,
    ) -> None:
        """Re-offer work expired against a configuration the evaluator has moved back to."""
        if not project_evaluators or limit <= 0:
            return
        work_unit_model = self._target.work_unit_model
        target_column = getattr(work_unit_model, self._target.work_unit_target_column)
        relation = _project_evaluator_relation(project_evaluators, self._db.dialect)
        expired_against_the_current_configuration = (
            select(1)
            .select_from(relation)
            .where(
                relation.c.project_evaluator_id == work_unit_model.project_evaluator_id,
                relation.c.config_fingerprint == work_unit_model.config_fingerprint,
            )
            .correlate(work_unit_model)
            .exists()
        )
        other_work = aliased(work_unit_model)
        dedup_key_taken = (
            select(1)
            .select_from(other_work)
            .where(
                getattr(other_work, self._target.work_unit_target_column) == target_column,
                other_work.evaluator_id == work_unit_model.evaluator_id,
                other_work.config_fingerprint == work_unit_model.config_fingerprint,
                other_work.id != work_unit_model.id,
                or_(other_work.status == "DONE", _holds_live_key(other_work)),
            )
            .correlate(work_unit_model)
            .exists()
        )
        revivable = (
            select(work_unit_model.id)
            .where(
                work_unit_model.status == "EXPIRED",
                work_unit_model.error == STALE_FINGERPRINT_ERROR,
                expired_against_the_current_configuration,
                ~dedup_key_taken,
            )
            .order_by(work_unit_model.id)
            .limit(limit)
        )
        await session.execute(
            update(work_unit_model)
            .where(work_unit_model.id.in_(revivable))
            .values(
                status="PENDING",
                attempts=0,
                error=None,
                claimed_by=None,
                claimed_at=None,
                cooldown_until=None,
            )
        )

    async def _advance_watermarks_to_due_horizon(
        self,
        session: AsyncSession,
        project_evaluators: Sequence[_SweepProjectEvaluator],
        database_now: datetime,
    ) -> None:
        """Record that every loaded evaluator has swept everything already due to it."""
        await self._write_watermarks(
            session,
            {
                project_evaluator.project_evaluator_id: max(
                    project_evaluator.created_at,
                    database_now - timedelta(seconds=project_evaluator.delay_seconds),
                )
                for project_evaluator in project_evaluators
            },
        )

    async def _advance_watermarks_through_swept_rows(
        self,
        session: AsyncSession,
        rows: Sequence[Any],
    ) -> None:
        """Record how far a truncated page reached, per evaluator."""
        watermarks: dict[int, datetime] = {}
        for row in rows:
            reached = watermarks.get(row.project_evaluator_id)
            if reached is None or row.evaluated_through > reached:
                watermarks[row.project_evaluator_id] = row.evaluated_through
        await self._write_watermarks(session, watermarks)

    async def _write_watermarks(
        self,
        session: AsyncSession,
        watermarks: dict[int, datetime],
    ) -> None:
        if not watermarks:
            return
        project_evaluator_ids = sorted(watermarks)
        # One statement, ids in order: a statement per watermark locks evaluator rows in a
        # tick-varying order, which deadlocks against the delete mutation's own order.
        watermark = case(
            {
                project_evaluator_id: literal(
                    watermarks[project_evaluator_id], models.UtcTimeStamp()
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
                    models.ProjectEvaluator.swept_through_at < watermark,
                ),
            )
            .values(
                swept_through_at=watermark,
                # Pinned: the column's onupdate would restamp every enabled evaluator a tick.
                updated_at=models.ProjectEvaluator.updated_at,
            )
        )

    async def _publish_eligibility_metrics(self, eligible_pair_count: Optional[int]) -> None:
        """Publish the sweep's observation gauges from a session of its own.

        Reporting is not materialization: this runs after the work has been committed
        and the lease renewed, over its own read session, so a failing aggregate costs
        a stale gauge rather than the sweep that already succeeded.
        """
        if eligible_pair_count is not None:
            ONLINE_EVAL_ELIGIBLE_PAIR_BACKLOG.labels(**self._metric_labels).set(eligible_pair_count)
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
        target = self._target
        entity_model = target.entity_model
        work_unit_model = target.work_unit_model
        if self._db.dialect is SupportedSQLDialect.SQLITE:
            lag_seconds = (
                cast(func.julianday(entity_model.last_span_ingested_at), Float)
                - cast(func.julianday(work_unit_model.evaluated_through), Float)
            ) * 86_400
        else:
            lag_seconds = func.extract(
                "epoch",
                entity_model.last_span_ingested_at - work_unit_model.evaluated_through,
            )
        watermark_lag_seconds = await session.scalar(
            select(func.max(lag_seconds))
            .select_from(work_unit_model)
            .join(
                entity_model,
                getattr(work_unit_model, target.work_unit_target_column) == entity_model.id,
            )
            .where(
                work_unit_model.status == "DONE",
                work_unit_model.updated_at
                >= database_now - timedelta(seconds=_WATERMARK_LAG_WINDOW_SECONDS),
                entity_model.last_span_ingested_at.is_not(None),
            )
        )
        ONLINE_EVAL_RESULT_WATERMARK_LAG_SECONDS.labels(**self._metric_labels).set(
            max(float(watermark_lag_seconds or 0.0), 0.0)
        )

    async def _admission_budget(self, session: AsyncSession) -> int:
        work_unit_model = self._target.work_unit_model
        outstanding = (
            select(1)
            .select_from(work_unit_model)
            .where(
                or_(
                    work_unit_model.status.in_(("PENDING", "RUNNING")),
                    and_(
                        work_unit_model.status == "ERROR",
                        work_unit_model.attempts < MAX_ATTEMPTS,
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
