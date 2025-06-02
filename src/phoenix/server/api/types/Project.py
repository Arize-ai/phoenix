from __future__ import annotations

import operator
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Annotated, Any, ClassVar, Optional

import strawberry
from aioitertools.itertools import islice
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import desc, distinct, func, or_, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.expression import tuple_
from strawberry import ID, UNSET, Private, lazy
from strawberry.relay import Connection, Node, NodeID
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.datetime_utils import right_open_time_range
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.ProjectSessionSort import (
    ProjectSessionColumn,
    ProjectSessionSort,
)
from phoenix.server.api.input_types.SpanSort import SpanSort, SpanSortConfig
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.AnnotationConfig import AnnotationConfig, to_gql_annotation_config
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.DocumentEvaluationSummary import DocumentEvaluationSummary
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    Cursor,
    CursorSortColumn,
    CursorString,
    connection_from_cursors_and_nodes,
    connection_from_list,
)
from phoenix.server.api.types.ProjectSession import ProjectSession, to_gql_project_session
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.TimeSeries import TimeSeries, TimeSeriesDataPoint
from phoenix.server.api.types.Trace import Trace
from phoenix.server.api.types.ValidationResult import ValidationResult
from phoenix.trace.dsl import SpanFilter

DEFAULT_PAGE_SIZE = 30
if TYPE_CHECKING:
    from phoenix.server.api.types.ProjectTraceRetentionPolicy import ProjectTraceRetentionPolicy


@strawberry.type
class Project(Node):
    _table: ClassVar[type[models.Base]] = models.Project
    project_rowid: NodeID[int]
    db_project: Private[models.Project] = UNSET

    def __post_init__(self) -> None:
        if self.db_project and self.project_rowid != self.db_project.id:
            raise ValueError("Project ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_project:
            name = self.db_project.name
        else:
            name = await info.context.data_loaders.project_fields.load(
                (self.project_rowid, models.Project.name),
            )
        return name

    @strawberry.field
    async def gradient_start_color(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_project:
            gradient_start_color = self.db_project.gradient_start_color
        else:
            gradient_start_color = await info.context.data_loaders.project_fields.load(
                (self.project_rowid, models.Project.gradient_start_color),
            )
        return gradient_start_color

    @strawberry.field
    async def gradient_end_color(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_project:
            gradient_end_color = self.db_project.gradient_end_color
        else:
            gradient_end_color = await info.context.data_loaders.project_fields.load(
                (self.project_rowid, models.Project.gradient_end_color),
            )
        return gradient_end_color

    @strawberry.field
    async def start_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        start_time = await info.context.data_loaders.min_start_or_max_end_times.load(
            (self.project_rowid, "start"),
        )
        start_time, _ = right_open_time_range(start_time, None)
        return start_time

    @strawberry.field
    async def end_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        end_time = await info.context.data_loaders.min_start_or_max_end_times.load(
            (self.project_rowid, "end"),
        )
        _, end_time = right_open_time_range(None, end_time)
        return end_time

    @strawberry.field
    async def record_count(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> int:
        return await info.context.data_loaders.record_counts.load(
            ("span", self.project_rowid, time_range, filter_condition),
        )

    @strawberry.field
    async def trace_count(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
    ) -> int:
        return await info.context.data_loaders.record_counts.load(
            ("trace", self.project_rowid, time_range, None),
        )

    @strawberry.field
    async def token_count_total(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> float:
        return await info.context.data_loaders.token_counts.load(
            ("total", self.project_rowid, time_range, filter_condition),
        )

    @strawberry.field
    async def token_count_prompt(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> float:
        return await info.context.data_loaders.token_counts.load(
            ("prompt", self.project_rowid, time_range, filter_condition),
        )

    @strawberry.field
    async def token_count_completion(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> float:
        return await info.context.data_loaders.token_counts.load(
            ("completion", self.project_rowid, time_range, filter_condition),
        )

    @strawberry.field
    async def latency_ms_quantile(
        self,
        info: Info[Context, None],
        probability: float,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[float]:
        return await info.context.data_loaders.latency_ms_quantile.load(
            (
                "trace",
                self.project_rowid,
                time_range,
                None,
                probability,
            ),
        )

    @strawberry.field
    async def span_latency_ms_quantile(
        self,
        info: Info[Context, None],
        probability: float,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[float]:
        return await info.context.data_loaders.latency_ms_quantile.load(
            (
                "span",
                self.project_rowid,
                time_range,
                filter_condition,
                probability,
            ),
        )

    @strawberry.field
    async def trace(self, trace_id: ID, info: Info[Context, None]) -> Optional[Trace]:
        stmt = (
            select(models.Trace)
            .where(models.Trace.trace_id == str(trace_id))
            .where(models.Trace.project_rowid == self.project_rowid)
        )
        async with info.context.db() as session:
            if (trace := await session.scalar(stmt)) is None:
                return None
        return Trace(trace_rowid=trace.id, db_trace=trace)

    @strawberry.field
    async def spans(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        first: Optional[int] = DEFAULT_PAGE_SIZE,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        sort: Optional[SpanSort] = UNSET,
        root_spans_only: Optional[bool] = UNSET,
        filter_condition: Optional[str] = UNSET,
        orphan_span_as_root_span: Optional[bool] = True,
    ) -> Connection[Span]:
        stmt = (
            select(models.Span.id)
            .join(models.Trace)
            .where(models.Trace.project_rowid == self.project_rowid)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Span.start_time)
            if time_range.end:
                stmt = stmt.where(models.Span.start_time < time_range.end)
        if filter_condition:
            span_filter = SpanFilter(condition=filter_condition)
            stmt = span_filter(stmt)
        sort_config: Optional[SpanSortConfig] = None
        cursor_rowid_column: Any = models.Span.id
        if sort:
            sort_config = sort.update_orm_expr(stmt)
            stmt = sort_config.stmt
            if sort_config.dir is SortDir.desc:
                cursor_rowid_column = desc(cursor_rowid_column)
        if after:
            cursor = Cursor.from_string(after)
            if sort_config and cursor.sort_column:
                sort_column = cursor.sort_column
                compare = operator.lt if sort_config.dir is SortDir.desc else operator.gt
                stmt = stmt.where(
                    compare(
                        tuple_(sort_config.orm_expression, models.Span.id),
                        (sort_column.value, cursor.rowid),
                    )
                )
            else:
                stmt = stmt.where(models.Span.id > cursor.rowid)
        stmt = stmt.order_by(cursor_rowid_column)
        if root_spans_only:
            # A root span is either a span with no parent_id or an orphan span
            # (a span whose parent_id references a span that doesn't exist in the database)
            if orphan_span_as_root_span:
                # Include both types of root spans
                parent_spans = select(models.Span.span_id).alias("parent_spans")
                candidate_spans = stmt.add_columns(models.Span.parent_id).cte("candidate_spans")
                stmt = select(candidate_spans).where(
                    or_(
                        candidate_spans.c.parent_id.is_(None),
                        ~select(1)
                        .where(candidate_spans.c.parent_id == parent_spans.c.span_id)
                        .exists(),
                    )
                )
            else:
                # Only include explicit root spans (spans with parent_id = NULL)
                stmt = stmt.where(models.Span.parent_id.is_(None))
        if first:
            stmt = stmt.limit(
                first + 1  # overfetch by one to determine whether there's a next page
            )
        cursors_and_nodes = []
        async with info.context.db() as session:
            span_records = await session.stream(stmt)
            async for span_record in islice(span_records, first):
                span_rowid: int = span_record[0]
                cursor = Cursor(rowid=span_rowid)
                if sort_config:
                    assert len(span_record) > 1
                    cursor.sort_column = CursorSortColumn(
                        type=sort_config.column_data_type,
                        value=span_record[1],
                    )
                cursors_and_nodes.append((cursor, Span(span_rowid=span_rowid)))
            has_next_page = True
            try:
                await span_records.__anext__()
            except StopAsyncIteration:
                has_next_page = False

        return connection_from_cursors_and_nodes(
            cursors_and_nodes,
            has_previous_page=False,
            has_next_page=has_next_page,
        )

    @strawberry.field
    async def sessions(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        first: Optional[int] = DEFAULT_PAGE_SIZE,
        after: Optional[CursorString] = UNSET,
        sort: Optional[ProjectSessionSort] = UNSET,
        filter_io_substring: Optional[str] = UNSET,
    ) -> Connection[ProjectSession]:
        table = models.ProjectSession
        stmt = select(table).filter_by(project_id=self.project_rowid)
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= table.start_time)
            if time_range.end:
                stmt = stmt.where(table.start_time < time_range.end)
        if filter_io_substring:
            filter_subq = (
                stmt.with_only_columns(distinct(table.id).label("id"))
                .join_from(table, models.Trace)
                .join_from(models.Trace, models.Span)
                .where(models.Span.parent_id.is_(None))
                .where(
                    or_(
                        models.TextContains(
                            models.Span.attributes[INPUT_VALUE].as_string(),
                            filter_io_substring,
                        ),
                        models.TextContains(
                            models.Span.attributes[OUTPUT_VALUE].as_string(),
                            filter_io_substring,
                        ),
                    )
                )
            ).subquery()
            stmt = stmt.join(filter_subq, table.id == filter_subq.c.id)
        if sort:
            key: ColumnElement[Any]
            if sort.col is ProjectSessionColumn.startTime:
                key = table.start_time.label("key")
            elif sort.col is ProjectSessionColumn.endTime:
                key = table.end_time.label("key")
            elif (
                sort.col is ProjectSessionColumn.tokenCountTotal
                or sort.col is ProjectSessionColumn.numTraces
            ):
                if sort.col is ProjectSessionColumn.tokenCountTotal:
                    sort_subq = (
                        select(
                            models.Trace.project_session_rowid.label("id"),
                            func.sum(models.Span.cumulative_llm_token_count_total).label("key"),
                        )
                        .join_from(models.Trace, models.Span)
                        .where(models.Span.parent_id.is_(None))
                        .group_by(models.Trace.project_session_rowid)
                    ).subquery()
                elif sort.col is ProjectSessionColumn.numTraces:
                    sort_subq = (
                        select(
                            models.Trace.project_session_rowid.label("id"),
                            func.count(models.Trace.id).label("key"),
                        ).group_by(models.Trace.project_session_rowid)
                    ).subquery()
                else:
                    assert_never(sort.col)
                key = sort_subq.c.key
                stmt = stmt.join(sort_subq, table.id == sort_subq.c.id)
            else:
                assert_never(sort.col)
            stmt = stmt.add_columns(key)
            if sort.dir is SortDir.asc:
                stmt = stmt.order_by(key.asc(), table.id.asc())
            else:
                stmt = stmt.order_by(key.desc(), table.id.desc())
            if after:
                cursor = Cursor.from_string(after)
                assert cursor.sort_column is not None
                compare = operator.lt if sort.dir is SortDir.desc else operator.gt
                stmt = stmt.where(
                    compare(
                        tuple_(key, table.id),
                        (cursor.sort_column.value, cursor.rowid),
                    )
                )
        else:
            stmt = stmt.order_by(table.id.desc())
            if after:
                cursor = Cursor.from_string(after)
                stmt = stmt.where(table.id < cursor.rowid)
        if first:
            stmt = stmt.limit(
                first + 1  # over-fetch by one to determine whether there's a next page
            )
        cursors_and_nodes = []
        async with info.context.db() as session:
            records = await session.stream(stmt)
            async for record in islice(records, first):
                project_session = record[0]
                cursor = Cursor(rowid=project_session.id)
                if sort:
                    assert len(record) > 1
                    cursor.sort_column = CursorSortColumn(
                        type=sort.col.data_type,
                        value=record[1],
                    )
                cursors_and_nodes.append((cursor, to_gql_project_session(project_session)))
            has_next_page = True
            try:
                await records.__anext__()
            except StopAsyncIteration:
                has_next_page = False
        return connection_from_cursors_and_nodes(
            cursors_and_nodes,
            has_previous_page=False,
            has_next_page=has_next_page,
        )

    @strawberry.field(
        description="Names of all available annotations for traces. "
        "(The list contains no duplicates.)"
    )  # type: ignore
    async def trace_annotations_names(
        self,
        info: Info[Context, None],
    ) -> list[str]:
        stmt = (
            select(distinct(models.TraceAnnotation.name))
            .join(models.Trace)
            .where(models.Trace.project_rowid == self.project_rowid)
        )
        async with info.context.db() as session:
            return list(await session.scalars(stmt))

    @strawberry.field(
        description="Names of all available annotations for spans. "
        "(The list contains no duplicates.)"
    )  # type: ignore
    async def span_annotation_names(
        self,
        info: Info[Context, None],
    ) -> list[str]:
        stmt = (
            select(distinct(models.SpanAnnotation.name))
            .join(models.Span)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.project_rowid)
        )
        async with info.context.db() as session:
            return list(await session.scalars(stmt))

    @strawberry.field(
        description="Names of available document evaluations.",
    )  # type: ignore
    async def document_evaluation_names(
        self,
        info: Info[Context, None],
        span_id: Optional[ID] = UNSET,
    ) -> list[str]:
        stmt = (
            select(distinct(models.DocumentAnnotation.name))
            .join(models.Span)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.project_rowid)
            .where(models.DocumentAnnotation.annotator_kind == "LLM")
        )
        if span_id:
            stmt = stmt.where(models.Span.span_id == str(span_id))
        async with info.context.db() as session:
            return list(await session.scalars(stmt))

    @strawberry.field
    async def trace_annotation_summary(
        self,
        info: Info[Context, None],
        annotation_name: str,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[AnnotationSummary]:
        return await info.context.data_loaders.annotation_summaries.load(
            ("trace", self.project_rowid, time_range, None, annotation_name),
        )

    @strawberry.field
    async def span_annotation_summary(
        self,
        info: Info[Context, None],
        annotation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[AnnotationSummary]:
        return await info.context.data_loaders.annotation_summaries.load(
            ("span", self.project_rowid, time_range, filter_condition, annotation_name),
        )

    @strawberry.field
    async def document_evaluation_summary(
        self,
        info: Info[Context, None],
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[DocumentEvaluationSummary]:
        return await info.context.data_loaders.document_evaluation_summaries.load(
            (self.project_rowid, time_range, filter_condition, evaluation_name),
        )

    @strawberry.field
    def streaming_last_updated_at(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        return info.context.last_updated_at.get(self._table, self.project_rowid)

    @strawberry.field
    async def validate_span_filter_condition(
        self,
        info: Info[Context, None],
        condition: str,
    ) -> ValidationResult:
        """Validates a span filter condition by attempting to compile it for both SQLite and PostgreSQL.

        This method checks if the provided filter condition is syntactically valid and can be compiled
        into SQL queries for both SQLite and PostgreSQL databases. It does not execute the query,
        only validates its syntax. Any exception during compilation (syntax errors, invalid expressions,
        etc.) will result in an invalid validation result.

        Args:
            condition (str): The span filter condition string to validate.

        Returns:
            ValidationResult: A result object containing:
                - is_valid (bool): True if the condition is valid, False otherwise
                - error_message (Optional[str]): Error message if validation fails, None if valid
        """  # noqa: E501
        # This query is too expensive to run on every validation
        # valid_eval_names = await self.span_annotation_names()
        try:
            span_filter = SpanFilter(
                condition=condition,
                # valid_eval_names=valid_eval_names,
            )
            stmt = span_filter(select(models.Span))
            dialect = info.context.db.dialect
            if dialect is SupportedSQLDialect.POSTGRESQL:
                str(stmt.compile(dialect=sqlite.dialect()))  # type: ignore[no-untyped-call]
            elif dialect is SupportedSQLDialect.SQLITE:
                str(stmt.compile(dialect=postgresql.dialect()))  # type: ignore[no-untyped-call]
            else:
                assert_never(dialect)
            return ValidationResult(is_valid=True, error_message=None)
        except Exception as e:
            return ValidationResult(
                is_valid=False,
                error_message=str(e),
            )

    @strawberry.field
    async def annotation_configs(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = None,
        after: Optional[str] = None,
        before: Optional[str] = None,
    ) -> Connection[AnnotationConfig]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            annotation_configs = await session.stream_scalars(
                select(models.AnnotationConfig)
                .join(
                    models.ProjectAnnotationConfig,
                    models.AnnotationConfig.id
                    == models.ProjectAnnotationConfig.annotation_config_id,
                )
                .where(models.ProjectAnnotationConfig.project_id == self.project_rowid)
                .order_by(models.AnnotationConfig.name)
            )
            data = [to_gql_annotation_config(config) async for config in annotation_configs]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def trace_retention_policy(
        self,
        info: Info[Context, None],
    ) -> Annotated[ProjectTraceRetentionPolicy, lazy(".ProjectTraceRetentionPolicy")]:
        from .ProjectTraceRetentionPolicy import ProjectTraceRetentionPolicy

        id_ = await info.context.data_loaders.trace_retention_policy_id_by_project_id.load(
            self.project_rowid
        )
        return ProjectTraceRetentionPolicy(id=id_)

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_project:
            created_at = self.db_project.created_at
        else:
            created_at = await info.context.data_loaders.project_fields.load(
                (self.project_rowid, models.Project.created_at),
            )
        return created_at

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_project:
            updated_at = self.db_project.updated_at
        else:
            updated_at = await info.context.data_loaders.project_fields.load(
                (self.project_rowid, models.Project.updated_at),
            )
        return updated_at

    @strawberry.field(
        description="Hourly span count for the project.",
    )  # type: ignore
    async def span_count_time_series(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
    ) -> SpanCountTimeSeries:
        """Returns a time series of span counts grouped by hour for the project.

        This field provides hourly aggregated span counts, which can be useful for
        visualizing span activity over time. The data points represent the number
        of spans that started in each hour.

        Args:
            info: The GraphQL info object containing context information.
            time_range: Optional time range to filter the spans. If provided, only
                spans that started within this range will be counted.

        Returns:
            A SpanCountTimeSeries object containing data points with timestamps
            (rounded to the nearest hour) and corresponding span counts.

        Notes:
            - The timestamps are rounded down to the nearest hour.
            - If a time range is provided, the start time is rounded down to the
              nearest hour, and the end time is rounded up to the nearest hour.
            - The SQL query is optimized for both PostgreSQL and SQLite databases.
        """
        # Determine the appropriate SQL function to truncate timestamps to hours
        # based on the database dialect
        if info.context.db.dialect is SupportedSQLDialect.POSTGRESQL:
            # PostgreSQL uses date_trunc for timestamp truncation
            hour = func.date_trunc("hour", models.Span.start_time)
        elif info.context.db.dialect is SupportedSQLDialect.SQLITE:
            # SQLite uses strftime for timestamp formatting
            hour = func.strftime("%Y-%m-%dT%H:00:00.000+00:00", models.Span.start_time)
        else:
            assert_never(info.context.db.dialect)

        # Build the base query to count spans grouped by hour
        stmt = (
            select(hour, func.count())
            .join(models.Trace)
            .where(models.Trace.project_rowid == self.project_rowid)
            .group_by(hour)
            .order_by(hour)
        )

        # Apply time range filtering if provided
        if time_range:
            if t := time_range.start:
                # Round down to nearest hour for the start time
                start = t.replace(minute=0, second=0, microsecond=0)
                stmt = stmt.where(start <= models.Span.start_time)
            if t := time_range.end:
                # Round up to nearest hour for the end time
                # If the time is already at the start of an hour, use it as is
                if t.minute == 0 and t.second == 0 and t.microsecond == 0:
                    end = t
                else:
                    # Otherwise, round up to the next hour
                    end = t.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
                stmt = stmt.where(models.Span.start_time < end)

        # Execute the query and convert the results to a time series
        async with info.context.db() as session:
            data = await session.stream(stmt)
            return SpanCountTimeSeries(
                data=[
                    TimeSeriesDataPoint(
                        timestamp=_as_datetime(t),
                        value=v,
                    )
                    async for t, v in data
                ]
            )


@strawberry.type
class SpanCountTimeSeries(TimeSeries):
    """A time series of span count"""


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    raise ValueError(f"Cannot convert {value} to datetime")
