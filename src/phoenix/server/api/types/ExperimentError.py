from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Union

import strawberry
from strawberry import Private
from strawberry.relay import Node, NodeID
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types import experiment_log as log_types
from phoenix.server.api.context import Context
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.enum
class ExperimentErrorCategory(Enum):
    TASK = "TASK"
    EVAL = "EVAL"
    EXPERIMENT = "EXPERIMENT"


# =============================================================================
# Work Item Identifier (from DB columns on polymorphic subtables)
# =============================================================================


@strawberry.type
class TaskWorkItemId:
    dataset_example_id: int
    repetition_number: int

    @classmethod
    def from_orm(cls, row: models.ExperimentTaskLog) -> TaskWorkItemId:
        return cls(
            dataset_example_id=row.dataset_example_id,
            repetition_number=row.repetition_number,
        )


@strawberry.type
class EvalWorkItemId:
    experiment_run_id: int
    dataset_evaluator_id: int

    @classmethod
    def from_orm(cls, row: models.ExperimentEvalLog) -> EvalWorkItemId:
        return cls(
            experiment_run_id=row.experiment_run_id,
            dataset_evaluator_id=row.dataset_evaluator_id,
        )


ExperimentErrorWorkItemId = Annotated[
    Union[TaskWorkItemId, EvalWorkItemId],
    strawberry.union(name="ExperimentErrorWorkItemId"),
]


def _work_item_id_from_orm(row: models.ExperimentLog) -> ExperimentErrorWorkItemId | None:
    if isinstance(row, models.ExperimentTaskLog):
        return TaskWorkItemId.from_orm(row)
    if isinstance(row, models.ExperimentEvalLog):
        return EvalWorkItemId.from_orm(row)
    return None  # EXPERIMENT logs have no work item


def _is_admin(info: Info[Context, None]) -> bool:
    if not info.context.auth_enabled:
        return True
    return isinstance((user := info.context.user), PhoenixUser) and user.is_admin


# =============================================================================
# Error Detail (what went wrong)
# =============================================================================


@strawberry.type
class FailureDetail:
    work_item: ExperimentErrorWorkItemId | None
    error_type: str
    _stack_trace: Private[str | None] = None

    @strawberry.field
    def stack_trace(self, info: Info[Context, None]) -> str | None:
        return self._stack_trace if _is_admin(info) else None

    @classmethod
    def from_orm(
        cls,
        obj: log_types.FailureDetail,
        row: models.ExperimentLog,
    ) -> FailureDetail:
        return cls(
            work_item=_work_item_id_from_orm(row),
            error_type=obj.error_type,
            _stack_trace=obj.stack_trace,
        )


@strawberry.type
class RetriesExhaustedDetail:
    work_item: ExperimentErrorWorkItemId | None
    retry_count: int
    reason: str
    _stack_trace: Private[str | None] = None

    @strawberry.field
    def stack_trace(self, info: Info[Context, None]) -> str | None:
        return self._stack_trace if _is_admin(info) else None

    @classmethod
    def from_orm(
        cls,
        obj: log_types.RetriesExhaustedDetail,
        row: models.ExperimentLog,
    ) -> RetriesExhaustedDetail:
        return cls(
            work_item=_work_item_id_from_orm(row),
            retry_count=obj.retry_count,
            reason=obj.reason,
            _stack_trace=obj.stack_trace,
        )


ExperimentErrorDetail = Annotated[
    Union[FailureDetail, RetriesExhaustedDetail],
    strawberry.union(name="ExperimentErrorDetail"),
]


def _detail_from_orm(
    obj: log_types.ExperimentLogDetail, row: models.ExperimentLog
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
    def from_orm(cls, row: models.ExperimentLog) -> ExperimentError:
        return cls(
            id=row.id,
            occurred_at=row.occurred_at,
            category=ExperimentErrorCategory(row.category),
            message=row.message,
            detail=_detail_from_orm(row.detail, row) if row.detail else None,
        )
