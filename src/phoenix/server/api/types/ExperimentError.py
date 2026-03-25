from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Union

import strawberry
from strawberry.relay import Node, NodeID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types import experiment_error as error_types


@strawberry.enum
class ExperimentErrorCategory(Enum):
    TASK = "TASK"
    EVAL = "EVAL"
    SYSTEM = "SYSTEM"


# =============================================================================
# Job Identifier (which job failed)
# =============================================================================


@strawberry.type
class TaskJobId:
    dataset_example_id: int
    repetition_number: int

    @classmethod
    def from_orm(cls, obj: error_types.TaskJobId) -> TaskJobId:
        return cls(
            dataset_example_id=obj.dataset_example_id,
            repetition_number=obj.repetition_number,
        )


@strawberry.type
class EvalJobId:
    experiment_run_id: int
    dataset_evaluator_id: int

    @classmethod
    def from_orm(cls, obj: error_types.EvalJobId) -> EvalJobId:
        return cls(
            experiment_run_id=obj.experiment_run_id, dataset_evaluator_id=obj.dataset_evaluator_id
        )


ExperimentErrorJobId = Annotated[
    Union[TaskJobId, EvalJobId],
    strawberry.union(name="ExperimentErrorJobId"),
]


def _job_id_from_orm(obj: error_types.JobId) -> ExperimentErrorJobId:
    if obj.type == "task":
        return TaskJobId.from_orm(obj)
    if obj.type == "eval":
        return EvalJobId.from_orm(obj)
    assert_never(obj)


# =============================================================================
# Error Detail (what went wrong)
# =============================================================================


@strawberry.type
class PermanentFailureDetail:
    job: ExperimentErrorJobId
    error_type: str
    stack_trace: str | None = None

    @classmethod
    def from_orm(cls, obj: error_types.PermanentFailureDetail) -> PermanentFailureDetail:
        return cls(
            job=_job_id_from_orm(obj.job),
            error_type=obj.error_type,
            stack_trace=obj.stack_trace,
        )


@strawberry.type
class RetriesExhaustedDetail:
    job: ExperimentErrorJobId
    retry_count: int
    reason: str
    stack_trace: str | None = None

    @classmethod
    def from_orm(cls, obj: error_types.RetriesExhaustedDetail) -> RetriesExhaustedDetail:
        return cls(
            job=_job_id_from_orm(obj.job),
            retry_count=obj.retry_count,
            reason=obj.reason,
            stack_trace=obj.stack_trace,
        )


ExperimentErrorDetail = Annotated[
    Union[PermanentFailureDetail, RetriesExhaustedDetail],
    strawberry.union(name="ExperimentErrorDetail"),
]


def _detail_from_orm(obj: error_types.ExperimentErrorDetail) -> ExperimentErrorDetail:
    if obj.type == "permanent_failure":
        return PermanentFailureDetail.from_orm(obj)
    if obj.type == "retries_exhausted":
        return RetriesExhaustedDetail.from_orm(obj)
    assert_never(obj)


@strawberry.type
class ExperimentError(Node):
    id: NodeID[int]
    occurred_at: datetime
    category: ExperimentErrorCategory
    message: str
    detail: ExperimentErrorDetail | None = None

    @classmethod
    def from_orm(cls, row: models.ExperimentError) -> ExperimentError:
        return cls(
            id=row.id,
            occurred_at=row.occurred_at,
            category=ExperimentErrorCategory(row.category),
            message=row.message,
            detail=_detail_from_orm(row.detail) if row.detail else None,
        )
