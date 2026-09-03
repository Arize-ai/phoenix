from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any, Iterable, Optional, Union

import sqlalchemy as sa
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.eval_work import LIVE_EVAL_WORK_STATUSES
from phoenix.server.types import DbSessionFactory

ProjectEvaluatorId: TypeAlias = int
Key: TypeAlias = ProjectEvaluatorId

_WorkUnitModel: TypeAlias = Union[type[models.EvalWorkUnit], type[models.EvalSessionWorkUnit]]

_QUEUED = "QUEUED"
_EVALUATED = "EVALUATED"
_FAILED = "FAILED"


@dataclass(frozen=True)
class ProjectEvaluatorRunCounts:
    """How much evaluation work a project evaluator has produced, and when.

    Counts cover both evaluation grains and reach back only as far as the online-eval
    retention window, after which completed work is reaped.
    """

    queued: int = 0
    evaluated: int = 0
    failed: int = 0
    last_evaluated_at: Optional[datetime] = None
    last_failed_at: Optional[datetime] = None
    last_error: Optional[str] = None


class ProjectEvaluatorRunCountsDataLoader(DataLoader[Key, ProjectEvaluatorRunCounts]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[ProjectEvaluatorRunCounts]:
        project_evaluator_ids = list(set(keys))
        result: dict[Key, ProjectEvaluatorRunCounts] = {}
        async with self._db.read() as session:
            async for project_evaluator_id, outcome, count, latest in await session.stream(
                _outcome_stmt(project_evaluator_ids)
            ):
                counts = result.setdefault(project_evaluator_id, ProjectEvaluatorRunCounts())
                if outcome == _EVALUATED:
                    counts = replace(counts, evaluated=count, last_evaluated_at=latest)
                elif outcome == _FAILED:
                    counts = replace(counts, failed=count, last_failed_at=latest)
                elif outcome == _QUEUED:
                    counts = replace(counts, queued=count)
                result[project_evaluator_id] = counts
            async for project_evaluator_id, error in await session.stream(
                _last_error_stmt(project_evaluator_ids)
            ):
                counts = result.setdefault(project_evaluator_id, ProjectEvaluatorRunCounts())
                result[project_evaluator_id] = replace(counts, last_error=error)
        empty = ProjectEvaluatorRunCounts()
        return [result.get(project_evaluator_id, empty) for project_evaluator_id in keys]


def _failed(model: _WorkUnitModel) -> sa.ColumnElement[bool]:
    """A unit that was given up on — the only units whose errors the user is owed.

    SUPERSEDED (the evaluator's configuration changed under it) and CONTENT_LOST (the
    session's traces were deleted first) are lifecycle events, not evaluation failures.
    """
    return model.status.in_(("FAILED", "EXPIRED"))


def _outcome(model: _WorkUnitModel) -> sa.Case[Optional[str]]:
    """Bucket a work unit into the funnel the user sees. SUPERSEDED and CONTENT_LOST
    fall outside every bucket, since no evaluation was ever owed for them."""
    return sa.case(
        (model.status == "DONE", _EVALUATED),
        (_failed(model), _FAILED),
        (model.status.in_(LIVE_EVAL_WORK_STATUSES), _QUEUED),
        else_=None,
    )


def _outcome_stmt(project_evaluator_ids: list[Key]) -> sa.Select[Any]:
    def grain(model: _WorkUnitModel) -> sa.Select[Any]:
        outcome = _outcome(model)
        return (
            sa.select(
                model.project_evaluator_id.label("project_evaluator_id"),
                outcome.label("outcome"),
                sa.func.count().label("count"),
                sa.func.max(model.updated_at).label("latest"),
            )
            .where(model.project_evaluator_id.in_(project_evaluator_ids))
            .group_by(model.project_evaluator_id, outcome)
        )

    grains = sa.union_all(grain(models.EvalWorkUnit), grain(models.EvalSessionWorkUnit)).subquery()
    return (
        sa.select(
            grains.c.project_evaluator_id,
            grains.c.outcome,
            sa.func.sum(grains.c.count),
            sa.func.max(grains.c.latest),
        )
        .where(grains.c.outcome.is_not(None))
        .group_by(grains.c.project_evaluator_id, grains.c.outcome)
    )


def _last_error_stmt(project_evaluator_ids: list[Key]) -> sa.Select[Any]:
    """The newest error among FAILED units only.

    A unit that errored transiently and later succeeded keeps its error string
    (claim and complete never clear it), so ranking every non-null error would
    surface a stale message under a healthy evaluator. Restricting to units the
    funnel counts as failed keeps ``lastError`` describing what ``status`` says —
    and bounds the ranked partition to given-up work.
    """

    def grain(model: _WorkUnitModel) -> sa.Select[Any]:
        return sa.select(
            model.project_evaluator_id.label("project_evaluator_id"),
            model.error.label("error"),
            model.updated_at.label("updated_at"),
        ).where(
            model.project_evaluator_id.in_(project_evaluator_ids),
            model.error.is_not(None),
            _failed(model),
        )

    grains = sa.union_all(grain(models.EvalWorkUnit), grain(models.EvalSessionWorkUnit)).subquery()
    ranked = sa.select(
        grains.c.project_evaluator_id,
        grains.c.error,
        sa.func.row_number()
        .over(partition_by=grains.c.project_evaluator_id, order_by=grains.c.updated_at.desc())
        .label("row_num"),
    ).subquery()
    return sa.select(ranked.c.project_evaluator_id, ranked.c.error).where(ranked.c.row_num == 1)
