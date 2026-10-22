from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Iterable, Optional, Union

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.eval_work import FAILED_EVAL_WORK_STATUSES
from phoenix.server.types import DbSessionFactory

ProjectEvaluatorId: TypeAlias = int

_WorkUnitModel: TypeAlias = Union[
    type[models.EvalWorkUnit],
    type[models.EvalSessionWorkUnit],
    type[models.EvalTraceWorkUnit],
]
_WORK_UNIT_MODELS: tuple[_WorkUnitModel, ...] = (
    models.EvalWorkUnit,
    models.EvalSessionWorkUnit,
    models.EvalTraceWorkUnit,
)
_Outcome: TypeAlias = Callable[[Any], sa.ColumnElement[bool]]


@dataclass(frozen=True)
class ProjectEvaluatorLatestOutcomes:
    """When a project evaluator last produced an annotation and last gave up on an evaluation,
    over the work rows that still exist."""

    last_evaluated_at: Optional[datetime] = None
    last_failed_at: Optional[datetime] = None


class ProjectEvaluatorLatestOutcomesDataLoader(
    DataLoader[ProjectEvaluatorId, ProjectEvaluatorLatestOutcomes]
):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(
        self, keys: Iterable[ProjectEvaluatorId]
    ) -> list[ProjectEvaluatorLatestOutcomes]:
        keys = list(keys)
        project_evaluator_ids = sorted(set(keys))
        async with self._db.read() as session:
            last_evaluated = await _load_newest(session, project_evaluator_ids, _evaluated)
            last_failed = await _load_newest(session, project_evaluator_ids, _failed)
        return [
            ProjectEvaluatorLatestOutcomes(
                last_evaluated_at=last_evaluated.get(key),
                last_failed_at=last_failed.get(key),
            )
            for key in keys
        ]


async def _load_newest(
    session: AsyncSession,
    project_evaluator_ids: list[ProjectEvaluatorId],
    outcome: _Outcome,
) -> dict[ProjectEvaluatorId, datetime]:
    newest: dict[ProjectEvaluatorId, datetime] = {}
    stmt = sa.select(
        models.ProjectEvaluator.id,
        *(_newest(model, outcome) for model in _WORK_UNIT_MODELS),
    ).where(models.ProjectEvaluator.id.in_(project_evaluator_ids))
    for project_evaluator_id, *times in await session.execute(stmt):
        latest = max(filter(None, times), default=None)
        if latest is not None:
            newest[project_evaluator_id] = latest
    return newest


def _newest(model: _WorkUnitModel, outcome: _Outcome) -> sa.ScalarSelect[Any]:
    """The evaluator's newest ``updated_at`` with this outcome, read from the top of its
    ``ix_*_project_evaluator_done`` or ``ix_*_project_evaluator_failed`` partial index.

    The lookup orders by the index's whole key and bounds the evaluator as a range, not an
    equality. Given an equality, PostgreSQL drops the evaluator from the ordering, and can
    then walk ``ix_*_terminal`` backward instead, filtering out every other evaluator's
    rows: for an evaluator with none, all of them. No other index has this order.
    """
    unit = aliased(model)
    return (
        sa.select(unit.updated_at)
        .where(
            unit.project_evaluator_id.between(
                models.ProjectEvaluator.id, models.ProjectEvaluator.id
            ),
            outcome(unit),
        )
        .order_by(unit.project_evaluator_id.desc(), unit.updated_at.desc())
        .limit(1)
        .correlate(models.ProjectEvaluator)
        .scalar_subquery()
    )


def _evaluated(model: Any) -> sa.ColumnElement[bool]:
    """Rendered as the literal ``status = 'DONE'``, which SQLite needs to match the partial
    index's predicate: it can't with a bound value, or with ``status IN ('DONE')``."""
    condition: sa.ColumnElement[bool] = model.status == sa.literal("DONE", literal_execute=True)
    return condition


def _failed(model: Any) -> sa.ColumnElement[bool]:
    """Rendered as literals so SQLite matches the partial index's predicate."""
    condition: sa.ColumnElement[bool] = model.status.in_(
        sa.bindparam(
            "failed_statuses",
            list(FAILED_EVAL_WORK_STATUSES),
            expanding=True,
            literal_execute=True,
            unique=True,
        )
    )
    return condition
