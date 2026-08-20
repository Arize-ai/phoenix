"""Store evaluation demand as commutative counters for each (session, project_evaluators) pair. Every
write to a request row goes through this module, except the content-incomplete transition
that `phoenix.db.helpers.mark_session_content_incomplete` does itself."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import Select, and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict


class RequestRejection(Enum):
    """Why an evaluation could not be requested."""

    CRITERIA_NOT_FOUND = "project_evaluator_not_found"
    CRITERIA_TARGET_MISMATCH = "project_evaluator_target_mismatch"
    SESSION_NOT_FOUND = "session_not_found"
    PROJECT_MISMATCH = "project_mismatch"
    SESSION_CONTENT_INCOMPLETE = "session_content_incomplete"
    SESSION_CONTENT_IDENTITY_MISSING = "session_content_identity_missing"


class EvaluationRequestRejected(Exception):
    """Raised by `request_evaluation` when the pair cannot be requested."""

    def __init__(self, rejection: RequestRejection) -> None:
        super().__init__(rejection.value)
        self.rejection = rejection


class EvaluationRequestVanished(Exception):
    """Raised when an acknowledgment finds no request row to update."""

    def __init__(self, evaluation_request_id: int) -> None:
        super().__init__(f"evaluation request {evaluation_request_id} no longer exists")
        self.evaluation_request_id = evaluation_request_id


@dataclass(frozen=True)
class SessionTarget:
    """The session an evaluation is requested for."""

    project_session_rowid: int


@dataclass(frozen=True)
class EvaluationAsk:
    """One ask that a pair be evaluated, from one matched annotation or one explicit call."""

    target: SessionTarget
    project_evaluator_id: int
    force: bool = False


@dataclass(frozen=True)
class RequestedEvaluation:
    """A request row as it stands after the call that wrote it."""

    evaluation_request_id: int
    project_session_rowid: int
    project_evaluator_id: int
    requested_generation: int


@dataclass(frozen=True)
class RejectedAsk:
    ask: EvaluationAsk
    rejection: RequestRejection


@dataclass(frozen=True)
class BatchRequestOutcome:
    granted: tuple[RequestedEvaluation, ...]
    rejected: tuple[RejectedAsk, ...]


@dataclass(frozen=True)
class PendingRequest:
    """An unfulfilled pair, carrying the generation one read observed."""

    evaluation_request_id: int
    project_session_rowid: int
    project_evaluator_id: int
    observed_generation: int
    forced: bool


async def request_evaluation(
    session: AsyncSession,
    target: SessionTarget,
    project_evaluator_id: int,
    *,
    force: bool = False,
) -> RequestedEvaluation:
    """Ask that `target` be evaluated against `project_evaluator_id`, advancing its generation once."""
    ask = EvaluationAsk(target=target, project_evaluator_id=project_evaluator_id, force=force)
    outcome = await request_evaluations(session, (ask,))
    if outcome.rejected:
        raise EvaluationRequestRejected(outcome.rejected[0].rejection)
    return outcome.granted[0]


async def request_evaluations(
    session: AsyncSession,
    asks: Iterable[EvaluationAsk],
) -> BatchRequestOutcome:
    """Record a batch of asks, one generation per ask, and report what each one did."""
    asks = tuple(asks)
    if not asks:
        return BatchRequestOutcome((), ())

    dialect = SupportedSQLDialect(session.bind.dialect.name)
    project_evaluators = await _read_project_evaluators(session, {ask.project_evaluator_id for ask in asks}, dialect)
    sessions = await _read_sessions(
        session, {ask.target.project_session_rowid for ask in asks}, dialect
    )

    granted_asks: list[EvaluationAsk] = []
    rejected_asks: list[RejectedAsk] = []
    for ask in asks:
        if (rejection := _rejection_for(ask, project_evaluators, sessions)) is None:
            granted_asks.append(ask)
        else:
            rejected_asks.append(RejectedAsk(ask, rejection))
    if not granted_asks:
        return BatchRequestOutcome((), tuple(rejected_asks))

    granted = await _upsert(session, _coalesce(granted_asks), dialect)
    return BatchRequestOutcome(granted, tuple(rejected_asks))


def is_unfulfilled(request: Any) -> ColumnElement[bool]:
    """Whether this request row is still waiting to be answered."""
    unfulfilled: ColumnElement[bool] = (
        request.materialized_generation < request.requested_generation
    )
    return unfulfilled


def unfulfilled_requests() -> Select[Any]:
    """The pairs whose asks have not been answered, with the generations to acknowledge.
    The read takes no row lock, so acknowledgment must carry `observed_generation`."""
    return select(
        models.EvaluationRequest.id.label("evaluation_request_id"),
        models.EvaluationRequest.project_session_rowid,
        models.EvaluationRequest.project_evaluator_id,
        models.EvaluationRequest.requested_generation.label("observed_generation"),
        models.EvaluationRequest.force_requested.label("forced"),
    ).where(is_unfulfilled(models.EvaluationRequest))


async def select_pending_requests(
    session: AsyncSession,
    *,
    project_evaluator_ids: Optional[Iterable[int]] = None,
    project_session_rowids: Optional[Iterable[int]] = None,
) -> tuple[PendingRequest, ...]:
    """Read the unfulfilled pairs, optionally narrowed to some project_evaluators or sessions."""
    stmt = unfulfilled_requests()
    if project_evaluator_ids is not None:
        stmt = stmt.where(models.EvaluationRequest.project_evaluator_id.in_(tuple(project_evaluator_ids)))
    if project_session_rowids is not None:
        stmt = stmt.where(
            models.EvaluationRequest.project_session_rowid.in_(tuple(project_session_rowids))
        )
    rows = await session.execute(stmt.order_by(models.EvaluationRequest.id))
    return tuple(
        PendingRequest(
            evaluation_request_id=row.evaluation_request_id,
            project_session_rowid=row.project_session_rowid,
            project_evaluator_id=row.project_evaluator_id,
            observed_generation=row.observed_generation,
            forced=bool(row.forced),
        )
        for row in rows
    )


async def acknowledge_materialization(
    session: AsyncSession,
    *,
    evaluation_request_id: int,
    observed_generation: int,
    session_work_unit_id: int,
) -> None:
    """Record that `session_work_unit_id` answers this request through `observed_generation`.
    Call this in the transaction that inserts the work unit, passing the generation the
    eligibility read observed; if it raises, that work insert must not commit either. The
    force flag survives only when a later ask has already raced in."""
    result = await session.execute(
        update(models.EvaluationRequest)
        .where(models.EvaluationRequest.id == evaluation_request_id)
        .values(
            materialized_generation=observed_generation,
            materialized_by_session_work_unit_id=session_work_unit_id,
            force_requested=and_(
                models.EvaluationRequest.force_requested,
                models.EvaluationRequest.requested_generation > observed_generation,
            ),
        )
    )
    if result.rowcount != 1:  # type: ignore[attr-defined]
        raise EvaluationRequestVanished(evaluation_request_id)


@dataclass(frozen=True)
class _ProjectEvaluatorFacts:
    project_id: int
    evaluation_target: str


@dataclass(frozen=True)
class _SessionFacts:
    project_id: int
    content_complete: bool
    last_span_ingested_at: Optional[datetime]


@dataclass(frozen=True)
class _PairAsk:
    project_session_rowid: int
    project_evaluator_id: int
    count: int
    force: bool


async def _read_project_evaluators(
    session: AsyncSession,
    project_evaluator_ids: Iterable[int],
    dialect: SupportedSQLDialect,
) -> dict[int, _ProjectEvaluatorFacts]:
    stmt = (
        select(
            models.ProjectEvaluator.id,
            models.ProjectEvaluator.project_id,
            models.ProjectEvaluator.evaluation_target,
        )
        .where(models.ProjectEvaluator.id.in_(sorted(project_evaluator_ids)))
        .order_by(models.ProjectEvaluator.id)
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        # Project evaluators before sessions, the lock order every writer against these tables takes.
        stmt = stmt.with_for_update(read=True, key_share=True)
    return {
        row.id: _ProjectEvaluatorFacts(
            project_id=row.project_id,
            evaluation_target=row.evaluation_target,
        )
        for row in await session.execute(stmt)
    }


async def _read_sessions(
    session: AsyncSession,
    project_session_rowids: Iterable[int],
    dialect: SupportedSQLDialect,
) -> dict[int, _SessionFacts]:
    stmt = (
        select(
            models.ProjectSession.id,
            models.ProjectSession.project_id,
            models.ProjectSession.content_complete,
            models.ProjectSession.last_span_ingested_at,
        )
        .where(models.ProjectSession.id.in_(sorted(project_session_rowids)))
        .order_by(models.ProjectSession.id)
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        # Held against the content-incomplete transition, which locks the same rows.
        stmt = stmt.with_for_update(key_share=True)
    return {
        row.id: _SessionFacts(
            project_id=row.project_id,
            content_complete=row.content_complete,
            last_span_ingested_at=row.last_span_ingested_at,
        )
        for row in await session.execute(stmt)
    }


def _rejection_for(
    ask: EvaluationAsk,
    project_evaluators: dict[int, _ProjectEvaluatorFacts],
    sessions: dict[int, _SessionFacts],
) -> Optional[RequestRejection]:
    if (project_evaluator := project_evaluators.get(ask.project_evaluator_id)) is None:
        return RequestRejection.CRITERIA_NOT_FOUND
    if project_evaluator.evaluation_target != "SESSION":
        return RequestRejection.CRITERIA_TARGET_MISMATCH
    if (target := sessions.get(ask.target.project_session_rowid)) is None:
        return RequestRejection.SESSION_NOT_FOUND
    if target.project_id != project_evaluator.project_id:
        return RequestRejection.PROJECT_MISMATCH
    if not target.content_complete:
        return RequestRejection.SESSION_CONTENT_INCOMPLETE
    if target.last_span_ingested_at is None:
        return RequestRejection.SESSION_CONTENT_IDENTITY_MISSING
    return None


def _coalesce(asks: Sequence[EvaluationAsk]) -> tuple[_PairAsk, ...]:
    counts: dict[tuple[int, int], _PairAsk] = {}
    for ask in asks:
        key = (ask.target.project_session_rowid, ask.project_evaluator_id)
        if (pair := counts.get(key)) is None:
            counts[key] = _PairAsk(
                project_session_rowid=key[0],
                project_evaluator_id=key[1],
                count=1,
                force=ask.force,
            )
        else:
            counts[key] = _PairAsk(
                project_session_rowid=key[0],
                project_evaluator_id=key[1],
                count=pair.count + 1,
                force=pair.force or ask.force,
            )
    # Sorted so that batches contending for the same pairs take their row locks in one
    # order.
    return tuple(
        sorted(counts.values(), key=lambda pair: (pair.project_session_rowid, pair.project_evaluator_id))
    )


async def _upsert(
    session: AsyncSession,
    pairs: Sequence[_PairAsk],
    dialect: SupportedSQLDialect,
) -> tuple[RequestedEvaluation, ...]:
    records = [
        {
            "project_session_rowid": pair.project_session_rowid,
            "project_evaluator_id": pair.project_evaluator_id,
            "requested_generation": pair.count,
            "materialized_generation": 0,
            "force_requested": pair.force,
            "requested_at": func.now(),
        }
        for pair in pairs
    ]
    stmt = insert_on_conflict(
        *records,
        table=models.EvaluationRequest,
        dialect=dialect,
        unique_by=("project_session_rowid", "project_evaluator_id"),
        on_conflict=OnConflict.DO_UPDATE,
        set_=_upsert_set(dialect),
    ).returning(
        models.EvaluationRequest.id,
        models.EvaluationRequest.project_session_rowid,
        models.EvaluationRequest.project_evaluator_id,
        models.EvaluationRequest.requested_generation,
    )
    rows = await session.execute(stmt)
    return tuple(
        RequestedEvaluation(
            evaluation_request_id=row.id,
            project_session_rowid=row.project_session_rowid,
            project_evaluator_id=row.project_evaluator_id,
            requested_generation=row.requested_generation,
        )
        for row in rows
    )


def _upsert_set(dialect: SupportedSQLDialect) -> dict[str, Any]:
    """The conflict update: generation arithmetic in SQL, so concurrent asks all land."""
    insert = insert_postgresql if dialect is SupportedSQLDialect.POSTGRESQL else insert_sqlite
    excluded = insert(models.EvaluationRequest).excluded
    return {
        "requested_generation": (
            models.EvaluationRequest.requested_generation + excluded.requested_generation
        ),
        "force_requested": or_(
            models.EvaluationRequest.force_requested, excluded.force_requested
        ),
        "requested_at": excluded.requested_at,
        "updated_at": func.now(),
    }

