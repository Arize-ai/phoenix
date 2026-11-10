"""The work-unit table of each evaluation target."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Union

import sqlalchemy as sa
from sqlalchemy.orm import InstrumentedAttribute

from phoenix.db import models
from phoenix.db.eval_work import (
    SWEPT_TARGET_TERMINAL_STATUSES,
    TERMINAL_STATUSES,
)

WorkUnitModel = Union[
    type[models.EvalWorkUnit],
    type[models.EvalTraceWorkUnit],
    type[models.EvalSessionWorkUnit],
]
TargetModel = Union[type[models.Span], type[models.Trace], type[models.ProjectSession]]


@dataclass(frozen=True)
class WorkTable:
    work_unit_model: WorkUnitModel
    target_model: TargetModel
    target_column: InstrumentedAttribute[int]
    terminal_statuses: tuple[str, ...]


WORK_TABLES: dict[models.EvaluationTarget, WorkTable] = {
    "SPAN": WorkTable(
        work_unit_model=models.EvalWorkUnit,
        target_model=models.Span,
        target_column=models.EvalWorkUnit.span_rowid,
        terminal_statuses=TERMINAL_STATUSES,
    ),
    "TRACE": WorkTable(
        work_unit_model=models.EvalTraceWorkUnit,
        target_model=models.Trace,
        target_column=models.EvalTraceWorkUnit.trace_rowid,
        terminal_statuses=SWEPT_TARGET_TERMINAL_STATUSES,
    ),
    "SESSION": WorkTable(
        work_unit_model=models.EvalSessionWorkUnit,
        target_model=models.ProjectSession,
        target_column=models.EvalSessionWorkUnit.project_session_rowid,
        terminal_statuses=SWEPT_TARGET_TERMINAL_STATUSES,
    ),
}


def status_in(model: Any, statuses: tuple[str, ...]) -> sa.ColumnElement[bool]:
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
