"""For a given session content version (`last_span_ingested_at`, advanced only by span
ingestion — never by annotations), each evaluator runs at most once per configuration,
whatever the trigger topology; new content re-arms one round; explicit force is the
only bypass.

The leased sweeper makes at most one decision per (session, project_evaluators) pair per tick
after session activity becomes old enough.

Scheduling is one relation with three scheduling origins. Ambient sweeping proposes a
pair once its content is complete and quiet, and it has no terminal evidence yet. An
unfulfilled evaluation request assigns the rule origin, while an unfulfilled forced
generation assigns the explicit origin. Precedence runs explicit before rule before
ambient, and a pair receives at most one decision per sweep.

Both the ambient and rule origins gate on the project_evaluators's own session filter, through
the same compiled branches: a trigger says when to look and the filter says what is in
scope. They differ in what a miss means. Ambient sweeping is a scan, so a miss is a
decision it records and moves on from. A request is standing demand, so a miss leaves it
unfulfilled with nothing written — the session may satisfy the filter later, and the next
sweep asks again. The explicit origin skips the filter: forcing names a session outright.
"""

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
    case,
    cast,
    column,
    func,
    literal,
    null,
    or_,
    select,
    text,
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

from phoenix.config import (
    get_env_enable_prometheus,
    get_env_online_eval_max_session_outstanding,
    get_env_online_eval_retention_seconds,
)
from phoenix.db import models
from phoenix.db.eval_work import (
    SESSION_DECLINED_STATUSES,
    SUPERSEDED_BY_REQUEST_ERROR,
    live_eval_session_work_index_predicate,
)
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.db_coordinator import reap_lapsed_leases
from phoenix.server.online_eval.derivation import (
    MAX_ATTEMPTS,
    config_fingerprint,
    sample_key,
)
from phoenix.server.online_eval.leases import DatabaseLease, LeaseLost
from phoenix.server.online_eval.project_evaluator_resolution import resolve_project_evaluators_bulk
from phoenix.server.online_eval.requests import (
    acknowledge_materialization,
    is_unfulfilled,
    unfulfilled_requests,
)
from phoenix.server.online_eval.session_policy import (
    admitted_session_work_count_statement,
    session_project_evaluator_is_schedulable,
    session_matches_project_evaluator_filter,
    session_work_answers_request,
    session_work_records_background_decision,
)
from phoenix.server.online_eval.session_retention import reap_session_history
from phoenix.server.prometheus import (
    ONLINE_EVAL_SESSION_ELIGIBLE_PAIR_BACKLOG,
    ONLINE_EVAL_SESSION_MATERIALIZED_WORK_UNITS,
    ONLINE_EVAL_SESSION_RESULT_WATERMARK_LAG_SECONDS,
    ONLINE_EVAL_SESSION_SCHEDULING_BACKLOG,
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
# Only work terminated within this window feeds the watermark-lag gauge. The bound is
# intentionally shorter than the default retention window so metric cost stays stable
# even when operators configure a longer history window.
_WATERMARK_LAG_WINDOW_SECONDS = 86_400.0

_LIVE_WORK_INDEX_PREDICATE = text(live_eval_session_work_index_predicate())

_AMBIENT = "AMBIENT"
_RULE = "RULE"
_EXPLICIT = "EXPLICIT"
# Lower rank wins when several scheduling origins claim the same pair.
_EXPLICIT_RANK, _RULE_RANK, _AMBIENT_RANK = 0, 1, 2


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


def _timestamp_sql_type(dialect: SupportedSQLDialect) -> str:
    return "TIMESTAMP WITH TIME ZONE" if dialect is SupportedSQLDialect.POSTGRESQL else "TEXT"


def _values_relation(
    rows: Sequence[tuple[Any, dict[str, Any]]],
    sql_types: Sequence[str],
    columns: Sequence[Any],
    *,
    alias: str,
    name: str,
    bind_prefix: str,
) -> Subquery:
    """Return a portable inline VALUES relation, one row per entry in ``rows``.

    SQLite caps a compound SELECT at 500 branches and PostgreSQL plans one slowly, so
    configuration rows enter a statement as an inline relation rather than as unioned
    selects. Only the first row is cast; the rest take their types from it.

    Each entry is ``(identity, values)``, and bind names are keyed off that identity
    rather than off row position. Several of these relations are unioned into one
    statement, ``text()`` binds are not unique, and position-keyed names from different
    relations silently overwrite each other — one relation's row would then carry
    another's values. Identity must be unique within a relation, and two relations built
    over overlapping identities in one statement need distinct ``bind_prefix`` values.
    """
    values_rows = []
    parameters: dict[str, Any] = {}
    for index, (identity, values) in enumerate(rows):
        prefix = f"{bind_prefix}{identity}"
        row_parameters = {f"{prefix}_{key}": value for key, value in values.items()}
        parameters.update(row_parameters)
        placeholders = [f":{parameter}" for parameter in row_parameters]
        if index == 0:
            placeholders = [
                f"CAST({placeholder} AS {sql_type})"
                for placeholder, sql_type in zip(placeholders, sql_types, strict=True)
            ]
        values_rows.append(f"({', '.join(placeholders)})")
    select_list = ", ".join(
        f"{alias}.column{position} AS {selected.name}"
        for position, selected in enumerate(columns, start=1)
    )
    statement = text(f"SELECT {select_list} FROM (VALUES {', '.join(values_rows)}) AS {alias}")
    return statement.bindparams(**parameters).columns(*columns).subquery(name)


def _project_evaluator_relation(
    project_evaluators: Sequence[_SessionProjectEvaluator],
    dialect: SupportedSQLDialect,
    *,
    bind_prefix: str = "sc",
) -> Subquery:
    """Return a portable inline relation for resolved session project evaluators.

    One project_evaluator can appear in both an ambient and a triggered relation of the same
    statement, so those relations pass distinct ``bind_prefix`` values.
    """
    return _values_relation(
        [
            (
                project_evaluator.project_evaluator_id,
                {
                    "project_evaluator_id": project_evaluator.project_evaluator_id,
                    "project_id": project_evaluator.project_id,
                    "evaluator_id": project_evaluator.evaluator_id,
                    "config_fingerprint": project_evaluator.fingerprint,
                    "delay_seconds": project_evaluator.delay_seconds,
                    "created_at": project_evaluator.created_at,
                    "sampling_rate": project_evaluator.sampling_rate,
                },
            )
            for project_evaluator in project_evaluators
        ],
        (
            "INTEGER",
            "INTEGER",
            "INTEGER",
            "VARCHAR",
            "INTEGER",
            _timestamp_sql_type(dialect),
            "FLOAT",
        ),
        (
            column("project_evaluator_id", Integer),
            column("project_id", Integer),
            column("evaluator_id", Integer),
            column("config_fingerprint", String),
            column("delay_seconds", Integer),
            column("created_at", models.UtcTimeStamp()),
            column("sampling_rate", Float),
        ),
        alias="sc",
        name="sweep_project_evaluators",
        bind_prefix=bind_prefix,
    )


def _work_exists(
    project_evaluator_relation: Subquery,
    *,
    include_declined: bool,
) -> ColumnElement[bool]:
    """Whether work for this pair is unfinished, optionally including declined holders."""
    work = aliased(models.EvalSessionWorkUnit)
    status_predicate = or_(
        work.status.in_(("PENDING", "RUNNING")),
        and_(work.status == "ERROR", work.attempts < MAX_ATTEMPTS),
    )
    if include_declined:
        status_predicate = or_(
            status_predicate,
            work.status.in_(SESSION_DECLINED_STATUSES),
        )
    return (
        select(1)
        .select_from(work)
        .where(
            work.project_session_rowid == models.ProjectSession.id,
            work.evaluator_id == project_evaluator_relation.c.evaluator_id,
            work.config_fingerprint == project_evaluator_relation.c.config_fingerprint,
            status_predicate,
        )
        .correlate(models.ProjectSession, project_evaluator_relation)
        .exists()
    )


def _live_work_exists(project_evaluator_relation: Subquery) -> ColumnElement[bool]:
    """Whether the session still holds a live dedup key for this criterion."""
    return _work_exists(project_evaluator_relation, include_declined=True)


def _unfinished_work_exists(project_evaluator_relation: Subquery) -> ColumnElement[bool]:
    """Whether work for this pair may still produce a result.

    Declined decisions are excluded on purpose: a request displaces them, while work
    that can still run is waited for rather than duplicated.
    """
    return _work_exists(project_evaluator_relation, include_declined=False)


def _unfulfilled_request_exists(project_evaluator_relation: Subquery) -> ColumnElement[bool]:
    """Whether an unanswered ask already covers this pair.

    The ambient origin skips such a pair. A triggered origin emits its own row for it
    and outranks ambient anyway, so an ambient twin only spends a slot in the page that
    yields no decision — halving the sweep's reach under trigger load.
    """
    request = aliased(models.EvaluationRequest)
    return (
        select(1)
        .select_from(request)
        .where(
            request.project_session_rowid == models.ProjectSession.id,
            request.project_evaluator_id == project_evaluator_relation.c.project_evaluator_id,
            is_unfulfilled(request),
        )
        .correlate(models.ProjectSession, project_evaluator_relation)
        .exists()
    )


def _quiet_delay_columns(
    project_evaluator_relation: Subquery,
    database_now: datetime,
    dialect: SupportedSQLDialect,
) -> tuple[ColumnElement[Any], ColumnElement[Any]]:
    """The pair's due time and the current time, both in epoch seconds."""
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
    return due_at, current_time


def _triggered_pairs_statement(
    project_evaluator_relation: Subquery,
    database_now: datetime,
    dialect: SupportedSQLDialect,
    *,
    filter_matches: Optional[ColumnElement[bool]] = None,
) -> Select[Any]:
    """The pairs an unfulfilled evaluation request is asking for.

    A forced generation assigns the explicit origin, which carries no
    terminal brake at all: forcing is the one ask allowed to unsettle a finished
    evaluation. Everything else is braked by an outcome covering the same configuration
    and the same session content, and answers the request by linking that outcome
    instead of scheduling again.

    ``filter_matches`` is the project_evaluators's own session filter, compiled by the caller for
    the one project_evaluator this statement covers. A rule fires on an event; the filter
    says which sessions are in scope at all, and a request is the composite of the two.
    A pair the filter excludes is simply absent here, so its request stays unfulfilled
    and is re-tested next sweep — a request is intent, not a scan decision, and writing
    a declined row for it would settle a question the session may yet answer. The
    explicit origin passes the gate unconditionally: forcing means forcing.
    """
    pending = unfulfilled_requests().subquery("pending_requests")
    due_at, current_time = _quiet_delay_columns(project_evaluator_relation, database_now, dialect)
    terminal_work = aliased(models.EvalSessionWorkUnit)
    answering_work_unit_id = (
        # Eligibility identity blocks repeats; the insert-time re-check is its race twin.
        select(func.max(terminal_work.id))
        .where(
            terminal_work.project_session_rowid == models.ProjectSession.id,
            terminal_work.evaluator_id == project_evaluator_relation.c.evaluator_id,
            terminal_work.config_fingerprint == project_evaluator_relation.c.config_fingerprint,
            terminal_work.evaluated_through >= models.ProjectSession.last_span_ingested_at,
            session_work_answers_request(terminal_work),
        )
        .correlate(models.ProjectSession, project_evaluator_relation)
        .scalar_subquery()
    )
    declined_work = aliased(models.EvalSessionWorkUnit)
    # At most one row holds the live key, so this names the single declined holder.
    declined_work_unit_id = (
        select(func.max(declined_work.id))
        .where(
            declined_work.project_session_rowid == models.ProjectSession.id,
            declined_work.evaluator_id == project_evaluator_relation.c.evaluator_id,
            declined_work.config_fingerprint == project_evaluator_relation.c.config_fingerprint,
            declined_work.status.in_(SESSION_DECLINED_STATUSES),
        )
        .correlate(models.ProjectSession, project_evaluator_relation)
        .scalar_subquery()
    )
    forced = pending.c.forced
    return (
        select(
            models.ProjectSession.id.label("project_session_rowid"),
            models.ProjectSession.session_id,
            project_evaluator_relation.c.project_evaluator_id,
            project_evaluator_relation.c.evaluator_id,
            project_evaluator_relation.c.config_fingerprint,
            literal(1.0).label("sampling_rate"),
            models.ProjectSession.last_span_ingested_at.label("evaluated_through"),
            due_at.label("effective_due_time"),
            literal(True).label("filter_matches"),
            case((forced, literal(_EXPLICIT)), else_=literal(_RULE)).label("scheduling_origin"),
            case((forced, literal(_EXPLICIT_RANK)), else_=literal(_RULE_RANK)).label("origin_rank"),
            pending.c.evaluation_request_id,
            pending.c.observed_generation,
            case((forced, null()), else_=answering_work_unit_id).label("answering_work_unit_id"),
            declined_work_unit_id.label("declined_work_unit_id"),
        )
        .select_from(models.ProjectSession)
        .join(
            project_evaluator_relation,
            models.ProjectSession.project_id == project_evaluator_relation.c.project_id,
        )
        .join(
            pending,
            and_(
                pending.c.project_session_rowid == models.ProjectSession.id,
                pending.c.project_evaluator_id == project_evaluator_relation.c.project_evaluator_id,
            ),
        )
        .where(
            models.ProjectSession.content_complete.is_(True),
            models.ProjectSession.last_span_ingested_at.is_not(None),
            due_at <= current_time,
            ~_unfinished_work_exists(project_evaluator_relation),
            *(() if filter_matches is None else (or_(forced, filter_matches),)),
        )
    )


def _triggered_pairs_relation(
    project_evaluators: Sequence[_SessionProjectEvaluator],
    database_now: datetime,
    dialect: SupportedSQLDialect,
) -> Optional[Select[Any]]:
    """The rule and explicit origins, batched where possible and compiled otherwise.

    Filter conditions compile into structurally different SQL, so a filtered project_evaluator
    cannot ride the shared relation as a predicate on it. Unfiltered project_evaluators batch into
    one branch and each filtered project_evaluator gets its own compiled branch, exactly as the
    ambient origin does; the branches union into one relation the page then orders and
    limits as a whole.
    """
    statements: list[Select[Any]] = []
    unfiltered = [pe for pe in project_evaluators if not pe.filter_condition]
    if unfiltered:
        statements.append(
            _triggered_pairs_statement(
                _project_evaluator_relation(unfiltered, dialect, bind_prefix="tc"),
                database_now,
                dialect,
            )
        )
    for project_evaluator in project_evaluators:
        if not project_evaluator.filter_condition:
            continue
        statements.append(
            _triggered_pairs_statement(
                _project_evaluator_relation([project_evaluator], dialect, bind_prefix="tc"),
                database_now,
                dialect,
                filter_matches=session_matches_project_evaluator_filter(
                    project_evaluator.filter_condition,
                    project_evaluator.project_id,
                ),
            )
        )
    if not statements:
        return None
    if len(statements) == 1:
        return statements[0]
    return select(union_all(*statements).subquery("triggered_pairs"))


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
            session_work_records_background_decision(terminal_work),
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
    due_at, current_time = _quiet_delay_columns(project_evaluator_relation, database_now, dialect)
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
            literal(_AMBIENT).label("scheduling_origin"),
            literal(_AMBIENT_RANK).label("origin_rank"),
            cast(null(), Integer).label("evaluation_request_id"),
            cast(null(), Integer).label("observed_generation"),
            cast(null(), Integer).label("answering_work_unit_id"),
            cast(null(), Integer).label("declined_work_unit_id"),
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
            ~_unfulfilled_request_exists(project_evaluator_relation),
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
        statements.append(
            _eligible_pairs_statement(
                _project_evaluator_relation([project_evaluator], dialect),
                database_now,
                dialect,
                filter_matches=session_matches_project_evaluator_filter(
                    project_evaluator.filter_condition,
                    project_evaluator.project_id,
                ),
            )
        )
    if len(statements) == 1:
        return statements[0].subquery("eligible_pairs")
    return union_all(*statements).subquery("eligible_pairs")


def _scheduling_relation(
    project_evaluators: Sequence[_SessionProjectEvaluator],
    database_now: datetime,
    dialect: SupportedSQLDialect,
) -> Subquery:
    """The scheduling origins as one relation, one row per pair and claiming origin."""
    ambient = select(_eligible_pairs_relation(project_evaluators, database_now, dialect))
    triggered = _triggered_pairs_relation(project_evaluators, database_now, dialect)
    if triggered is None:
        return ambient.subquery("scheduling_pairs")
    return union_all(ambient, triggered).subquery("scheduling_pairs")


@dataclass(frozen=True)
class _Decision:
    """What this sweep does about one pair, and which scheduling origin decided it."""

    project_session_rowid: int
    session_id: str
    project_evaluator_id: int
    evaluator_id: int
    config_fingerprint: str
    evaluated_through: datetime
    status: models.EvalSessionWorkStatus
    scheduling_origin: models.SchedulingOrigin
    origin_rank: int
    evaluation_request_id: Optional[int]
    observed_generation: Optional[int]
    answering_work_unit_id: Optional[int]
    declined_work_unit_id: Optional[int]

    @property
    def pair(self) -> tuple[int, int]:
        return self.project_session_rowid, self.project_evaluator_id

    @property
    def answered_by_existing_work(self) -> bool:
        """Whether existing work already answers this request, so none is created."""
        return self.answering_work_unit_id is not None

    def work_row(self) -> dict[str, Any]:
        return {
            "project_session_rowid": self.project_session_rowid,
            "evaluator_id": self.evaluator_id,
            "project_evaluator_id": self.project_evaluator_id,
            "config_fingerprint": self.config_fingerprint,
            "evaluated_through": self.evaluated_through,
            "status": self.status,
            "scheduling_origin": self.scheduling_origin,
        }


def _decision_status(row: Any) -> models.EvalSessionWorkStatus:
    """The ambient filter and sampling gates; triggered origins bypass both."""
    if row.scheduling_origin != _AMBIENT:
        return "PENDING"
    if not row.filter_matches:
        return "FILTERED_OUT"
    if sample_key(row.session_id) >= row.sampling_rate:
        return "SAMPLED_OUT"
    return "PENDING"


def _resolve_decisions(rows: Sequence[Any]) -> list[_Decision]:
    """Resolve at most one decision per pair, preferring the explicit origin."""
    decisions: dict[tuple[int, int], _Decision] = {}
    for row in rows:
        decision = _Decision(
            project_session_rowid=row.project_session_rowid,
            session_id=row.session_id,
            project_evaluator_id=row.project_evaluator_id,
            evaluator_id=row.evaluator_id,
            config_fingerprint=row.config_fingerprint,
            evaluated_through=row.evaluated_through,
            status=_decision_status(row),
            scheduling_origin=row.scheduling_origin,
            origin_rank=row.origin_rank,
            evaluation_request_id=row.evaluation_request_id,
            observed_generation=row.observed_generation,
            answering_work_unit_id=row.answering_work_unit_id,
            declined_work_unit_id=row.declined_work_unit_id,
        )
        held = decisions.get(decision.pair)
        if held is None or decision.origin_rank < held.origin_rank:
            decisions[decision.pair] = decision
    return list(decisions.values())


def _decision_relation(
    decisions: Sequence[_Decision],
    dialect: SupportedSQLDialect,
) -> Subquery:
    """Return a portable inline relation carrying the rows a braked insert may write."""
    return _values_relation(
        [
            (
                f"{decision.project_session_rowid}_{decision.project_evaluator_id}",
                {
                    "project_session_rowid": decision.project_session_rowid,
                    "evaluator_id": decision.evaluator_id,
                    "project_evaluator_id": decision.project_evaluator_id,
                    "config_fingerprint": decision.config_fingerprint,
                    "evaluated_through": decision.evaluated_through,
                },
            )
            for decision in decisions
        ],
        ("INTEGER", "INTEGER", "INTEGER", "VARCHAR", _timestamp_sql_type(dialect)),
        (
            column("project_session_rowid", Integer),
            column("evaluator_id", Integer),
            column("project_evaluator_id", Integer),
            column("config_fingerprint", String),
            column("evaluated_through", models.UtcTimeStamp()),
        ),
        alias="sd",
        name="scheduled_decisions",
        bind_prefix="sd",
    )


_INSERTED_WORK_COLUMNS = (
    models.EvalSessionWorkUnit.id,
    models.EvalSessionWorkUnit.project_session_rowid,
    models.EvalSessionWorkUnit.project_evaluator_id,
    models.EvalSessionWorkUnit.status,
)

_LIVE_KEY_COLUMNS = (
    models.EvalSessionWorkUnit.project_session_rowid,
    models.EvalSessionWorkUnit.evaluator_id,
    models.EvalSessionWorkUnit.config_fingerprint,
)


def _session_work_insert_statement(
    decisions: Sequence[dict[str, Any]],
    dialect: SupportedSQLDialect,
) -> Insert:
    """Insert scheduling decisions whose PostgreSQL evaluator and session rows are locked."""
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return (
            insert_postgresql(models.EvalSessionWorkUnit)
            .values(decisions)
            .on_conflict_do_nothing(
                index_elements=_LIVE_KEY_COLUMNS,
                index_where=_LIVE_WORK_INDEX_PREDICATE,
            )
            .returning(*_INSERTED_WORK_COLUMNS)
        )
    if dialect is SupportedSQLDialect.SQLITE:
        return (
            insert_sqlite(models.EvalSessionWorkUnit)
            .values(decisions)
            .on_conflict_do_nothing(
                index_elements=_LIVE_KEY_COLUMNS,
                index_where=_LIVE_WORK_INDEX_PREDICATE,
            )
            .returning(*_INSERTED_WORK_COLUMNS)
        )
    assert_never(dialect)


def _braked_session_work_insert_statement(
    decisions: Sequence[_Decision],
    dialect: SupportedSQLDialect,
) -> Insert:
    """Insert rule-origin work, re-testing the brake as the insert itself runs.

    The eligibility read and this statement take separate snapshots under READ
    COMMITTED, and the consumers that commit outcomes hold no sweep lease, so an
    outcome can land in between. Repeating the test here narrows that window to this
    statement's own execution.
    """
    relation = _decision_relation(decisions, dialect)
    terminal_work = aliased(models.EvalSessionWorkUnit)
    answered = (
        # Insert-time identity closes races; the eligibility brake is its decision twin.
        select(1)
        .select_from(terminal_work)
        .where(
            terminal_work.project_session_rowid == relation.c.project_session_rowid,
            terminal_work.evaluator_id == relation.c.evaluator_id,
            terminal_work.config_fingerprint == relation.c.config_fingerprint,
            terminal_work.evaluated_through >= relation.c.evaluated_through,
            session_work_answers_request(terminal_work),
        )
        .correlate(relation)
        .exists()
    )
    unanswered_rows = select(
        relation.c.project_session_rowid,
        relation.c.evaluator_id,
        relation.c.project_evaluator_id,
        relation.c.config_fingerprint,
        relation.c.evaluated_through,
        literal("PENDING"),
        literal(_RULE),
    ).where(~answered)
    columns = [
        "project_session_rowid",
        "evaluator_id",
        "project_evaluator_id",
        "config_fingerprint",
        "evaluated_through",
        "status",
        "scheduling_origin",
    ]
    if dialect is SupportedSQLDialect.POSTGRESQL:
        insert_statement = insert_postgresql(models.EvalSessionWorkUnit)
    elif dialect is SupportedSQLDialect.SQLITE:
        insert_statement = insert_sqlite(models.EvalSessionWorkUnit)  # type: ignore[assignment]
    else:
        assert_never(dialect)
    return (
        insert_statement.from_select(columns, unanswered_rows)
        .on_conflict_do_nothing(
            index_elements=_LIVE_KEY_COLUMNS,
            index_where=_LIVE_WORK_INDEX_PREDICATE,
        )
        .returning(*_INSERTED_WORK_COLUMNS)
    )


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
        self._retention_seconds = get_env_online_eval_retention_seconds()
        self._publish_metrics = get_env_enable_prometheus()
        self._sweeper_id = f"session-sweeper-{token_hex(8)}"
        self._lease_name = f"{_SESSION_SWEEP_LEASE_NAME}:{consumer_group}"
        self._lease = DatabaseLease(
            db,
            entity=models.EvalWorkLease,
            key=(models.EvalWorkLease.name == self._lease_name,),
            holder_column=models.EvalWorkLease.holder,
            heartbeat_column=models.EvalWorkLease.heartbeat_at,
            holder_id=self._sweeper_id,
            ttl_seconds=SESSION_SWEEP_LEASE_TTL_SECONDS,
        )

    @property
    def _lease_held(self) -> bool:
        return self._lease.held

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
        try:
            if mutations_allowed:
                await self._materialize_and_renew()
            else:
                await self._lease.renew()
        except LeaseLost:
            logger.warning("Session evaluation sweeper lost its lease")

    async def _acquire_lease(self, *, allow_insert: bool = True) -> Optional[int]:
        lease_id: Optional[int] = await self._lease.acquire(
            models.EvalWorkLease.id,
            bootstrap=self._insert_lease if allow_insert else None,
        )
        return lease_id

    async def _insert_lease(self, session: AsyncSession) -> None:
        await session.execute(
            insert_on_conflict(
                {"name": self._lease_name},
                table=models.EvalWorkLease,
                dialect=self._db.dialect,
                unique_by=("name",),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )

    async def _materialize_and_renew(self) -> None:
        started_at = time.monotonic()
        if self._publish_metrics:
            ONLINE_EVAL_SESSION_SWEEP_ATTEMPTS.inc()
        materialized_work_count = 0
        backlog: Optional[dict[str, int]] = None
        try:
            # Reap in its own transaction: taking work-row locks inside the sweep
            # transaction inverts the global project_evaluators -> session -> work lock order.
            async with self._db() as session:
                await reap_lapsed_leases(session, models.EvalSessionWorkUnit)
                database_now = await self._database_now(session)
                await reap_session_history(
                    session,
                    retention_cutoff=database_now - timedelta(seconds=self._retention_seconds),
                )
            async with self._db() as session:
                database_now = await self._database_now(session)
                materialized_work_count, backlog = await self._sweep(session, database_now)
                await self._lease.fence(session)
        except Exception:
            if self._publish_metrics:
                ONLINE_EVAL_SESSION_SWEEP_FAILURES.inc()
            raise
        finally:
            if self._publish_metrics:
                ONLINE_EVAL_SESSION_SWEEP_DURATION_SECONDS.observe(time.monotonic() - started_at)
        if self._publish_metrics:
            ONLINE_EVAL_SESSION_SWEEP_SUCCESSES.inc()
            ONLINE_EVAL_SESSION_MATERIALIZED_WORK_UNITS.inc(materialized_work_count)
            await self._publish_eligibility_metrics(backlog)

    async def _database_now(self, session: AsyncSession) -> datetime:
        return await self._lease.database_now(session)

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
    ) -> tuple[int, Optional[dict[str, int]]]:
        """Materialize this tick's work, returning (work created, pairs waiting by origin).

        Lapsed-lease reaping runs in a separate committed transaction before this one
        (see _materialize_and_renew), so this transaction only ever locks project_evaluators and
        session rows before inserting work — preserving the global C -> S -> W order.
        """
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
    ) -> tuple[int, Optional[dict[str, int]]]:
        if not project_evaluators:
            return 0, {} if self._publish_metrics else None
        relation = _scheduling_relation(
            project_evaluators,
            database_now,
            self._db.dialect,
        )
        backlog: Optional[dict[str, int]] = None
        if self._publish_metrics:
            backlog = {
                row.scheduling_origin: row.pair_count
                for row in await session.execute(
                    select(
                        relation.c.scheduling_origin,
                        func.count().label("pair_count"),
                    )
                    .select_from(relation)
                    .where(relation.c.filter_matches.is_(True))
                    .group_by(relation.c.scheduling_origin)
                )
            }
        eligible_page = (
            select(relation)
            .order_by(
                relation.c.effective_due_time,
                relation.c.project_session_rowid,
                relation.c.project_evaluator_id,
                relation.c.origin_rank,
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
                return 0, backlog
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
                return 0, backlog
            page_ids = tuple(
                dict.fromkeys(await session.scalars(select(eligible_page.c.project_session_rowid)))
            )
            if not page_ids:
                return 0, backlog
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
                return 0, backlog
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
        decisions = _resolve_decisions(rows)
        if not decisions:
            return 0, backlog
        scheduled = [decision for decision in decisions if not decision.answered_by_existing_work]
        await self._supersede_declined_work(session, scheduled)
        inserted = await self._insert_work(session, scheduled)
        await self._acknowledge_requests(session, decisions, inserted)
        materialized_work_count = sum(1 for _, status in inserted.values() if status == "PENDING")
        return materialized_work_count, backlog

    async def _supersede_declined_work(
        self,
        session: AsyncSession,
        decisions: Sequence[_Decision],
    ) -> None:
        """Retire the declined decisions a request displaces, freeing their dedup key.

        A rule carries its own predicate, so triggered work must not be held back by an
        earlier filter or sampling decision for the same pair.
        """
        displaced = [
            decision.declined_work_unit_id
            for decision in decisions
            if decision.declined_work_unit_id is not None
        ]
        if not displaced:
            return
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(
                models.EvalSessionWorkUnit.id.in_(displaced),
                models.EvalSessionWorkUnit.status.in_(SESSION_DECLINED_STATUSES),
            )
            .values(status="EXPIRED", error=SUPERSEDED_BY_REQUEST_ERROR)
        )

    async def _insert_work(
        self,
        session: AsyncSession,
        decisions: Sequence[_Decision],
    ) -> dict[tuple[int, int], tuple[int, str]]:
        """Write the sweep's work, returning (work unit id, status) per pair written."""
        braked = [decision for decision in decisions if decision.scheduling_origin == _RULE]
        direct = [decision for decision in decisions if decision.scheduling_origin != _RULE]
        statements: list[Insert] = []
        if direct:
            statements.append(
                _session_work_insert_statement(
                    [decision.work_row() for decision in direct],
                    self._db.dialect,
                )
            )
        if braked:
            statements.append(_braked_session_work_insert_statement(braked, self._db.dialect))
        inserted: dict[tuple[int, int], tuple[int, str]] = {}
        for statement in statements:
            for row in await session.execute(statement):
                inserted[(row.project_session_rowid, row.project_evaluator_id)] = (
                    row.id,
                    row.status,
                )
        return inserted

    async def _acknowledge_requests(
        self,
        session: AsyncSession,
        decisions: Sequence[_Decision],
        inserted: dict[tuple[int, int], tuple[int, str]],
    ) -> None:
        """Link each request to the work unit answering it, through its own module.

        Only the generation the eligibility read observed is acknowledged; a request
        that arrived since then is a later generation and waits for the next sweep. A
        request that vanished mid-sweep raises, which rolls the whole sweep back — the
        work insert sharing this transaction must not outlive the request it answers.
        """
        for decision in decisions:
            if decision.evaluation_request_id is None or decision.observed_generation is None:
                continue
            session_work_unit_id = decision.answering_work_unit_id
            if session_work_unit_id is None:
                if (written := inserted.get(decision.pair)) is None:
                    continue
                session_work_unit_id = written[0]
            await acknowledge_materialization(
                session,
                evaluation_request_id=decision.evaluation_request_id,
                observed_generation=decision.observed_generation,
                session_work_unit_id=session_work_unit_id,
            )

    async def _publish_eligibility_metrics(self, backlog: Optional[dict[str, int]]) -> None:
        """Publish the sweep's observation gauges from a session of its own.

        Reporting is not materialization: this runs after the work has been committed
        and the lease renewed, over its own read session, so a failing aggregate costs
        a stale gauge rather than the sweep that already succeeded.
        """
        if backlog is not None:
            ONLINE_EVAL_SESSION_ELIGIBLE_PAIR_BACKLOG.set(backlog.get(_AMBIENT, 0))
            # Every origin is set every tick, so a burst that ends returns its series to
            # zero rather than leaving the last non-zero reading standing.
            for origin in (_AMBIENT, _RULE, _EXPLICIT):
                ONLINE_EVAL_SESSION_SCHEDULING_BACKLOG.labels(scheduling_origin=origin).set(
                    backlog.get(origin, 0)
                )
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
        outstanding_count = (
            await session.scalar(admitted_session_work_count_statement(self._max_outstanding)) or 0
        )
        budget = max(0, self._max_outstanding - outstanding_count)
        if budget == 0:
            logger.warning(
                f"Session evaluation admission gate closed: "
                f"{outstanding_count} outstanding work units reached "
                f"{self._max_outstanding}"
            )
        return budget

    async def _release_lease(self) -> None:
        try:
            await self._lease.release()
        except Exception:
            logger.exception("Failed to release session evaluation sweep lease")
