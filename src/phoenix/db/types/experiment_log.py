"""
Pydantic models for the experiment_logs.detail JSON column.

Job identifiers (dataset_example_id, experiment_run_id, etc.) are now
proper DB columns on the polymorphic subtables, so the detail payload
only contains error/diagnostic metadata.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import ConfigDict, Field

from phoenix.db.types.db_helper_types import DBBaseModel


class FailureDetail(DBBaseModel):
    """Detail for a non-retryable failure."""

    model_config = ConfigDict(frozen=True)

    type: Literal["failure"]
    error_type: str
    stack_trace: str | None = None


class RetriesExhaustedDetail(DBBaseModel):
    """Detail for a job that exhausted all retries."""

    model_config = ConfigDict(frozen=True)

    type: Literal["retries_exhausted"]
    retry_count: int
    reason: str
    stack_trace: str | None = None


ExperimentLogDetail = Annotated[
    Union[FailureDetail, RetriesExhaustedDetail],
    Field(discriminator="type"),
]
