from collections.abc import Callable, Hashable, Iterable
from datetime import datetime
from enum import Enum
from typing import Any, Optional, TypeVar

import sqlalchemy as sa
from openinference.semconv.trace import (
    OpenInferenceSpanKindValues,
    RerankerAttributes,
    SpanAttributes,
)
from sqlalchemy import (
    Integer,
    Select,
    SQLColumnExpression,
    and_,
    case,
    distinct,
    func,
    select,
)
from sqlalchemy.orm import QueryableAttribute
from typing_extensions import assert_never

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.db import models


class SupportedSQLDialect(Enum):
    SQLITE = "sqlite"
    POSTGRESQL = "postgresql"

    @classmethod
    def _missing_(cls, v: Any) -> "SupportedSQLDialect":
        if isinstance(v, str) and v and v.isascii() and not v.islower():
            return cls(v.lower())
        raise ValueError(f"`{v}` is not a supported SQL backend/dialect.")


def num_docs_col(dialect: SupportedSQLDialect) -> SQLColumnExpression[Integer]:
    if dialect is SupportedSQLDialect.POSTGRESQL:
        array_length = func.jsonb_array_length
    elif dialect is SupportedSQLDialect.SQLITE:
        array_length = func.json_array_length
    else:
        assert_never(dialect)
    retrieval_docs = models.Span.attributes[_RETRIEVAL_DOCUMENTS]
    num_retrieval_docs = array_length(retrieval_docs)
    reranker_docs = models.Span.attributes[_RERANKER_OUTPUT_DOCUMENTS]
    num_reranker_docs = array_length(reranker_docs)
    return case(
        (
            func.upper(models.Span.span_kind) == OpenInferenceSpanKindValues.RERANKER.value.upper(),
            num_reranker_docs,
        ),
        else_=num_retrieval_docs,
    ).label("num_docs")


_RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS.split(".")
_RERANKER_OUTPUT_DOCUMENTS = RerankerAttributes.RERANKER_OUTPUT_DOCUMENTS.split(".")


def get_eval_trace_ids_for_datasets(*dataset_ids: int) -> Select[tuple[Optional[str]]]:
    return (
        select(distinct(models.ExperimentRunAnnotation.trace_id))
        .join(models.ExperimentRun)
        .join_from(models.ExperimentRun, models.Experiment)
        .where(models.Experiment.dataset_id.in_(set(dataset_ids)))
        .where(models.ExperimentRunAnnotation.trace_id.isnot(None))
    )


def get_project_names_for_datasets(*dataset_ids: int) -> Select[tuple[Optional[str]]]:
    return (
        select(distinct(models.Experiment.project_name))
        .where(models.Experiment.dataset_id.in_(set(dataset_ids)))
        .where(models.Experiment.project_name.isnot(None))
    )


def get_eval_trace_ids_for_experiments(*experiment_ids: int) -> Select[tuple[Optional[str]]]:
    return (
        select(distinct(models.ExperimentRunAnnotation.trace_id))
        .join(models.ExperimentRun)
        .where(models.ExperimentRun.experiment_id.in_(set(experiment_ids)))
        .where(models.ExperimentRunAnnotation.trace_id.isnot(None))
    )


def get_project_names_for_experiments(*experiment_ids: int) -> Select[tuple[Optional[str]]]:
    return (
        select(distinct(models.Experiment.project_name))
        .where(models.Experiment.id.in_(set(experiment_ids)))
        .where(models.Experiment.project_name.isnot(None))
    )


_AnyT = TypeVar("_AnyT")
_KeyT = TypeVar("_KeyT", bound=Hashable)


def dedup(
    items: Iterable[_AnyT],
    key: Callable[[_AnyT], _KeyT],
) -> list[_AnyT]:
    """
    Discard subsequent duplicates after the first appearance in `items`.
    """
    ans = []
    seen: set[_KeyT] = set()
    for item in items:
        if (k := key(item)) in seen:
            continue
        else:
            ans.append(item)
            seen.add(k)
    return ans


def get_dataset_example_revisions(
    dataset_version_id: int,
) -> Select[tuple[models.DatasetExampleRevision]]:
    version = (
        select(
            models.DatasetVersion.id,
            models.DatasetVersion.dataset_id,
        )
        .filter_by(id=dataset_version_id)
        .subquery()
    )
    table = models.DatasetExampleRevision
    revision = (
        select(
            table.dataset_example_id,
            func.max(table.dataset_version_id).label("dataset_version_id"),
        )
        .join_from(
            table,
            models.DatasetExample,
            table.dataset_example_id == models.DatasetExample.id,
        )
        .join_from(
            models.DatasetExample,
            version,
            models.DatasetExample.dataset_id == version.c.dataset_id,
        )
        .where(models.DatasetExample.dataset_id == version.c.dataset_id)
        .where(table.dataset_version_id <= version.c.id)
        .group_by(table.dataset_example_id)
        .subquery()
    )
    return (
        select(table)
        .where(table.revision_kind != "DELETE")
        .join(
            revision,
            onclause=and_(
                revision.c.dataset_example_id == table.dataset_example_id,
                revision.c.dataset_version_id == table.dataset_version_id,
            ),
        )
    )


_AnyTuple = TypeVar("_AnyTuple", bound=tuple[Any, ...])


def exclude_experiment_projects(
    stmt: Select[_AnyTuple],
) -> Select[_AnyTuple]:
    return stmt.outerjoin(
        models.Experiment,
        and_(
            models.Project.name == models.Experiment.project_name,
            models.Experiment.project_name != PLAYGROUND_PROJECT_NAME,
        ),
    ).where(models.Experiment.project_name.is_(None))


def get_time_interval_bucket_boundaries(
    timestamp_column: QueryableAttribute[datetime],
    stop_time: datetime,
    interval_seconds: int,
    dialect: SupportedSQLDialect,
) -> tuple[SQLColumnExpression[datetime], SQLColumnExpression[datetime]]:
    """Generate SQL expressions for time-based interval bucket boundaries.

    Creates SQL expressions that group timestamps into fixed-duration buckets,
    calculated backwards from end_time. Supports PostgreSQL and SQLite.

    Args:
        timestamp_column: SQL column containing timestamps to bucket
        stop_time: Reference time for calculating bucket boundaries
        interval_seconds: Duration of each bucket in seconds
        dialect: SQL dialect to generate expressions for

    Returns:
        Tuple of (interval_start, interval_end) SQL expressions where:
        - interval_start is inclusive (>=)
        - interval_end is exclusive (<)

    Raises:
        ValueError: If interval_seconds is zero or negative

    Example:
        >>> end_time = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        >>> start_expr, end_expr = get_time_interval_bucket_boundaries(
        ...     timestamp_column=models.Span.start_time,
        ...     stop_time=stop_time,
        ...     interval_seconds=3600,  # 1 hour
        ...     dialect=SupportedSQLDialect.POSTGRESQL,
        ... )
        >>> stmt = select(start_expr.label('bucket_start'),
        ...               end_expr.label('bucket_end')).group_by(start_expr, end_expr)

    Notes:
        - Buckets are right-exclusive: [start, end)
        - Calculated backwards from end_time
        - Handles timezone-aware datetimes
        - Minimum resolution: 1 second
    """
    # Validate inputs
    if interval_seconds <= 0:
        raise ValueError("Interval seconds must be positive")

    if dialect is SupportedSQLDialect.POSTGRESQL:
        return _get_time_interval_bucket_boundaries_for_postgresql(
            timestamp_column=timestamp_column,
            stop_time=stop_time,
            interval_seconds=interval_seconds,
        )
    elif dialect is SupportedSQLDialect.SQLITE:
        return _get_time_interval_bucket_boundaries_for_sqlite(
            timestamp_column=timestamp_column,
            stop_time=stop_time,
            interval_seconds=interval_seconds,
        )
    else:
        assert_never(dialect)


def _get_time_interval_bucket_boundaries_for_sqlite(
    timestamp_column: QueryableAttribute[datetime],
    stop_time: datetime,
    interval_seconds: int,
) -> tuple[SQLColumnExpression[datetime], SQLColumnExpression[datetime]]:
    """Generate SQL expressions for time-based interval bucket boundaries for SQLite."""
    # SQLite uses unixepoch for epoch conversion
    stop_time_epoch = func.unixepoch(sa.literal(stop_time))
    timestamp_epoch = func.unixepoch(timestamp_column)

    # Calculate interval number for each row
    epoch_diff = stop_time_epoch - timestamp_epoch
    interval_number = func.floor(epoch_diff / interval_seconds)

    # Calculate interval boundaries
    interval_start_epoch = stop_time_epoch - ((interval_number + 1) * interval_seconds)
    interval_stop_epoch = stop_time_epoch - (interval_number * interval_seconds)

    # Round to seconds by truncating epoch to integer seconds
    interval_start_epoch = func.cast(interval_start_epoch, Integer)
    interval_stop_epoch = func.cast(interval_stop_epoch, Integer)

    interval_start = func.datetime(interval_start_epoch, "unixepoch")
    interval_stop = func.datetime(interval_stop_epoch, "unixepoch")

    return interval_start, interval_stop


def _get_time_interval_bucket_boundaries_for_postgresql(
    timestamp_column: QueryableAttribute[datetime],
    stop_time: datetime,
    interval_seconds: int,
) -> tuple[SQLColumnExpression[datetime], SQLColumnExpression[datetime]]:
    """Generate SQL expressions for time-based interval bucket boundaries for PostgreSQL."""
    # Calculate interval number for each row
    epoch_diff = func.extract("epoch", sa.literal(stop_time) - timestamp_column)
    interval_number = func.floor(epoch_diff / interval_seconds)

    # Calculate interval boundaries using epoch arithmetic instead of interval arithmetic
    # Convert to epoch seconds, do arithmetic, then convert back to timestamp
    stop_time_epoch = func.extract("epoch", sa.literal(stop_time))

    interval_start_epoch = stop_time_epoch - ((interval_number + 1) * interval_seconds)
    interval_stop_epoch = stop_time_epoch - (interval_number * interval_seconds)

    interval_start = func.to_timestamp(interval_start_epoch)
    interval_stop = func.to_timestamp(interval_stop_epoch)

    return interval_start, interval_stop
