from collections.abc import Callable, Hashable, Iterable
from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional, Sequence, TypeVar, Union

import sqlalchemy as sa
from openinference.semconv.trace import (
    OpenInferenceSpanKindValues,
    RerankerAttributes,
    SpanAttributes,
)
from sqlalchemy import (
    Insert,
    Integer,
    Select,
    SQLColumnExpression,
    and_,
    case,
    distinct,
    exists,
    func,
    insert,
    literal,
    literal_column,
    or_,
    select,
    util,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import QueryableAttribute
from sqlalchemy.sql.roles import InElementRole
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


def _build_ranked_revisions_query(
    dataset_version_id: int,
    /,
    *,
    dataset_id: Optional[int] = None,
    example_ids: Optional[Union[Sequence[int], InElementRole]] = None,
) -> Select[tuple[int]]:
    """
    Build a query that ranks revisions per example within a dataset version.

    This performs the core ranking logic using ROW_NUMBER() to find the latest
    revision for each example within the specified dataset version.

    Args:
        dataset_version_id: Maximum dataset version to consider
        dataset_id: Optional dataset ID - if provided, avoids subquery lookup

    Returns:
        SQLAlchemy SELECT query with revision ranking and basic dataset filtering
    """
    stmt = (
        select(
            func.row_number()
            .over(
                partition_by=models.DatasetExampleRevision.dataset_example_id,
                order_by=models.DatasetExampleRevision.dataset_version_id.desc(),
            )
            .label("rn"),
        )
        .join(models.DatasetExample)
        .where(models.DatasetExampleRevision.dataset_version_id <= dataset_version_id)
    )

    if dataset_id is None:
        version_subquery = (
            select(models.DatasetVersion.dataset_id)
            .filter_by(id=dataset_version_id)
            .scalar_subquery()
        )
        stmt = stmt.where(models.DatasetExample.dataset_id == version_subquery)
    else:
        stmt = stmt.where(models.DatasetExample.dataset_id == dataset_id)

    if example_ids is not None:
        stmt = stmt.where(models.DatasetExampleRevision.dataset_example_id.in_(example_ids))

    return stmt


def get_dataset_example_revisions(
    dataset_version_id: int,
    /,
    *,
    dataset_id: Optional[int] = None,
    example_ids: Optional[Union[Sequence[int], InElementRole]] = None,
    split_ids: Optional[Union[Sequence[int], InElementRole]] = None,
    split_names: Optional[Union[Sequence[str], InElementRole]] = None,
) -> Select[tuple[models.DatasetExampleRevision]]:
    """
    Get the latest revisions for all dataset examples within a specific dataset version.

    Excludes examples where the latest revision is a DELETE.

    Args:
        dataset_version_id: The dataset version to get revisions for
        dataset_id: Optional dataset ID - if provided, avoids extra subquery lookup
        example_ids: Optional filter by specific example IDs (subquery or list of IDs).
            - None = no filtering
            - Empty sequences/subqueries = no matches (strict filtering)
        split_ids: Optional filter by split IDs (subquery or list of split IDs).
            - None = no filtering
            - Empty sequences/subqueries = no matches (strict filtering)
        split_names: Optional filter by split names (subquery or list of split names).
            - None = no filtering
            - Empty sequences/subqueries = no matches (strict filtering)

    Note:
        - split_ids and split_names are mutually exclusive
        - Use split_ids for better performance when IDs are available (avoids JOIN)
        - Empty filters use strict behavior: empty inputs return zero results
    """
    if split_ids is not None and split_names is not None:
        raise ValueError(
            "Cannot specify both split_ids and split_names - they are mutually exclusive"
        )

    stmt = _build_ranked_revisions_query(
        dataset_version_id,
        dataset_id=dataset_id,
        example_ids=example_ids,
    ).add_columns(
        models.DatasetExampleRevision.id,
        models.DatasetExampleRevision.revision_kind,
    )

    if split_ids is not None or split_names is not None:
        if split_names is not None:
            split_example_ids_subquery = (
                select(models.DatasetSplitDatasetExample.dataset_example_id)
                .join(
                    models.DatasetSplit,
                    models.DatasetSplit.id == models.DatasetSplitDatasetExample.dataset_split_id,
                )
                .where(models.DatasetSplit.name.in_(split_names))
            )
            stmt = stmt.where(models.DatasetExample.id.in_(split_example_ids_subquery))
        else:
            assert split_ids is not None
            split_example_ids_subquery = select(
                models.DatasetSplitDatasetExample.dataset_example_id
            ).where(models.DatasetSplitDatasetExample.dataset_split_id.in_(split_ids))
            stmt = stmt.where(models.DatasetExample.id.in_(split_example_ids_subquery))

    ranked_subquery = stmt.subquery()
    return (
        select(models.DatasetExampleRevision)
        .join(
            ranked_subquery,
            models.DatasetExampleRevision.id == ranked_subquery.c.id,
        )
        .where(
            ranked_subquery.c.rn == 1,
            ranked_subquery.c.revision_kind != "DELETE",
        )
    )


def create_experiment_examples_snapshot_insert(
    experiment: models.Experiment,
) -> Insert:
    """
    Create an INSERT statement to snapshot dataset examples for an experiment.

    This captures which examples belong to the experiment at the time of creation,
    respecting any dataset splits assigned to the experiment.

    Args:
        experiment: The experiment to create the snapshot for

    Returns:
        SQLAlchemy INSERT statement ready for execution
    """
    stmt = _build_ranked_revisions_query(
        experiment.dataset_version_id,
        dataset_id=experiment.dataset_id,
    ).add_columns(
        models.DatasetExampleRevision.id,
        models.DatasetExampleRevision.dataset_example_id,
        models.DatasetExampleRevision.revision_kind,
    )

    experiment_splits_subquery = select(models.ExperimentDatasetSplit.dataset_split_id).where(
        models.ExperimentDatasetSplit.experiment_id == experiment.id
    )
    has_splits_condition = exists(experiment_splits_subquery)
    split_filtered_example_ids = select(models.DatasetSplitDatasetExample.dataset_example_id).where(
        models.DatasetSplitDatasetExample.dataset_split_id.in_(experiment_splits_subquery)
    )

    stmt = stmt.where(
        or_(
            ~has_splits_condition,  # No splits = include all examples
            models.DatasetExampleRevision.dataset_example_id.in_(
                split_filtered_example_ids
            ),  # Has splits = filter by splits
        )
    )

    ranked_subquery = stmt.subquery()
    return insert(models.ExperimentDatasetExample).from_select(
        [
            models.ExperimentDatasetExample.experiment_id,
            models.ExperimentDatasetExample.dataset_example_id,
            models.ExperimentDatasetExample.dataset_example_revision_id,
        ],
        select(
            literal(experiment.id),
            ranked_subquery.c.dataset_example_id,
            ranked_subquery.c.id,
        ).where(
            ranked_subquery.c.rn == 1,
            ranked_subquery.c.revision_kind != "DELETE",
        ),
    )


async def insert_experiment_with_examples_snapshot(
    session: AsyncSession,
    experiment: models.Experiment,
) -> None:
    """
    Insert an experiment with its snapshot of dataset examples.
    """
    session.add(experiment)
    await session.flush()
    insert_stmt = create_experiment_examples_snapshot_insert(experiment)
    await session.execute(insert_stmt)


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


def date_trunc(
    dialect: SupportedSQLDialect,
    field: Literal["minute", "hour", "day", "week", "month", "year"],
    source: Union[QueryableAttribute[datetime], sa.TextClause],
    utc_offset_minutes: int = 0,
) -> SQLColumnExpression[datetime]:
    """
    Truncate a datetime to the specified field with optional UTC offset adjustment.

    This function provides a cross-dialect way to truncate datetime values to a specific
    time unit (minute, hour, day, week, month, or year). It handles UTC offset conversion
    by applying the offset before truncation and then converting back to UTC.

    Args:
        dialect: The SQL dialect to use (PostgreSQL or SQLite).
        field: The time unit to truncate to. Valid values are:
            - "minute": Truncate to the start of the minute (seconds set to 0)
            - "hour": Truncate to the start of the hour (minutes and seconds set to 0)
            - "day": Truncate to the start of the day (time set to 00:00:00)
            - "week": Truncate to the start of the week (Monday at 00:00:00)
            - "month": Truncate to the first day of the month (day set to 1, time to 00:00:00)
            - "year": Truncate to the first day of the year (date set to Jan 1, time to 00:00:00)
        source: The datetime column or expression to truncate.
        utc_offset_minutes: UTC offset in minutes to apply before truncation.
            Positive values represent time zones ahead of UTC (e.g., +60 for UTC+1).
            Negative values represent time zones behind UTC (e.g., -300 for UTC-5).
            Defaults to 0 (no offset).

    Returns:
        A SQL column expression representing the truncated datetime in UTC.

    Note:
        - For PostgreSQL, uses the native `date_trunc` function with timezone support.
        - For SQLite, implements custom truncation logic using datetime functions.
        - Week truncation starts on Monday (ISO 8601 standard).
        - The result is always returned in UTC, regardless of the input offset.

    Examples:
        >>> # Truncate to hour with no offset
        >>> date_trunc(SupportedSQLDialect.POSTGRESQL, "hour", Span.start_time)

        >>> # Truncate to day with UTC-5 offset (Eastern Time)
        >>> date_trunc(SupportedSQLDialect.SQLITE, "day", Span.start_time, -300)
    """
    if dialect is SupportedSQLDialect.POSTGRESQL:
        # Note: the usage of the timezone parameter in the form of e.g. "+05:00"
        # appears to be an undocumented feature of PostgreSQL's date_trunc function.
        # Below is an example query and its output executed on PostgreSQL v12 and v17.
        # SELECT date_trunc('day', TIMESTAMP WITH TIME ZONE '2001-02-16 15:38:40-05'),
        #        date_trunc('day', TIMESTAMP WITH TIME ZONE '2001-02-16 20:38:40+00', '+05:00'),
        #        date_trunc('day', TIMESTAMP WITH TIME ZONE '2001-02-16 20:38:40+00', '-05:00');
        # ┌────────────────────────┬────────────────────────┬────────────────────────┐
        # │       date_trunc       │       date_trunc       │       date_trunc       │
        # ├────────────────────────┼────────────────────────┼────────────────────────┤
        # │ 2001-02-16 00:00:00+00 │ 2001-02-16 05:00:00+00 │ 2001-02-16 19:00:00+00 │
        # └────────────────────────┴────────────────────────┴────────────────────────┘
        # (1 row)
        sign = "-" if utc_offset_minutes >= 0 else "+"
        timezone = f"{sign}{abs(utc_offset_minutes) // 60}:{abs(utc_offset_minutes) % 60:02d}"
        return sa.func.date_trunc(field, source, timezone)
    elif dialect is SupportedSQLDialect.SQLITE:
        return _date_trunc_for_sqlite(field, source, utc_offset_minutes)
    else:
        assert_never(dialect)


def _date_trunc_for_sqlite(
    field: Literal["minute", "hour", "day", "week", "month", "year"],
    source: Union[QueryableAttribute[datetime], sa.TextClause],
    utc_offset_minutes: int = 0,
) -> SQLColumnExpression[datetime]:
    """
    SQLite-specific implementation of datetime truncation with UTC offset handling.

    This private helper function implements date truncation for SQLite databases, which
    lack a native date_trunc function. It uses SQLite's datetime and strftime functions
    to achieve the same result as PostgreSQL's date_trunc function.

    Args:
        field: The time unit to truncate to. Valid values are:
            - "minute": Truncate to the start of the minute (seconds set to 0)
            - "hour": Truncate to the start of the hour (minutes and seconds set to 0)
            - "day": Truncate to the start of the day (time set to 00:00:00)
            - "week": Truncate to the start of the week (Monday at 00:00:00)
            - "month": Truncate to the first day of the month (day set to 1, time to 00:00:00)
            - "year": Truncate to the first day of the year (date set to Jan 1, time to 00:00:00)
        source: The datetime column or expression to truncate.
        utc_offset_minutes: UTC offset in minutes to apply before truncation.
            Positive values represent time zones ahead of UTC (e.g., +60 for UTC+1).
            Negative values represent time zones behind UTC (e.g., -300 for UTC-5).

    Returns:
        A SQL column expression representing the truncated datetime in UTC.

    Implementation Details:
        - Uses SQLite's strftime() function to format and extract date components
        - Applies UTC offset before truncation using datetime(source, "N minutes")
        - Converts result back to UTC by subtracting the offset
        - Week truncation uses day-of-week calculations where:
            * strftime('%w') returns 0=Sunday, 1=Monday, ..., 6=Saturday
            * Truncates to Monday (start of week) using case-based day adjustments
        - Month/year truncation reconstructs dates using extracted components

    Raises:
        ValueError: If the field parameter is not one of the supported values.

    Note:
        This is a private helper function intended only for use by the date_trunc function
        when the dialect is SupportedSQLDialect.SQLITE.
    """
    # SQLite does not have a built-in date truncation function, so we use datetime functions
    # First apply UTC offset, then truncate
    offset_source = func.datetime(source, f"{utc_offset_minutes} minutes")

    if field == "minute":
        t = func.datetime(func.strftime("%Y-%m-%d %H:%M:00", offset_source))
    elif field == "hour":
        t = func.datetime(func.strftime("%Y-%m-%d %H:00:00", offset_source))
    elif field == "day":
        t = func.datetime(func.strftime("%Y-%m-%d 00:00:00", offset_source))
    elif field == "week":
        # Truncate to Monday (start of week)
        # SQLite strftime('%w') returns: 0=Sunday, 1=Monday, ..., 6=Saturday
        dow = func.strftime("%w", offset_source)
        t = func.datetime(
            case(
                (dow == "0", func.date(offset_source, "-6 days")),  # Sunday -> go back 6 days
                (dow == "1", func.date(offset_source, "+0 days")),  # Monday -> stay
                (dow == "2", func.date(offset_source, "-1 days")),  # Tuesday -> go back 1 day
                (dow == "3", func.date(offset_source, "-2 days")),  # Wednesday -> go back 2 days
                (dow == "4", func.date(offset_source, "-3 days")),  # Thursday -> go back 3 days
                (dow == "5", func.date(offset_source, "-4 days")),  # Friday -> go back 4 days
                (dow == "6", func.date(offset_source, "-5 days")),  # Saturday -> go back 5 days
            ),
            "00:00:00",
        )
    elif field == "month":
        # Extract year and month, then construct first day of month
        year = func.strftime("%Y", offset_source)
        month = func.strftime("%m", offset_source)
        t = func.datetime(year + "-" + month + "-01 00:00:00")
    elif field == "year":
        # Extract year, then construct first day of year
        year = func.strftime("%Y", offset_source)
        t = func.datetime(year + "-01-01 00:00:00")
    else:
        raise ValueError(f"Unsupported field for date truncation: {field}")

    # Convert back to UTC by subtracting the offset
    return func.datetime(t, f"{-utc_offset_minutes} minutes")


def get_ancestor_span_rowids(parent_id: str) -> Select[tuple[int]]:
    """
    Get all ancestor span IDs for a given parent_id using recursive CTE.

    This function returns a query that finds all ancestors of a span with the given parent_id.
    It uses a recursive Common Table Expression (CTE) to traverse up the span hierarchy.

    Args:
        parent_id: The span_id of the parent span to start the ancestor search from.

    Returns:
        A Select query that returns tuples of (span_id,) for all ancestor spans.
    """
    ancestors = (
        select(models.Span.id, models.Span.parent_id)
        .where(models.Span.span_id == parent_id)
        .cte(recursive=True)
    )
    child = ancestors.alias()
    ancestors = ancestors.union_all(
        select(models.Span.id, models.Span.parent_id).join(
            child, models.Span.span_id == child.c.parent_id
        )
    )
    return select(ancestors.c.id)


def truncate_name(name: str, max_len: int = 63) -> str:
    # https://github.com/sqlalchemy/sqlalchemy/blob/e263825e3c5060bf4f47eed0e833c6660a31658e/lib/sqlalchemy/sql/compiler.py#L7844-L7845
    if len(name) > max_len:
        return name[0 : max_len - 8] + "_" + util.md5_hex(name)[-4:]
    return name


def get_successful_run_counts_subquery(
    experiment_id: int,
    repetitions: int,
) -> Any:
    """
    Build a subquery that counts successful runs per dataset example for an experiment.

    This subquery outer joins experiment dataset examples with their runs, counting only
    successful runs (runs that exist and have no error). The HAVING clause filters to only
    include examples with fewer successful runs than the total repetitions required.

    Args:
        experiment_id: The experiment ID to query runs for
        repetitions: The number of repetitions required per example

    Returns:
        SQLAlchemy subquery with columns:
        - dataset_example_revision_id: ID of the example revision
        - dataset_example_id: ID of the dataset example
        - successful_count: Count of successful runs for this example
    """
    # Use CASE to count only successful runs (run exists AND error IS NULL)
    # Important: Must check that run exists (id IS NOT NULL) to distinguish
    # "no run" from "successful run" in the outer join
    successful_run_case = case(
        (
            and_(
                models.ExperimentRun.id.is_not(None),  # Run exists
                models.ExperimentRun.error.is_(None),  # No error (successful)
            ),
            1,
        ),
        else_=0,
    )

    return (
        select(
            models.ExperimentDatasetExample.dataset_example_revision_id,
            models.ExperimentDatasetExample.dataset_example_id,
            func.sum(successful_run_case).label("successful_count"),
        )
        .select_from(models.ExperimentDatasetExample)
        .outerjoin(
            models.ExperimentRun,
            and_(
                models.ExperimentRun.experiment_id == experiment_id,
                models.ExperimentRun.dataset_example_id
                == models.ExperimentDatasetExample.dataset_example_id,
            ),
        )
        .where(models.ExperimentDatasetExample.experiment_id == experiment_id)
        .group_by(
            models.ExperimentDatasetExample.dataset_example_revision_id,
            models.ExperimentDatasetExample.dataset_example_id,
        )
        .having(
            # Only include incomplete examples (successful_count < repetitions)
            func.coalesce(func.sum(successful_run_case), 0) < repetitions
        )
        .subquery()
    )


def generate_expected_repetitions_cte(
    dialect: SupportedSQLDialect,
    run_counts_subquery: Any,
    repetitions: int,
) -> Any:
    """
    Generate a CTE that produces all expected repetition numbers for partially complete examples.

    This generates a sequence of repetition numbers [1..repetitions] for each example that has
    at least one successful run (0 < successful_count < repetitions). The implementation varies
    by SQL dialect.

    Args:
        dialect: The SQL dialect to use (PostgreSQL or SQLite)
        run_counts_subquery: Subquery from get_successful_run_counts_subquery containing
            dataset_example_revision_id, dataset_example_id, and successful_count columns
        repetitions: The total number of repetitions required

    Returns:
        SQLAlchemy CTE with columns:
        - dataset_example_revision_id: ID of the example revision
        - dataset_example_id: ID of the dataset example
        - successful_count: Count of successful runs for this example
        - repetition_number: Expected repetition number (1..repetitions)

    Note:
        - For PostgreSQL: Uses generate_series function
        - For SQLite: Uses recursive CTE to generate the sequence
    """
    if dialect is SupportedSQLDialect.POSTGRESQL:
        # Generate expected repetition numbers only for partially complete examples
        # Use func.generate_series with direct parameter - SQLAlchemy handles this safely
        return (
            select(
                run_counts_subquery.c.dataset_example_revision_id,
                run_counts_subquery.c.dataset_example_id,
                run_counts_subquery.c.successful_count,
                func.generate_series(1, repetitions).label("repetition_number"),
            )
            .select_from(run_counts_subquery)
            .where(run_counts_subquery.c.successful_count > 0)  # Only partially complete!
            .cte("expected_runs")
        )
    elif dialect is SupportedSQLDialect.SQLITE:
        # Recursive CTE only for partially complete examples
        expected_runs_cte = (
            select(
                run_counts_subquery.c.dataset_example_revision_id,
                run_counts_subquery.c.dataset_example_id,
                run_counts_subquery.c.successful_count,
                literal_column("1").label("repetition_number"),
            )
            .select_from(run_counts_subquery)
            .where(run_counts_subquery.c.successful_count > 0)  # Only partially complete!
            .cte("expected_runs", recursive=True)
        )

        # Recursive part: increment repetition_number up to repetitions
        expected_runs_recursive = expected_runs_cte.union_all(
            select(
                expected_runs_cte.c.dataset_example_revision_id,
                expected_runs_cte.c.dataset_example_id,
                expected_runs_cte.c.successful_count,
                (expected_runs_cte.c.repetition_number + 1).label("repetition_number"),
            ).where(expected_runs_cte.c.repetition_number < repetitions)
        )

        return expected_runs_recursive
    else:
        assert_never(dialect)


def get_incomplete_repetitions_query(
    dialect: SupportedSQLDialect,
    expected_runs_cte: Any,
    experiment_id: int,
) -> Select[tuple[Any, Any, Any]]:
    """
    Build a query that finds incomplete repetitions for partially complete examples.

    This query outer joins the expected repetition numbers with actual successful runs to find
    which repetitions are missing or failed. It aggregates the incomplete repetitions into an
    array or JSON array depending on the dialect.

    Args:
        dialect: The SQL dialect to use (PostgreSQL or SQLite)
        expected_runs_cte: CTE from generate_expected_repetitions_cte containing expected
            repetition numbers for partially complete examples
        experiment_id: The experiment ID to query runs for

    Returns:
        SQLAlchemy SELECT query with columns:
        - dataset_example_revision_id: ID of the example revision
        - successful_count: Count of successful runs for this example
        - incomplete_reps: Array/JSON array of incomplete repetition numbers

    Note:
        - For PostgreSQL: Returns an array using array_agg
        - For SQLite: Returns a JSON string using json_group_array
    """
    if dialect is SupportedSQLDialect.POSTGRESQL:
        agg_func = func.coalesce(
            func.array_agg(expected_runs_cte.c.repetition_number),
            literal_column("ARRAY[]::int[]"),
        )
    elif dialect is SupportedSQLDialect.SQLITE:
        agg_func = func.coalesce(
            func.json_group_array(expected_runs_cte.c.repetition_number),
            literal_column("'[]'"),
        )
    else:
        assert_never(dialect)

    # Find incomplete runs for partially complete examples
    return (
        select(
            expected_runs_cte.c.dataset_example_revision_id,
            expected_runs_cte.c.successful_count,
            agg_func.label("incomplete_reps"),
        )
        .select_from(expected_runs_cte)
        .outerjoin(
            models.ExperimentRun,
            and_(
                models.ExperimentRun.experiment_id == experiment_id,
                models.ExperimentRun.dataset_example_id == expected_runs_cte.c.dataset_example_id,
                models.ExperimentRun.repetition_number == expected_runs_cte.c.repetition_number,
                # Only join successful runs
                models.ExperimentRun.error.is_(None),
            ),
        )
        .where(
            # Incomplete = no matching run (NULL)
            models.ExperimentRun.id.is_(None)
        )
        .group_by(
            expected_runs_cte.c.dataset_example_revision_id,
            expected_runs_cte.c.successful_count,
        )
    )


def get_incomplete_runs_with_revisions_query(
    incomplete_runs_subquery: Any,
    *,
    cursor_example_rowid: Optional[int] = None,
    limit: Optional[int] = None,
) -> Select[tuple[models.DatasetExampleRevision, Any, Any]]:
    """
    Build the main query that joins incomplete runs with dataset example revisions.

    This query takes a subquery containing incomplete run information and joins it with
    the DatasetExampleRevision table to get the full example data. It also applies
    cursor-based pagination for efficient retrieval of large result sets.

    Args:
        incomplete_runs_subquery: Subquery with columns:
            - dataset_example_revision_id: ID of the example revision
            - successful_count: Count of successful runs for this example
            - incomplete_reps: Array/JSON array of incomplete repetition numbers
        cursor_example_rowid: Optional cursor position (dataset_example_id) for pagination.
            When provided, only returns examples with ID >= cursor_example_rowid
        limit: Optional maximum number of results to return. If provided, the query
            will fetch limit+1 rows to enable next-page detection

    Returns:
        SQLAlchemy SELECT query with columns:
        - DatasetExampleRevision: The full revision object
        - successful_count: Count of successful runs
        - incomplete_reps: Array/JSON array of incomplete repetition numbers

    Note:
        Results are ordered by dataset_example_id ascending for consistent pagination.
        When using limit, fetch one extra row to check if there's a next page.
    """
    stmt = (
        select(
            models.DatasetExampleRevision,
            incomplete_runs_subquery.c.successful_count,
            incomplete_runs_subquery.c.incomplete_reps,
        )
        .select_from(incomplete_runs_subquery)
        .join(
            models.DatasetExampleRevision,
            models.DatasetExampleRevision.id
            == incomplete_runs_subquery.c.dataset_example_revision_id,
        )
        .order_by(models.DatasetExampleRevision.dataset_example_id.asc())
    )

    # Apply cursor filter in SQL for efficiency with large datasets
    if cursor_example_rowid is not None:
        stmt = stmt.where(models.DatasetExampleRevision.dataset_example_id >= cursor_example_rowid)

    # Fetch limit+1 to check if there's a next page
    if limit is not None:
        stmt = stmt.limit(limit + 1)

    return stmt


def get_successful_experiment_runs_query(
    experiment_id: int,
    *,
    cursor_run_rowid: Optional[int] = None,
    limit: Optional[int] = None,
) -> Select[tuple[models.ExperimentRun, int]]:
    """
    Build a query for successful experiment runs with their dataset example revision IDs.

    This query retrieves all experiment runs that completed successfully (error IS NULL)
    and joins them with the ExperimentDatasetExample table to get the revision IDs.
    Results are ordered by run ID ascending for consistent pagination.

    Args:
        experiment_id: The experiment ID to query runs for
        cursor_run_rowid: Optional cursor position (experiment_run_id) for pagination.
            When provided, only returns runs with ID >= cursor_run_rowid
        limit: Optional maximum number of results to return. If provided, the query
            will fetch limit+1 rows to enable next-page detection

    Returns:
        SQLAlchemy SELECT query with columns:
        - ExperimentRun: The full experiment run object
        - dataset_example_revision_id: ID of the dataset example revision (int)

    Note:
        - Only includes successful runs (error IS NULL)
        - Results ordered by run ID ascending for consistent pagination
        - When using limit, fetch one extra row to check if there's a next page
    """
    stmt = (
        select(
            models.ExperimentRun,
            models.ExperimentDatasetExample.dataset_example_revision_id,
        )
        .join(
            models.ExperimentDatasetExample,
            and_(
                models.ExperimentDatasetExample.experiment_id == experiment_id,
                models.ExperimentDatasetExample.dataset_example_id
                == models.ExperimentRun.dataset_example_id,
            ),
        )
        .where(
            and_(
                models.ExperimentRun.experiment_id == experiment_id,
                models.ExperimentRun.error.is_(None),  # Only successful task runs
            )
        )
        .order_by(models.ExperimentRun.id.asc())
    )

    if cursor_run_rowid is not None:
        stmt = stmt.where(models.ExperimentRun.id >= cursor_run_rowid)

    if limit is not None:
        stmt = stmt.limit(limit + 1)

    return stmt


def get_experiment_run_annotations_query(
    run_ids: Sequence[int],
    evaluation_names: Sequence[str],
) -> Select[tuple[int, str, Optional[str]]]:
    """
    Build a query to get annotations for specific runs and evaluation names.

    This query retrieves annotations (evaluations) for a set of experiment runs,
    filtered by specific evaluation names. It returns only the essential fields
    needed to determine if an evaluation is complete or has errors.

    Args:
        run_ids: List of experiment run IDs to query annotations for
        evaluation_names: List of evaluation names to filter by

    Returns:
        SQLAlchemy SELECT query with columns:
        - experiment_run_id: ID of the experiment run (int)
        - name: Name of the evaluation (str)
        - error: Error message if evaluation failed, None if successful (Optional[str])

    Example:
        >>> run_ids = [1, 2, 3]
        >>> eval_names = ["relevance", "coherence"]
        >>> query = get_experiment_run_annotations_query(run_ids, eval_names)
        >>> results = await session.execute(query)
        >>> for run_id, name, error in results:
        ...     # Process annotations...
    """
    return (
        select(
            models.ExperimentRunAnnotation.experiment_run_id,
            models.ExperimentRunAnnotation.name,
            models.ExperimentRunAnnotation.error,
        )
        .where(models.ExperimentRunAnnotation.experiment_run_id.in_(run_ids))
        .where(models.ExperimentRunAnnotation.name.in_(evaluation_names))
    )


def get_runs_with_incomplete_evaluations_query(
    experiment_id: int,
    evaluation_names: Sequence[str],
    dialect: SupportedSQLDialect,
    *,
    cursor_run_rowid: Optional[int] = None,
    limit: Optional[int] = None,
    include_annotations_and_revisions: bool = False,
) -> Select[Any]:
    """
    Get experiment runs that have incomplete evaluations.

    A run has incomplete evaluations if it's missing successful annotations for any of
    the requested evaluation names. Both missing (no annotation) and failed (error != NULL)
    evaluations are considered incomplete.

    Args:
        experiment_id: The experiment ID to query
        evaluation_names: Evaluation names to check for completeness
        dialect: SQL dialect (PostgreSQL or SQLite)
        cursor_run_rowid: Optional run ID for cursor-based pagination
        limit: Optional limit (fetches limit+1 for next-page detection)
        include_annotations_and_revisions: If True, also fetch revision and successful
            annotation names as JSON array

    Returns:
        Query returning (ExperimentRun, revision_id, [revision, annotations_json])
        Results ordered by run ID ascending
    """
    # Subquery: Count successful annotations per run
    successful_annotations_count = (
        select(
            models.ExperimentRunAnnotation.experiment_run_id,
            func.count().label("successful_count"),
        )
        .where(
            models.ExperimentRunAnnotation.name.in_(evaluation_names),
            models.ExperimentRunAnnotation.error.is_(None),
        )
        .group_by(models.ExperimentRunAnnotation.experiment_run_id)
        .subquery()
    )

    # Base query: Find runs where successful_count < required evaluations
    stmt = (
        select(
            models.ExperimentRun,
            models.ExperimentDatasetExample.dataset_example_revision_id,
        )
        .join(
            models.ExperimentDatasetExample,
            and_(
                models.ExperimentDatasetExample.experiment_id == experiment_id,
                models.ExperimentDatasetExample.dataset_example_id
                == models.ExperimentRun.dataset_example_id,
            ),
        )
        .outerjoin(
            successful_annotations_count,
            successful_annotations_count.c.experiment_run_id == models.ExperimentRun.id,
        )
        .where(
            models.ExperimentRun.experiment_id == experiment_id,
            models.ExperimentRun.error.is_(None),  # Only successful task runs
            func.coalesce(successful_annotations_count.c.successful_count, 0)
            < len(evaluation_names),
        )
    )

    # Optionally include revisions and successful annotation names
    if include_annotations_and_revisions:
        # Subquery: Aggregate successful annotation names as JSON array
        if dialect is SupportedSQLDialect.POSTGRESQL:
            json_agg_expr = func.cast(
                func.coalesce(
                    func.json_agg(models.ExperimentRunAnnotation.name),
                    literal_column("'[]'::json"),
                ),
                sa.String,
            )
        else:  # SQLite
            json_agg_expr = func.cast(
                func.coalesce(
                    func.json_group_array(models.ExperimentRunAnnotation.name),
                    literal_column("'[]'"),
                ),
                sa.String,
            )

        successful_annotations_json = (
            select(
                models.ExperimentRunAnnotation.experiment_run_id,
                json_agg_expr.label("annotations_json"),
            )
            .where(
                models.ExperimentRunAnnotation.name.in_(evaluation_names),
                models.ExperimentRunAnnotation.error.is_(None),
            )
            .group_by(models.ExperimentRunAnnotation.experiment_run_id)
            .subquery()
        )

        stmt = (
            stmt.add_columns(
                models.DatasetExampleRevision,
                successful_annotations_json.c.annotations_json,
            )
            .join(
                models.DatasetExampleRevision,
                models.DatasetExampleRevision.id
                == models.ExperimentDatasetExample.dataset_example_revision_id,
            )
            .outerjoin(
                successful_annotations_json,
                successful_annotations_json.c.experiment_run_id == models.ExperimentRun.id,
            )
        )

    # Apply ordering, cursor, and limit
    stmt = stmt.order_by(models.ExperimentRun.id.asc())

    if cursor_run_rowid is not None:
        stmt = stmt.where(models.ExperimentRun.id >= cursor_run_rowid)

    if limit is not None:
        stmt = stmt.limit(limit + 1)

    return stmt


def get_experiment_incomplete_runs_query(
    experiment: models.Experiment,
    dialect: SupportedSQLDialect,
    *,
    cursor_example_rowid: Optional[int] = None,
    limit: Optional[int] = None,
) -> Select[tuple[models.DatasetExampleRevision, Any, Any]]:
    """
    High-level helper to build a complete query for incomplete runs in an experiment.

    This is the main entry point for querying incomplete runs. It encapsulates all the
    logic for finding runs that need to be completed, including both missing runs
    (not yet attempted) and failed runs (attempted but have errors).

    The function automatically chooses the optimal query strategy:
    - For repetitions=1: Simple fast path (no CTE needed)
    - For repetitions>1: Two-path optimization separating completely missing examples
      from partially complete examples

    Args:
        experiment: The Experiment model instance to query incomplete runs for
        dialect: The SQL dialect to use (PostgreSQL or SQLite)
        cursor_example_rowid: Optional cursor position (dataset_example_id) for pagination.
            When provided, only returns examples with ID >= cursor_example_rowid
        limit: Optional maximum number of results to return. If provided, the query
            will fetch limit+1 rows to enable next-page detection

    Returns:
        SQLAlchemy SELECT query with columns:
        - DatasetExampleRevision: The full revision object with example data
        - successful_count: Count of successful runs for this example (int)
        - incomplete_reps: Incomplete repetition numbers as:
            * PostgreSQL: Array of ints (or empty array for completely missing)
            * SQLite: JSON string array (or '[]' for completely missing)

    Note:
        For completely missing examples (successful_count=0), the incomplete_reps
        column will be an empty array/JSON. Callers should generate the full
        [1..repetitions] list when successful_count=0.

    Example:
        >>> experiment = session.get(models.Experiment, experiment_id)
        >>> dialect = SupportedSQLDialect(session.bind.dialect.name)
        >>> query = get_experiment_incomplete_runs_query(
        ...     experiment, dialect, cursor_example_rowid=100, limit=50
        ... )
        >>> results = await session.execute(query)
        >>> for revision, success_count, incomplete_reps in results:
        ...     # Process incomplete runs...
    """
    # Step 1: Get successful run counts for incomplete examples
    run_counts_subquery = get_successful_run_counts_subquery(experiment.id, experiment.repetitions)

    # Step 2: Build the combined incomplete runs subquery
    # The strategy depends on whether repetitions=1 or >1
    if experiment.repetitions == 1:
        # Fast path optimization for repetitions=1:
        # All incomplete examples have successful_count=0, so we can skip the expensive CTE
        empty_array: Any
        if dialect is SupportedSQLDialect.POSTGRESQL:
            empty_array = literal_column("ARRAY[]::int[]")
        elif dialect is SupportedSQLDialect.SQLITE:
            empty_array = literal_column("'[]'")
        else:
            assert_never(dialect)

        combined_incomplete = (
            select(
                run_counts_subquery.c.dataset_example_revision_id,
                run_counts_subquery.c.successful_count,
                empty_array.label("incomplete_reps"),
            ).select_from(run_counts_subquery)
        ).subquery()
    else:
        # Two-path optimization for repetitions > 1:
        # Path 1: Completely missing examples (successful_count = 0) - no CTE needed
        # Path 2: Partially complete examples (0 < successful_count < R) - use CTE

        # Path 1: Completely missing examples
        empty_array_inner: Any
        if dialect is SupportedSQLDialect.POSTGRESQL:
            empty_array_inner = literal_column("ARRAY[]::int[]")
        elif dialect is SupportedSQLDialect.SQLITE:
            empty_array_inner = literal_column("'[]'")
        else:
            assert_never(dialect)

        completely_missing_stmt = (
            select(
                run_counts_subquery.c.dataset_example_revision_id,
                run_counts_subquery.c.successful_count,
                empty_array_inner.label("incomplete_reps"),
            )
            .select_from(run_counts_subquery)
            .where(run_counts_subquery.c.successful_count == 0)
        )

        # Path 2: Partially complete examples
        expected_runs_cte = generate_expected_repetitions_cte(
            dialect, run_counts_subquery, experiment.repetitions
        )
        partially_complete_stmt = get_incomplete_repetitions_query(
            dialect, expected_runs_cte, experiment.id
        )

        # Combine both paths
        from sqlalchemy import union_all

        combined_incomplete = union_all(completely_missing_stmt, partially_complete_stmt).subquery()

    # Step 3: Join with revisions and apply pagination
    return get_incomplete_runs_with_revisions_query(
        combined_incomplete,
        cursor_example_rowid=cursor_example_rowid,
        limit=limit,
    )
