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


@dataclass(frozen=True)
class SessionEvaluationRequest:
    id: int
    project_session_rowid: int
    project_evaluator_id: int
    state: EvaluationRequestState
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
                key = (row.project_session_rowid, row.project_evaluator_id)
                result[key] = SessionEvaluationRequest(
                    id=row.id,
                    project_session_rowid=row.project_session_rowid,
                    project_evaluator_id=row.project_evaluator_id,
                    state=_state(row.fulfilled, row.outcome),
                    requested_at=row.requested_at,
                )
        return [result.get(key) for key in keys]


def _state(fulfilled: bool, outcome: Optional[str]) -> EvaluationRequestState:
    """The state the pair reports, in the one order the four cases must be tested.

    Whether the ask has been answered is read first, so a newer ask outranks whatever
    outcome an older one left attached. An answered ask with nothing attached is a pair
    closed without an evaluation ever running — stand-down does this, and so does the
    link's ON DELETE SET NULL — which is a failure to evaluate, not a success.
    """
    if not fulfilled:
        return EvaluationRequestState.REQUESTED
    if outcome is None:
        return EvaluationRequestState.FAILED
    return EvaluationRequestState(outcome)


def _outcome(work: Any) -> sa.Case[Optional[str]]:
    """Bucket the work answering a request, mirroring the project-wide funnel.

    One deliberate difference: work retired because the evaluator's configuration
    changed under it is failure for the request that asked for it, though the
    evaluator's own health summary leaves it out. The request named a session and an
    evaluator, and no annotation will ever answer it.
    """
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
            models.EvaluationRequest.project_evaluator_id,
            models.EvaluationRequest.requested_at,
            (
                models.EvaluationRequest.materialized_generation
                >= models.EvaluationRequest.requested_generation
            ).label("fulfilled"),
            _outcome(work).label("outcome"),
        )
        .select_from(models.EvaluationRequest)
        .outerjoin(
            work,
            models.EvaluationRequest.materialized_by_session_work_unit_id == work.id,
        )
        .where(
            sa.tuple_(
                models.EvaluationRequest.project_session_rowid,
                models.EvaluationRequest.project_evaluator_id,
            ).in_(pairs)
        )
    )

