"""
Pydantic models for the experiment_errors.detail JSON column.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import ConfigDict, Field

from phoenix.db.types.db_helper_types import DBBaseModel

# =============================================================================
# Job Identifier (which job failed)
# =============================================================================


class TaskJobId(DBBaseModel):
    """Identifies a task job that failed."""

    model_config = ConfigDict(frozen=True)

    type: Literal["task"]
    dataset_example_id: int
    repetition_number: int


class EvalJobId(DBBaseModel):
    """Identifies an eval job that failed."""

    model_config = ConfigDict(frozen=True)

    type: Literal["eval"]
    experiment_run_id: int
    dataset_evaluator_id: int


JobId = Annotated[
    Union[TaskJobId, EvalJobId],
    Field(discriminator="type"),
]


# =============================================================================
# Error Detail (what went wrong)
# =============================================================================


class PermanentFailureDetail(DBBaseModel):
    """Detail for a non-retryable task or eval failure."""

    model_config = ConfigDict(frozen=True)

    type: Literal["permanent_failure"]
    job: JobId
    error_type: str
    stack_trace: str | None = None


class RetriesExhaustedDetail(DBBaseModel):
    """Detail for a task or eval that exhausted all retries."""

    model_config = ConfigDict(frozen=True)

    type: Literal["retries_exhausted"]
    job: JobId
    retry_count: int
    reason: str
    stack_trace: str | None = None


ExperimentErrorDetail = Annotated[
    Union[PermanentFailureDetail, RetriesExhaustedDetail],
    Field(discriminator="type"),
]
