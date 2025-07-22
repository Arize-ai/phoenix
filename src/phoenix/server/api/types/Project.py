from __future__ import annotations

import operator
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Annotated, Any, ClassVar, Literal, Optional, cast

import strawberry
from aioitertools.itertools import groupby, islice
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, case, desc, distinct, exists, func, or_, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.expression import tuple_
from sqlalchemy.sql.functions import percentile_cont
from strawberry import ID, UNSET, Private, lazy
from strawberry.relay import Connection, Edge, Node, NodeID, PageInfo
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.datetime_utils import get_timestamp_range, normalize_datetime, right_open_time_range
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, date_trunc
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.ProjectSessionSort import (
    ProjectSessionColumn,
    ProjectSessionSort,
)
from phoenix.server.api.input_types.SpanSort import SpanColumn, SpanSort, SpanSortConfig
from phoenix.server.api.input_types.TimeBinConfig import TimeBinConfig, TimeBinScale
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.AnnotationConfig import AnnotationConfig, to_gql_annotation_config
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.DocumentEvaluationSummary import DocumentEvaluationSummary
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
    CursorString,
    connection_from_cursors_and_nodes,
    connection_from_list,
)
from phoenix.server.api.types.ProjectSession import ProjectSession, to_gql_project_session
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary
from phoenix.server.api.types.TimeSeries import TimeSeries, TimeSeriesDataPoint
from phoenix.server.api.types.Trace import Trace
from phoenix.server.api.types.ValidationResult import ValidationResult
from phoenix.server.types import DbSessionFactory
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
    async def cost_summary(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> SpanCostSummary:
        loader = info.context.data_loaders.span_cost_summary_by_project
        summary = await loader.load((self.project_rowid, time_range, filter_condition))
        return SpanCostSummary(
            prompt=CostBreakdown(
                tokens=summary.prompt.tokens,
                cost=summary.prompt.cost,
            ),
            completion=CostBreakdown(
                tokens=summary.completion.tokens,
                cost=summary.completion.cost,
            ),
            total=CostBreakdown(
                tokens=summary.total.tokens,
                cost=summary.total.cost,
            ),
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
        if root_spans_only and not filter_condition and sort and sort.col is SpanColumn.startTime:
            return await _paginate_span_by_trace_start_time(
                db=info.context.db,
                project_rowid=self.project_rowid,
                time_range=time_range,
                first=first,
                after=after,
                sort=sort,
                orphan_span_as_root_span=orphan_span_as_root_span,
            )
        stmt = (
            select(models.Span.id)
            .select_from(models.Span)
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
        session_id: Optional[str] = UNSET,
    ) -> Connection[ProjectSession]:
        table = models.ProjectSession
        if session_id:
            async with info.context.db() as session:
                ans = await session.scalar(
                    select(table).filter_by(
                        session_id=session_id,
                        project_id=self.project_rowid,
                    )
                )
            if ans:
                return connection_from_list(
                    data=[to_gql_project_session(ans)],
                    args=ConnectionArgs(),
                )
            elif not filter_io_substring:
                return connection_from_list(
                    data=[],
                    args=ConnectionArgs(),
                )
        stmt = select(table).filter_by(project_id=self.project_rowid)
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= table.start_time)
            if time_range.end:
                stmt = stmt.where(table.start_time < time_range.end)
        if filter_io_substring:
            filter_stmt = (
                select(distinct(models.Trace.project_session_rowid).label("id"))
                .filter_by(project_rowid=self.project_rowid)
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
            )
            if time_range:
                if time_range.start:
                    filter_stmt = filter_stmt.where(time_range.start <= models.Trace.start_time)
                if time_range.end:
                    filter_stmt = filter_stmt.where(models.Trace.start_time < time_range.end)
            filter_subq = filter_stmt.subquery()
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
            elif sort.col is ProjectSessionColumn.costTotal:
                sort_subq = (
                    select(
                        models.Trace.project_session_rowid.label("id"),
                        func.sum(models.SpanCost.total_cost).label("key"),
                    )
                    .join_from(
                        models.Trace,
                        models.SpanCost,
                        models.Trace.id == models.SpanCost.trace_rowid,
                    )
                    .group_by(models.Trace.project_session_rowid)
                ).subquery()
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
        loader = info.context.data_loaders.annotation_configs_by_project
        configs = await loader.load(self.project_rowid)
        data = [to_gql_annotation_config(config) for config in configs]
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

    @strawberry.field
    async def span_count_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> SpanCountTimeSeries:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        dialect = info.context.db.dialect
        utc_offset_minutes = 0
        field: Literal["minute", "hour", "day", "week", "month", "year"] = "hour"
        if time_bin_config:
            utc_offset_minutes = time_bin_config.utc_offset_minutes
            if time_bin_config.scale is TimeBinScale.MINUTE:
                field = "minute"
            elif time_bin_config.scale is TimeBinScale.HOUR:
                field = "hour"
            elif time_bin_config.scale is TimeBinScale.DAY:
                field = "day"
            elif time_bin_config.scale is TimeBinScale.WEEK:
                field = "week"
            elif time_bin_config.scale is TimeBinScale.MONTH:
                field = "month"
            elif time_bin_config.scale is TimeBinScale.YEAR:
                field = "year"
        bucket = date_trunc(dialect, field, models.Span.start_time, utc_offset_minutes)
        stmt = (
            select(
                bucket,
                func.count(models.Span.id).label("total_count"),
                func.sum(case((models.Span.status_code == "OK", 1), else_=0)).label("ok_count"),
                func.sum(case((models.Span.status_code == "ERROR", 1), else_=0)).label(
                    "error_count"
                ),
                func.sum(case((models.Span.status_code == "UNSET", 1), else_=0)).label(
                    "unset_count"
                ),
            )
            .join_from(models.Span, models.Trace)
            .where(models.Trace.project_rowid == self.project_rowid)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range.start:
            stmt = stmt.where(time_range.start <= models.Span.start_time)
        if time_range.end:
            stmt = stmt.where(models.Span.start_time < time_range.end)
        if filter_condition:
            span_filter = SpanFilter(condition=filter_condition)
            stmt = span_filter(stmt)

        data = {}
        async with info.context.db() as session:
            async for t, total_count, ok_count, error_count, unset_count in await session.stream(
                stmt
            ):
                timestamp = _as_datetime(t)
                data[timestamp] = SpanCountTimeSeriesDataPoint(
                    timestamp=timestamp,
                    ok_count=ok_count,
                    error_count=error_count,
                    unset_count=unset_count,
                    total_count=total_count,
                )

        data_timestamps: list[datetime] = [data_point.timestamp for data_point in data.values()]
        min_time = min([*data_timestamps, time_range.start])
        max_time = max(
            [
                *data_timestamps,
                *([time_range.end] if time_range.end else [datetime.now(timezone.utc)]),
            ],
        )
        for timestamp in get_timestamp_range(
            start_time=min_time,
            end_time=max_time,
            stride=field,
            utc_offset_minutes=utc_offset_minutes,
        ):
            if timestamp not in data:
                data[timestamp] = SpanCountTimeSeriesDataPoint(timestamp=timestamp)
        return SpanCountTimeSeries(data=sorted(data.values(), key=lambda x: x.timestamp))

    @strawberry.field
    async def trace_count_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> TraceCountTimeSeries:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        dialect = info.context.db.dialect
        utc_offset_minutes = 0
        field: Literal["minute", "hour", "day", "week", "month", "year"] = "hour"
        if time_bin_config:
            utc_offset_minutes = time_bin_config.utc_offset_minutes
            if time_bin_config.scale is TimeBinScale.MINUTE:
                field = "minute"
            elif time_bin_config.scale is TimeBinScale.HOUR:
                field = "hour"
            elif time_bin_config.scale is TimeBinScale.DAY:
                field = "day"
            elif time_bin_config.scale is TimeBinScale.WEEK:
                field = "week"
            elif time_bin_config.scale is TimeBinScale.MONTH:
                field = "month"
            elif time_bin_config.scale is TimeBinScale.YEAR:
                field = "year"
        bucket = date_trunc(dialect, field, models.Trace.start_time, utc_offset_minutes)
        stmt = (
            select(bucket, func.count(models.Trace.id))
            .where(models.Trace.project_rowid == self.project_rowid)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        data = {}
        async with info.context.db() as session:
            async for t, v in await session.stream(stmt):
                timestamp = _as_datetime(t)
                data[timestamp] = TimeSeriesDataPoint(timestamp=timestamp, value=v)

        data_timestamps: list[datetime] = [data_point.timestamp for data_point in data.values()]
        min_time = min([*data_timestamps, time_range.start])
        max_time = max(
            [
                *data_timestamps,
                *([time_range.end] if time_range.end else [datetime.now(timezone.utc)]),
            ],
        )
        for timestamp in get_timestamp_range(
            start_time=min_time,
            end_time=max_time,
            stride=field,
            utc_offset_minutes=utc_offset_minutes,
        ):
            if timestamp not in data:
                data[timestamp] = TimeSeriesDataPoint(timestamp=timestamp)
        return TraceCountTimeSeries(data=sorted(data.values(), key=lambda x: x.timestamp))

    @strawberry.field
    async def trace_count_by_status_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> TraceCountByStatusTimeSeries:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        dialect = info.context.db.dialect
        utc_offset_minutes = 0
        field: Literal["minute", "hour", "day", "week", "month", "year"] = "hour"
        if time_bin_config:
            utc_offset_minutes = time_bin_config.utc_offset_minutes
            if time_bin_config.scale is TimeBinScale.MINUTE:
                field = "minute"
            elif time_bin_config.scale is TimeBinScale.HOUR:
                field = "hour"
            elif time_bin_config.scale is TimeBinScale.DAY:
                field = "day"
            elif time_bin_config.scale is TimeBinScale.WEEK:
                field = "week"
            elif time_bin_config.scale is TimeBinScale.MONTH:
                field = "month"
            elif time_bin_config.scale is TimeBinScale.YEAR:
                field = "year"
        bucket = date_trunc(dialect, field, models.Trace.start_time, utc_offset_minutes)
        trace_error_status_counts = (
            select(
                models.Span.trace_rowid,
            )
            .where(models.Span.parent_id.is_(None))
            .group_by(models.Span.trace_rowid)
            .having(func.max(models.Span.cumulative_error_count) > 0)
        ).subquery()
        stmt = (
            select(
                bucket,
                func.count(models.Trace.id).label("total_count"),
                func.coalesce(func.count(trace_error_status_counts.c.trace_rowid), 0).label(
                    "error_count"
                ),
            )
            .join_from(
                models.Trace,
                trace_error_status_counts,
                onclause=trace_error_status_counts.c.trace_rowid == models.Trace.id,
                isouter=True,
            )
            .where(models.Trace.project_rowid == self.project_rowid)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        data: dict[datetime, TraceCountByStatusTimeSeriesDataPoint] = {}
        async with info.context.db() as session:
            async for t, total_count, error_count in await session.stream(stmt):
                timestamp = _as_datetime(t)
                data[timestamp] = TraceCountByStatusTimeSeriesDataPoint(
                    timestamp=timestamp,
                    ok_count=total_count - error_count,
                    error_count=error_count,
                    total_count=total_count,
                )

        data_timestamps: list[datetime] = [data_point.timestamp for data_point in data.values()]
        min_time = min([*data_timestamps, time_range.start])
        max_time = max(
            [
                *data_timestamps,
                *([time_range.end] if time_range.end else [datetime.now(timezone.utc)]),
            ],
        )
        for timestamp in get_timestamp_range(
            start_time=min_time,
            end_time=max_time,
            stride=field,
            utc_offset_minutes=utc_offset_minutes,
        ):
            if timestamp not in data:
                data[timestamp] = TraceCountByStatusTimeSeriesDataPoint(
                    timestamp=timestamp,
                    ok_count=0,
                    error_count=0,
                    total_count=0,
                )
        return TraceCountByStatusTimeSeries(data=sorted(data.values(), key=lambda x: x.timestamp))

    @strawberry.field
    async def trace_latency_ms_percentile_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> TraceLatencyPercentileTimeSeries:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        dialect = info.context.db.dialect
        utc_offset_minutes = 0
        field: Literal["minute", "hour", "day", "week", "month", "year"] = "hour"
        if time_bin_config:
            utc_offset_minutes = time_bin_config.utc_offset_minutes
            if time_bin_config.scale is TimeBinScale.MINUTE:
                field = "minute"
            elif time_bin_config.scale is TimeBinScale.HOUR:
                field = "hour"
            elif time_bin_config.scale is TimeBinScale.DAY:
                field = "day"
            elif time_bin_config.scale is TimeBinScale.WEEK:
                field = "week"
            elif time_bin_config.scale is TimeBinScale.MONTH:
                field = "month"
            elif time_bin_config.scale is TimeBinScale.YEAR:
                field = "year"
        bucket = date_trunc(dialect, field, models.Trace.start_time, utc_offset_minutes)

        stmt = select(bucket).where(models.Trace.project_rowid == self.project_rowid)
        if time_range.start:
            stmt = stmt.where(time_range.start <= models.Trace.start_time)
        if time_range.end:
            stmt = stmt.where(models.Trace.start_time < time_range.end)

        if dialect is SupportedSQLDialect.POSTGRESQL:
            stmt = stmt.add_columns(
                percentile_cont(0.50).within_group(models.Trace.latency_ms.asc()).label("p50"),
                percentile_cont(0.75).within_group(models.Trace.latency_ms.asc()).label("p75"),
                percentile_cont(0.90).within_group(models.Trace.latency_ms.asc()).label("p90"),
                percentile_cont(0.95).within_group(models.Trace.latency_ms.asc()).label("p95"),
                percentile_cont(0.99).within_group(models.Trace.latency_ms.asc()).label("p99"),
                percentile_cont(0.999).within_group(models.Trace.latency_ms.asc()).label("p999"),
                func.max(models.Trace.latency_ms).label("max"),
            )
        elif dialect is SupportedSQLDialect.SQLITE:
            stmt = stmt.add_columns(
                func.percentile(models.Trace.latency_ms, 50).label("p50"),
                func.percentile(models.Trace.latency_ms, 75).label("p75"),
                func.percentile(models.Trace.latency_ms, 90).label("p90"),
                func.percentile(models.Trace.latency_ms, 95).label("p95"),
                func.percentile(models.Trace.latency_ms, 99).label("p99"),
                func.percentile(models.Trace.latency_ms, 99.9).label("p999"),
                func.max(models.Trace.latency_ms).label("max"),
            )
        else:
            assert_never(dialect)

        stmt = stmt.group_by(bucket).order_by(bucket)

        data: dict[datetime, TraceLatencyMsPercentileTimeSeriesDataPoint] = {}
        async with info.context.db() as session:
            async for (
                bucket_time,
                p50,
                p75,
                p90,
                p95,
                p99,
                p999,
                max_latency,
            ) in await session.stream(stmt):
                timestamp = _as_datetime(bucket_time)
                data[timestamp] = TraceLatencyMsPercentileTimeSeriesDataPoint(
                    timestamp=timestamp,
                    p50=p50,
                    p75=p75,
                    p90=p90,
                    p95=p95,
                    p99=p99,
                    p999=p999,
                    max=max_latency,
                )

        data_timestamps: list[datetime] = [data_point.timestamp for data_point in data.values()]
        min_time = min([*data_timestamps, time_range.start])
        max_time = max(
            [
                *data_timestamps,
                *([time_range.end] if time_range.end else [datetime.now(timezone.utc)]),
            ],
        )
        for timestamp in get_timestamp_range(
            start_time=min_time,
            end_time=max_time,
            stride=field,
            utc_offset_minutes=utc_offset_minutes,
        ):
            if timestamp not in data:
                data[timestamp] = TraceLatencyMsPercentileTimeSeriesDataPoint(timestamp=timestamp)
        return TraceLatencyPercentileTimeSeries(
            data=sorted(data.values(), key=lambda x: x.timestamp)
        )

    @strawberry.field
    async def trace_token_count_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> TraceTokenCountTimeSeries:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        dialect = info.context.db.dialect
        utc_offset_minutes = 0
        field: Literal["minute", "hour", "day", "week", "month", "year"] = "hour"
        if time_bin_config:
            utc_offset_minutes = time_bin_config.utc_offset_minutes
            if time_bin_config.scale is TimeBinScale.MINUTE:
                field = "minute"
            elif time_bin_config.scale is TimeBinScale.HOUR:
                field = "hour"
            elif time_bin_config.scale is TimeBinScale.DAY:
                field = "day"
            elif time_bin_config.scale is TimeBinScale.WEEK:
                field = "week"
            elif time_bin_config.scale is TimeBinScale.MONTH:
                field = "month"
            elif time_bin_config.scale is TimeBinScale.YEAR:
                field = "year"
        bucket = date_trunc(dialect, field, models.Trace.start_time, utc_offset_minutes)
        stmt = (
            select(
                bucket,
                func.sum(models.SpanCost.total_tokens),
                func.sum(models.SpanCost.prompt_tokens),
                func.sum(models.SpanCost.completion_tokens),
            )
            .join_from(
                models.Trace,
                models.SpanCost,
                onclause=models.SpanCost.trace_rowid == models.Trace.id,
            )
            .where(models.Trace.project_rowid == self.project_rowid)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        data: dict[datetime, TraceTokenCountTimeSeriesDataPoint] = {}
        async with info.context.db() as session:
            async for (
                t,
                total_tokens,
                prompt_tokens,
                completion_tokens,
            ) in await session.stream(stmt):
                timestamp = _as_datetime(t)
                data[timestamp] = TraceTokenCountTimeSeriesDataPoint(
                    timestamp=timestamp,
                    prompt_token_count=prompt_tokens,
                    completion_token_count=completion_tokens,
                    total_token_count=total_tokens,
                )

        data_timestamps: list[datetime] = [data_point.timestamp for data_point in data.values()]
        min_time = min([*data_timestamps, time_range.start])
        max_time = max(
            [
                *data_timestamps,
                *([time_range.end] if time_range.end else [datetime.now(timezone.utc)]),
            ],
        )
        for timestamp in get_timestamp_range(
            start_time=min_time,
            end_time=max_time,
            stride=field,
            utc_offset_minutes=utc_offset_minutes,
        ):
            if timestamp not in data:
                data[timestamp] = TraceTokenCountTimeSeriesDataPoint(timestamp=timestamp)
        return TraceTokenCountTimeSeries(data=sorted(data.values(), key=lambda x: x.timestamp))

    @strawberry.field
    async def trace_token_cost_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> TraceTokenCostTimeSeries:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        dialect = info.context.db.dialect
        utc_offset_minutes = 0
        field: Literal["minute", "hour", "day", "week", "month", "year"] = "hour"
        if time_bin_config:
            utc_offset_minutes = time_bin_config.utc_offset_minutes
            if time_bin_config.scale is TimeBinScale.MINUTE:
                field = "minute"
            elif time_bin_config.scale is TimeBinScale.HOUR:
                field = "hour"
            elif time_bin_config.scale is TimeBinScale.DAY:
                field = "day"
            elif time_bin_config.scale is TimeBinScale.WEEK:
                field = "week"
            elif time_bin_config.scale is TimeBinScale.MONTH:
                field = "month"
            elif time_bin_config.scale is TimeBinScale.YEAR:
                field = "year"
        bucket = date_trunc(dialect, field, models.Trace.start_time, utc_offset_minutes)
        stmt = (
            select(
                bucket,
                func.sum(models.SpanCost.total_cost),
                func.sum(models.SpanCost.prompt_cost),
                func.sum(models.SpanCost.completion_cost),
            )
            .join_from(
                models.Trace,
                models.SpanCost,
                onclause=models.SpanCost.trace_rowid == models.Trace.id,
            )
            .where(models.Trace.project_rowid == self.project_rowid)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        data: dict[datetime, TraceTokenCostTimeSeriesDataPoint] = {}
        async with info.context.db() as session:
            async for (
                t,
                total_cost,
                prompt_cost,
                completion_cost,
            ) in await session.stream(stmt):
                timestamp = _as_datetime(t)
                data[timestamp] = TraceTokenCostTimeSeriesDataPoint(
                    timestamp=timestamp,
                    prompt_cost=prompt_cost,
                    completion_cost=completion_cost,
                    total_cost=total_cost,
                )

        data_timestamps: list[datetime] = [data_point.timestamp for data_point in data.values()]
        min_time = min([*data_timestamps, time_range.start])
        max_time = max(
            [
                *data_timestamps,
                *([time_range.end] if time_range.end else [datetime.now(timezone.utc)]),
            ],
        )
        for timestamp in get_timestamp_range(
            start_time=min_time,
            end_time=max_time,
            stride=field,
            utc_offset_minutes=utc_offset_minutes,
        ):
            if timestamp not in data:
                data[timestamp] = TraceTokenCostTimeSeriesDataPoint(timestamp=timestamp)
        return TraceTokenCostTimeSeries(data=sorted(data.values(), key=lambda x: x.timestamp))

    @strawberry.field
    async def span_annotation_score_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> SpanAnnotationScoreTimeSeries:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        dialect = info.context.db.dialect
        utc_offset_minutes = 0
        field: Literal["minute", "hour", "day", "week", "month", "year"] = "hour"
        if time_bin_config:
            utc_offset_minutes = time_bin_config.utc_offset_minutes
            if time_bin_config.scale is TimeBinScale.MINUTE:
                field = "minute"
            elif time_bin_config.scale is TimeBinScale.HOUR:
                field = "hour"
            elif time_bin_config.scale is TimeBinScale.DAY:
                field = "day"
            elif time_bin_config.scale is TimeBinScale.WEEK:
                field = "week"
            elif time_bin_config.scale is TimeBinScale.MONTH:
                field = "month"
            elif time_bin_config.scale is TimeBinScale.YEAR:
                field = "year"
        bucket = date_trunc(dialect, field, models.Trace.start_time, utc_offset_minutes)
        stmt = (
            select(
                bucket,
                models.SpanAnnotation.name,
                func.avg(models.SpanAnnotation.score).label("average_score"),
            )
            .join_from(
                models.SpanAnnotation,
                models.Span,
                onclause=models.SpanAnnotation.span_rowid == models.Span.id,
            )
            .join_from(
                models.Span,
                models.Trace,
                onclause=models.Span.trace_rowid == models.Trace.id,
            )
            .where(models.Trace.project_rowid == self.project_rowid)
            .group_by(bucket, models.SpanAnnotation.name)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        scores: dict[datetime, dict[str, float]] = {}
        unique_names: set[str] = set()
        async with info.context.db() as session:
            async for (
                t,
                name,
                average_score,
            ) in await session.stream(stmt):
                timestamp = _as_datetime(t)
                if timestamp not in scores:
                    scores[timestamp] = {}
                scores[timestamp][name] = average_score
                unique_names.add(name)

        score_timestamps: list[datetime] = [timestamp for timestamp in scores]
        min_time = min([*score_timestamps, time_range.start])
        max_time = max(
            [
                *score_timestamps,
                *([time_range.end] if time_range.end else [datetime.now(timezone.utc)]),
            ],
        )
        data: dict[datetime, SpanAnnotationScoreTimeSeriesDataPoint] = {
            timestamp: SpanAnnotationScoreTimeSeriesDataPoint(
                timestamp=timestamp,
                scores_with_labels=[
                    SpanAnnotationScoreWithLabel(label=label, score=scores[timestamp][label])
                    for label in scores[timestamp]
                ],
            )
            for timestamp in score_timestamps
        }
        for timestamp in get_timestamp_range(
            start_time=min_time,
            end_time=max_time,
            stride=field,
            utc_offset_minutes=utc_offset_minutes,
        ):
            if timestamp not in data:
                data[timestamp] = SpanAnnotationScoreTimeSeriesDataPoint(
                    timestamp=timestamp,
                    scores_with_labels=[],
                )
        return SpanAnnotationScoreTimeSeries(
            data=sorted(data.values(), key=lambda x: x.timestamp),
            names=sorted(list(unique_names)),
        )


@strawberry.type
class SpanCountTimeSeriesDataPoint:
    timestamp: datetime
    ok_count: Optional[int] = None
    error_count: Optional[int] = None
    unset_count: Optional[int] = None
    total_count: Optional[int] = None


@strawberry.type
class SpanCountTimeSeries:
    data: list[SpanCountTimeSeriesDataPoint]


@strawberry.type
class TraceCountTimeSeries(TimeSeries):
    """A time series of trace count"""


@strawberry.type
class TraceCountByStatusTimeSeriesDataPoint:
    timestamp: datetime
    ok_count: int
    error_count: int
    total_count: int


@strawberry.type
class TraceCountByStatusTimeSeries:
    data: list[TraceCountByStatusTimeSeriesDataPoint]


@strawberry.type
class TraceLatencyMsPercentileTimeSeriesDataPoint:
    timestamp: datetime
    p50: Optional[float] = None
    p75: Optional[float] = None
    p90: Optional[float] = None
    p95: Optional[float] = None
    p99: Optional[float] = None
    p999: Optional[float] = None
    max: Optional[float] = None


@strawberry.type
class TraceLatencyPercentileTimeSeries:
    data: list[TraceLatencyMsPercentileTimeSeriesDataPoint]


@strawberry.type
class TraceTokenCountTimeSeriesDataPoint:
    timestamp: datetime
    prompt_token_count: Optional[float] = None
    completion_token_count: Optional[float] = None
    total_token_count: Optional[float] = None


@strawberry.type
class TraceTokenCountTimeSeries:
    data: list[TraceTokenCountTimeSeriesDataPoint]


@strawberry.type
class TraceTokenCostTimeSeriesDataPoint:
    timestamp: datetime
    prompt_cost: Optional[float] = None
    completion_cost: Optional[float] = None
    total_cost: Optional[float] = None


@strawberry.type
class TraceTokenCostTimeSeries:
    data: list[TraceTokenCostTimeSeriesDataPoint]


@strawberry.type
class SpanAnnotationScoreWithLabel:
    label: str
    score: float


@strawberry.type
class SpanAnnotationScoreTimeSeriesDataPoint:
    timestamp: datetime
    scores_with_labels: list[SpanAnnotationScoreWithLabel]


@strawberry.type
class SpanAnnotationScoreTimeSeries:
    data: list[SpanAnnotationScoreTimeSeriesDataPoint]
    names: list[str]


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return cast(datetime, normalize_datetime(datetime.fromisoformat(value), timezone.utc))
    raise ValueError(f"Cannot convert {value} to datetime")


async def _paginate_span_by_trace_start_time(
    db: DbSessionFactory,
    project_rowid: int,
    time_range: Optional[TimeRange] = None,
    first: Optional[int] = DEFAULT_PAGE_SIZE,
    after: Optional[CursorString] = None,
    sort: SpanSort = SpanSort(col=SpanColumn.startTime, dir=SortDir.desc),
    orphan_span_as_root_span: Optional[bool] = True,
    retries: int = 3,
) -> Connection[Span]:
    """Return one representative root span per trace, ordered by trace start time.

    **Note**: Despite the function name, cursors are based on trace rowids, not span rowids.
    This is because we paginate by traces (one span per trace), not individual spans.

    **Important**: The edges list can be empty while has_next_page=True. This happens
    when traces exist but have no matching root spans. Pagination continues because there
    may be more traces ahead with spans.

    Args:
        db: Database session factory.
        project_rowid: Project ID to query spans from.
        time_range: Optional time range filter on trace start times.
        first: Maximum number of edges to return (default: DEFAULT_PAGE_SIZE).
        after: Cursor for pagination (points to trace position, not span).
        sort: Sort by trace start time (asc/desc only).
        orphan_span_as_root_span: Whether to include orphan spans as root spans.
            True: spans with parent_id=NULL OR pointing to non-existent spans.
            False: only spans with parent_id=NULL.
        retries: Maximum number of retry attempts when insufficient edges are found.
            When traces exist but lack root spans, the function retries pagination
            to find traces with spans. Set to 0 to disable retries.

    Returns:
        Connection[Span] with:
        - edges: At most one Edge per trace (may be empty list).
        - page_info: Pagination info based on trace positions.

    Key Points:
        - Traces without root spans produce NO edges
        - Spans ordered by trace start time, not span start time
        - Cursors track trace positions for efficient large-scale pagination
    """
    # Build base trace query ordered by start time
    traces = select(
        models.Trace.id,
        models.Trace.start_time,
    ).where(models.Trace.project_rowid == project_rowid)
    if sort.dir is SortDir.desc:
        traces = traces.order_by(
            models.Trace.start_time.desc(),
            models.Trace.id.desc(),
        )
    else:
        traces = traces.order_by(
            models.Trace.start_time.asc(),
            models.Trace.id.asc(),
        )

    # Apply time range filters
    if time_range:
        if time_range.start:
            traces = traces.where(time_range.start <= models.Trace.start_time)
        if time_range.end:
            traces = traces.where(models.Trace.start_time < time_range.end)

    # Apply cursor pagination
    if after:
        cursor = Cursor.from_string(after)
        assert cursor.sort_column
        compare = operator.lt if sort.dir is SortDir.desc else operator.gt
        traces = traces.where(
            compare(
                tuple_(models.Trace.start_time, models.Trace.id),
                (cursor.sort_column.value, cursor.rowid),
            )
        )

    # Limit for pagination
    if first:
        traces = traces.limit(
            first + 1  # over-fetch by one to determine whether there's a next page
        )
    traces_cte = traces.cte()

    # Define join condition for root spans
    if orphan_span_as_root_span:
        # Include both NULL parent_id and orphaned spans
        parent_spans = select(models.Span.span_id).alias("parent_spans")
        onclause = and_(
            models.Span.trace_rowid == traces_cte.c.id,
            or_(
                models.Span.parent_id.is_(None),
                ~exists().where(models.Span.parent_id == parent_spans.c.span_id),
            ),
        )
    else:
        # Only spans with no parent (parent_id is NULL, excludes orphaned spans)
        onclause = and_(
            models.Span.trace_rowid == traces_cte.c.id,
            models.Span.parent_id.is_(None),
        )

    # Join traces with root spans (left join allows traces without spans)
    stmt = select(
        traces_cte.c.id,
        traces_cte.c.start_time,
        models.Span.id,
    ).join_from(
        traces_cte,
        models.Span,
        onclause=onclause,
        isouter=True,
    )

    # Order by trace time, then pick earliest span per trace
    if sort.dir is SortDir.desc:
        stmt = stmt.order_by(
            traces_cte.c.start_time.desc(),
            traces_cte.c.id.desc(),
            models.Span.start_time.asc(),  # earliest span
            models.Span.id.desc(),
        )
    else:
        stmt = stmt.order_by(
            traces_cte.c.start_time.asc(),
            traces_cte.c.id.asc(),
            models.Span.start_time.asc(),  # earliest span
            models.Span.id.desc(),
        )

    # Use DISTINCT for PostgreSQL, manual grouping for SQLite
    if db.dialect is SupportedSQLDialect.POSTGRESQL:
        stmt = stmt.distinct(traces_cte.c.start_time, traces_cte.c.id)
    elif db.dialect is SupportedSQLDialect.SQLITE:
        # too complicated for SQLite, so we rely on groupby() below
        pass
    else:
        assert_never(db.dialect)

    # Process results and build edges
    edges: list[Edge[Span]] = []
    start_cursor: Optional[str] = None
    end_cursor: Optional[str] = None
    async with db() as session:
        records = groupby(await session.stream(stmt), key=lambda record: record[:2])
        async for (trace_rowid, trace_start_time), group in islice(records, first):
            cursor = Cursor(
                rowid=trace_rowid,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=trace_start_time,
                ),
            )
            if start_cursor is None:
                start_cursor = str(cursor)
            end_cursor = str(cursor)
            first_record = group[0]
            # Only create edge if trace has a root span
            if (span_rowid := first_record[2]) is not None:
                edges.append(Edge(node=Span(span_rowid=span_rowid), cursor=str(cursor)))
        has_next_page = True
        try:
            await records.__anext__()
        except StopAsyncIteration:
            has_next_page = False

    # Retry if we need more edges and more traces exist
    if first and len(edges) < first and has_next_page:
        while retries and (num_needed := first - len(edges)) and has_next_page:
            retries -= 1
            batch_size = max(first, 1000)
            more = await _paginate_span_by_trace_start_time(
                db=db,
                project_rowid=project_rowid,
                time_range=time_range,
                first=batch_size,
                after=end_cursor,
                sort=sort,
                orphan_span_as_root_span=orphan_span_as_root_span,
                retries=0,
            )
            edges.extend(more.edges[:num_needed])
            start_cursor = start_cursor or more.page_info.start_cursor
            end_cursor = more.page_info.end_cursor if len(edges) < first else edges[-1].cursor
            has_next_page = len(more.edges) > num_needed or more.page_info.has_next_page

    return Connection(
        edges=edges,
        page_info=PageInfo(
            start_cursor=start_cursor,
            end_cursor=end_cursor,
            has_previous_page=False,
            has_next_page=has_next_page,
        ),
    )


def to_gql_project(project: models.Project) -> Project:
    """
    Converts an ORM project to a GraphQL project.
    """
    return Project(
        project_rowid=project.id,
        db_project=project,
    )
