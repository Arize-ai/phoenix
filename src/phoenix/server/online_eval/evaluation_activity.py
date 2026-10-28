"""What online evaluation did over a time range: how long each evaluation waited for its
result. Every read is bounded by the time range.

An evaluation's lag is from when it was queued, its work row's ``created_at``, to its result,
the ``updated_at`` of the row's last transition. Work rows are not written once they reach an
outcome, except that a trace or session evaluation that ended without a result is offered
again when its trace or session has newer spans: the row returns to the queue with a new
``created_at``, and the earlier offer leaves no record. Rows are deleted with their span,
trace, session, or project evaluator, and finished span work is deleted once it is older than
the online evaluation retention period, so a range reaching past it counts less than it covers.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional, Sequence, Union

import sqlalchemy as sa
from sqlalchemy.sql.functions import percentile_cont
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.eval_work import (
    COMPLETED_EVAL_WORK_STATUSES,
    TERMINAL_EVAL_SESSION_WORK_STATUSES,
    TERMINAL_EVAL_WORK_STATUSES,
)
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.models import LatencyMs
from phoenix.server.types import DbSessionFactory

_WorkUnitModel: TypeAlias = Union[
    type[models.EvalWorkUnit],
    type[models.EvalTraceWorkUnit],
    type[models.EvalSessionWorkUnit],
]
_WORK_TABLES: tuple[tuple[_WorkUnitModel, tuple[str, ...]], ...] = (
    (models.EvalWorkUnit, TERMINAL_EVAL_WORK_STATUSES),
    (models.EvalTraceWorkUnit, TERMINAL_EVAL_SESSION_WORK_STATUSES),
    (models.EvalSessionWorkUnit, TERMINAL_EVAL_SESSION_WORK_STATUSES),
)
_ProjectEvaluatorIds: TypeAlias = Union[Sequence[int], sa.Select[Any]]


@dataclass(frozen=True)
class EvaluationLag:
    """Percentiles of the seconds from queued to result."""

    p50_seconds: float
    p95_seconds: float
    p99_seconds: float


async def load_evaluation_lags(
    db: DbSessionFactory,
    project_evaluator_ids: Sequence[int],
    start: datetime,
    end: datetime,
) -> dict[int, EvaluationLag]:
    """The lag of each project evaluator's evaluations completed in ``[start, end)``;
    evaluators with none are absent."""
    completed = _completed(project_evaluator_ids, start, end)
    group = completed.c.project_evaluator_id
    stmt = sa.select(group, *_lag_percentiles(db.dialect, completed.c.lag_seconds)).group_by(group)
    async with db.read() as session:
        return {
            project_evaluator_id: lag
            for project_evaluator_id, *percentiles in await session.execute(stmt)
            if (lag := _lag(*percentiles)) is not None
        }


def _completed(
    project_evaluator_ids: _ProjectEvaluatorIds,
    start: datetime,
    end: datetime,
) -> sa.Subquery:
    """Evaluations that produced an annotation or were given up on in ``[start, end)``, each
    with its lag, read through each table's ``ix_*_terminal`` index on ``updated_at``.

    The evaluator is matched as an expression so neither dialect reads by an evaluator index
    instead. SQLite estimates an IN subquery as many evaluators and then scans the whole
    table rather than search ``ix_*_project_evaluator_done`` once per evaluator.
    """
    branches: list[sa.Select[*tuple[Any, ...]]] = []
    for model, terminal_statuses in _WORK_TABLES:
        branches.append(
            sa.select(
                model.project_evaluator_id.label("project_evaluator_id"),
                sa.case((model.status == "DONE", 1), else_=0).label("evaluated"),
                model.updated_at.label("completed_at"),
                (LatencyMs(model.created_at, model.updated_at) / 1000).label("lag_seconds"),
            ).where(
                _status_in(model, terminal_statuses),
                _status_in(model, COMPLETED_EVAL_WORK_STATUSES),
                _evaluator_in(model, project_evaluator_ids),
                model.updated_at >= start,
                model.updated_at < end,
            )
        )
    return sa.union_all(*branches).subquery("completed")


def _lag_percentiles(
    dialect: SupportedSQLDialect, lag_seconds: sa.ColumnElement[float]
) -> tuple[sa.ColumnElement[float], ...]:
    return tuple(_percentile(dialect, lag_seconds, fraction) for fraction in (0.5, 0.95, 0.99))


def _percentile(
    dialect: SupportedSQLDialect, value: sa.ColumnElement[float], fraction: float
) -> sa.ColumnElement[float]:
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return percentile_cont(fraction).within_group(value.asc())
    if dialect is SupportedSQLDialect.SQLITE:
        percentile: sa.ColumnElement[float] = sa.func.percentile(value, fraction * 100)
        return percentile
    assert_never(dialect)


def _lag(*percentiles: Optional[float]) -> Optional[EvaluationLag]:
    p50, p95, p99 = percentiles
    if p50 is None or p95 is None or p99 is None:
        return None
    return EvaluationLag(p50_seconds=p50, p95_seconds=p95, p99_seconds=p99)


def _evaluator_in(
    model: Any, project_evaluator_ids: _ProjectEvaluatorIds
) -> sa.ColumnElement[bool]:
    condition: sa.ColumnElement[bool] = (model.project_evaluator_id + sa.literal_column("0")).in_(
        project_evaluator_ids
    )
    return condition


def _status_in(model: Any, statuses: tuple[str, ...]) -> sa.ColumnElement[bool]:
    """Statuses render as literals so SQLite matches the work tables' partial indexes."""
    condition: sa.ColumnElement[bool] = model.status.in_(
        sa.bindparam(
            "statuses",
            list(statuses),
            expanding=True,
            literal_execute=True,
            unique=True,
        )
    )
    return condition
