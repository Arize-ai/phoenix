"""How far a requested session evaluation has got, per (session, project evaluator) pair."""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Iterable, Optional

import sqlalchemy as sa
from sqlalchemy.orm import aliased
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.dataloaders.project_evaluator_run_counts import failed_work
from phoenix.server.online_eval.derivation import STALE_FINGERPRINT_ERROR
from phoenix.server.types import DbSessionFactory

ProjectSessionRowId: TypeAlias = int
ProjectEvaluatorId: TypeAlias = int
Key: TypeAlias = tuple[ProjectSessionRowId, ProjectEvaluatorId]


class EvaluationRequestState(Enum):
    """Where a requested evaluation has reached."""

    REQUESTED = "REQUESTED"
    QUEUED = "QUEUED"
    EVALUATED = "EVALUATED"
    FAILED = "FAILED"


class EvaluationRequestBlockingReason(Enum):
    """Why a requested evaluation has not started yet."""

    SESSION_ACTIVE = "SESSION_ACTIVE"
    EVALUATION_IN_PROGRESS = "EVALUATION_IN_PROGRESS"
    EVALUATOR_NOT_SCHEDULABLE = "EVALUATOR_NOT_SCHEDULABLE"
    EVALUATOR_VERSION_UNRESOLVED = "EVALUATOR_VERSION_UNRESOLVED"
    SESSION_FILTER_NOT_MATCHED = "SESSION_FILTER_NOT_MATCHED"
    EVALUATION_CAPACITY_REACHED = "EVALUATION_CAPACITY_REACHED"


class EvaluationRequestFailureReason(Enum):
    """Why a requested evaluation will never produce a result."""

    EVALUATOR_CHANGED = "EVALUATOR_CHANGED"
    EVALUATOR_ERROR = "EVALUATOR_ERROR"
    NO_EVALUATION_RECORDED = "NO_EVALUATION_RECORDED"


@dataclass(frozen=True)
class SessionEvaluationRequest:
    id: int
    project_session_rowid: int
    criteria_id: int
    state: EvaluationRequestState
    failure_reason: Optional[EvaluationRequestFailureReason]
    requested_at: datetime


class EvaluationRequestsDataLoader(DataLoader[Key, Optional[SessionEvaluationRequest]]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Optional[SessionEvaluationRequest]]:
        pairs = list(set(keys))
        result: dict[Key, SessionEvaluationRequest] = {}
        async with self._db.read() as session:
            async for row in await session.stream(_stmt(pairs)):
                key = (row.project_session_rowid, row.criteria_id)
                state = _state(row.fulfilled, row.outcome)
                result[key] = SessionEvaluationRequest(
                    id=row.id,
                    project_session_rowid=row.project_session_rowid,
                    criteria_id=row.criteria_id,
                    state=state,
                    failure_reason=_failure_reason(state, row),
                    requested_at=row.requested_at,
                )
        return [result.get(key) for key in keys]


def _state(fulfilled: bool, outcome: Optional[str]) -> EvaluationRequestState:
    """The state the pair reports, in the one order the four cases must be tested."""
    if not fulfilled:
        return EvaluationRequestState.REQUESTED
    if outcome is None:
        return EvaluationRequestState.FAILED
    return EvaluationRequestState(outcome)


def _failure_reason(
    state: EvaluationRequestState,
    row: Any,
) -> Optional[EvaluationRequestFailureReason]:
    """Which of the three ways this ask ended without a result, in the order they rank."""
    if state is not EvaluationRequestState.FAILED:
        return None
    if row.work_unit_id is None:
        return EvaluationRequestFailureReason.NO_EVALUATION_RECORDED
    if row.work_status == "EXPIRED" and row.work_error == STALE_FINGERPRINT_ERROR:
        return EvaluationRequestFailureReason.EVALUATOR_CHANGED
    if row.gave_up:
        return EvaluationRequestFailureReason.EVALUATOR_ERROR
    return EvaluationRequestFailureReason.NO_EVALUATION_RECORDED


def _outcome(work: Any) -> sa.Case[Optional[str]]:
    """Bucket the work answering a request, mirroring the project-wide funnel, except that
    a configuration change counts as failure here and not in the evaluator health summary."""
    superseded_by_config_change = sa.and_(
        work.status == "EXPIRED",
        work.error == STALE_FINGERPRINT_ERROR,
    )
    return sa.case(
        (work.id.is_(None), sa.null()),
        (work.status == "DONE", EvaluationRequestState.EVALUATED.value),
        (
            sa.or_(failed_work(work), superseded_by_config_change),
            EvaluationRequestState.FAILED.value,
        ),
        (work.status.in_(("PENDING", "RUNNING", "ERROR")), EvaluationRequestState.QUEUED.value),
        else_=EvaluationRequestState.FAILED.value,
    )


def _stmt(pairs: list[Key]) -> sa.Select[Any]:
    work = aliased(models.EvalSessionWorkUnit)
    return (
        sa.select(
            models.EvaluationRequest.id,
            models.EvaluationRequest.project_session_rowid,
            models.EvaluationRequest.criteria_id,
            models.EvaluationRequest.requested_at,
            (
                models.EvaluationRequest.materialized_generation
                >= models.EvaluationRequest.requested_generation
            ).label("fulfilled"),
            _outcome(work).label("outcome"),
            work.id.label("work_unit_id"),
            work.status.label("work_status"),
            work.error.label("work_error"),
            failed_work(work).label("gave_up"),
        )
        .select_from(models.EvaluationRequest)
        .outerjoin(
            work,
            models.EvaluationRequest.materialized_by_session_work_unit_id == work.id,
        )
        .where(
            sa.tuple_(
                models.EvaluationRequest.project_session_rowid,
                models.EvaluationRequest.criteria_id,
            ).in_(pairs)
        )
    )
