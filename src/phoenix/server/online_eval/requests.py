"""Reads and writes for `evaluation_requests`, the standing ask for a (session, project_evaluators) pair.

Every write to a request row goes through this module: creation, generation advancement,
and the acknowledgment that links a request to the work unit answering it. The one
exception is stand-down, which `phoenix.db.helpers.mark_session_content_incomplete` does
itself because deletion runs below the server layer.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import Select, case, func, select, update
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
    """One ask that a pair be evaluated, from one signal occurrence or one explicit call."""

    target: SessionTarget
    project_evaluator_id: int
    requested_by: Optional[str] = None
    force: bool = False


@dataclass(frozen=True)
class RequestedEvaluation:
    """A request row as it stands after the call that wrote it."""

    evaluation_request_id: int
    project_session_rowid: int
    project_evaluator_id: int
    requested_generation: int
    force_requested_generation: int


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
    """An unfulfilled pair, carrying the generations one read observed."""

    evaluation_request_id: int
    project_session_rowid: int
    project_evaluator_id: int
    observed_generation: int
    materialized_generation: int
    forced: bool


async def request_evaluation(
    session: AsyncSession,
    target: SessionTarget,
    project_evaluator_id: int,
    *,
    requested_by: Optional[str] = None,
    force: bool = False,
) -> RequestedEvaluation:
    """Ask that `target` be evaluated against `project_evaluator_id`, advancing its generation once.

    A forced request also raises the sticky force boundary, which no later request lowers.

    Raises:
        EvaluationRequestRejected: the pair cannot be requested; the rejection says why.
    """
    ask = EvaluationAsk(
        target=target,
        project_evaluator_id=project_evaluator_id,
        requested_by=requested_by,
        force=force,
    )
    outcome = await request_evaluations(session, (ask,))
    if outcome.rejected:
        raise EvaluationRequestRejected(outcome.rejected[0].rejection)
    return outcome.granted[0]


async def request_evaluations(
    session: AsyncSession,
    asks: Iterable[EvaluationAsk],
) -> BatchRequestOutcome:
    """Record a batch of asks, one generation per ask, and report what each one did.

    Asks are counted per pair before the statement is built. Passing them through as
    separate records would not work: `insert_on_conflict` collapses records sharing a
    unique key down to the last one, so N asks for a pair would advance one generation.
    """
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


def unfulfilled_requests() -> Select[Any]:
    """The pairs whose asks have not been answered, with the generations to acknowledge.

    The read takes no row lock, so a request committed after it is not observed here —
    which is why acknowledgment must carry `observed_generation` rather than re-read.
    """
    forced = (
        models.EvaluationRequest.force_requested_generation
        > models.EvaluationRequest.materialized_generation
    )
    return select(
        models.EvaluationRequest.id.label("evaluation_request_id"),
        models.EvaluationRequest.project_session_rowid,
        models.EvaluationRequest.project_evaluator_id,
        models.EvaluationRequest.requested_generation.label("observed_generation"),
        models.EvaluationRequest.materialized_generation,
        forced.label("forced"),
    ).where(
        models.EvaluationRequest.materialized_generation
        < models.EvaluationRequest.requested_generation
    )


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
            materialized_generation=row.materialized_generation,
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

    Call this in the transaction that inserts the work unit, and pass the generation the
    eligibility read observed — never a fresh one. An ask that arrived since that read is
    a later generation, and writing it here would drop it.

    Raises:
        EvaluationRequestVanished: the request is gone, so the work insert sharing this
            transaction must not commit either.
    """
    result = await session.execute(
        update(models.EvaluationRequest)
        .where(models.EvaluationRequest.id == evaluation_request_id)
        .values(
            materialized_generation=observed_generation,
            materialized_by_session_work_unit_id=session_work_unit_id,
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
    requested_by: Optional[str]


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
        # The same lock the request insert's foreign key takes, taken first: project_evaluators
        # before sessions is the order every writer against these tables uses.
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
        # Held against stand-down, which locks the same rows: without it a request could
        # be written after a session lost content and then never be answered or closed.
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
                requested_by=ask.requested_by,
            )
        else:
            counts[key] = _PairAsk(
                project_session_rowid=key[0],
                project_evaluator_id=key[1],
                count=pair.count + 1,
                force=pair.force or ask.force,
                requested_by=ask.requested_by or pair.requested_by,
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
            "force_requested_generation": pair.count if pair.force else 0,
            "requested_at": func.now(),
            "requested_by": pair.requested_by,
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
        models.EvaluationRequest.force_requested_generation,
    )
    rows = await session.execute(stmt)
    return tuple(
        RequestedEvaluation(
            evaluation_request_id=row.id,
            project_session_rowid=row.project_session_rowid,
            project_evaluator_id=row.project_evaluator_id,
            requested_generation=row.requested_generation,
            force_requested_generation=row.force_requested_generation,
        )
        for row in rows
    )


def _upsert_set(dialect: SupportedSQLDialect) -> dict[str, Any]:
    """The conflict update: generation arithmetic in SQL, so concurrent asks all land.

    The incoming row carries its own increment in `requested_generation`, which is what
    lets one statement advance several pairs by different amounts.
    """
    insert = insert_postgresql if dialect is SupportedSQLDialect.POSTGRESQL else insert_sqlite
    excluded = insert(models.EvaluationRequest).excluded
    requested_generation = (
        models.EvaluationRequest.requested_generation + excluded.requested_generation
    )
    force_requested_generation = case(
        (
            excluded.force_requested_generation > 0,
            _greatest(
                dialect,
                models.EvaluationRequest.force_requested_generation,
                requested_generation,
            ),
        ),
        else_=models.EvaluationRequest.force_requested_generation,
    )
    return {
        "requested_generation": requested_generation,
        "force_requested_generation": force_requested_generation,
        "requested_at": excluded.requested_at,
        "requested_by": excluded.requested_by,
        "updated_at": func.now(),
    }


def _greatest(dialect: SupportedSQLDialect, left: Any, right: Any) -> ColumnElement[Any]:
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return func.greatest(left, right)
    return func.max(left, right)

