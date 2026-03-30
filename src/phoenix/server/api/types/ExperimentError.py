from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Union

import strawberry
from strawberry.relay import Node, NodeID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types import experiment_event as event_types


@strawberry.enum
class ExperimentErrorCategory(Enum):
    TASK = "TASK"
    EVAL = "EVAL"
    SYSTEM = "SYSTEM"


# =============================================================================
# Job Identifier (from DB columns on polymorphic subtables)
# =============================================================================


@strawberry.type
class TaskJobId:
    dataset_example_id: int
    repetition_number: int

    @classmethod
    def from_orm(cls, row: models.ExperimentTaskEvent) -> TaskJobId:
        return cls(
            dataset_example_id=row.dataset_example_id,
            repetition_number=row.repetition_number,
        )


@strawberry.type
class EvalJobId:
    experiment_run_id: int
    dataset_evaluator_id: int

    @classmethod
    def from_orm(cls, row: models.ExperimentEvalEvent) -> EvalJobId:
        return cls(
            experiment_run_id=row.experiment_run_id,
            dataset_evaluator_id=row.dataset_evaluator_id,
        )


ExperimentErrorJobId = Annotated[
    Union[TaskJobId, EvalJobId],
    strawberry.union(name="ExperimentErrorJobId"),
]


def _job_id_from_orm(row: models.ExperimentEvent) -> ExperimentErrorJobId | None:
    if isinstance(row, models.ExperimentTaskEvent):
        return TaskJobId.from_orm(row)
    if isinstance(row, models.ExperimentEvalEvent):
        return EvalJobId.from_orm(row)
    return None  # SYSTEM events have no job


# =============================================================================
# Error Detail (what went wrong)
# =============================================================================


@strawberry.type
class FailureDetail:
    job: ExperimentErrorJobId | None
    error_type: str
    stack_trace: str | None = None

    @classmethod
    def from_orm(
        cls,
        obj: event_types.FailureDetail,
        row: models.ExperimentEvent,
    ) -> FailureDetail:
        return cls(
            job=_job_id_from_orm(row),
            error_type=obj.error_type,
            stack_trace=obj.stack_trace,
        )


@strawberry.type
class RetriesExhaustedDetail:
    job: ExperimentErrorJobId | None
    retry_count: int
    reason: str
    stack_trace: str | None = None

    @classmethod
    def from_orm(
        cls,
        obj: event_types.RetriesExhaustedDetail,
        row: models.ExperimentEvent,
    ) -> RetriesExhaustedDetail:
        return cls(
            job=_job_id_from_orm(row),
            retry_count=obj.retry_count,
            reason=obj.reason,
            stack_trace=obj.stack_trace,
        )


ExperimentErrorDetail = Annotated[
    Union[FailureDetail, RetriesExhaustedDetail],
    strawberry.union(name="ExperimentErrorDetail"),
]


def _detail_from_orm(
    obj: event_types.ExperimentEventDetail, row: models.ExperimentEvent
) -> ExperimentErrorDetail:
    if obj.type == "failure":
        return FailureDetail.from_orm(obj, row)
    if obj.type == "retries_exhausted":
        return RetriesExhaustedDetail.from_orm(obj, row)
    assert_never(obj)


@strawberry.type
class ExperimentError(Node):
    id: NodeID[int]
    occurred_at: datetime
    category: ExperimentErrorCategory
    message: str
    detail: ExperimentErrorDetail | None = None

    @classmethod
    def from_orm(cls, row: models.ExperimentEvent) -> ExperimentError:
        return cls(
            id=row.id,
            occurred_at=row.occurred_at,
            category=ExperimentErrorCategory(row.category),
            message=row.message,
            detail=_detail_from_orm(row.detail, row) if row.detail else None,
        )
