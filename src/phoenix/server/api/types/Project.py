import operator
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Annotated, Any, Literal, Optional, cast

import strawberry
from aioitertools.itertools import groupby, islice
from openinference.semconv.trace import SpanAttributes
from pandas import DataFrame
from sqlalchemy import Select, and_, case, desc, distinct, exists, false, func, or_, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.expression import tuple_
from sqlalchemy.sql.functions import percentile_cont
from strawberry import ID, UNSET, lazy
from strawberry.relay import Connection, Edge, GlobalID, Node, NodeID, PageInfo
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.datetime_utils import get_timestamp_range, normalize_datetime, right_open_time_range
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, date_trunc
from phoenix.server.api.annotation_metrics import build_entity_weighted_annotation_metrics_stmt
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.extensions import RequireForwardPaginationExtension
from phoenix.server.api.input_types.ProjectSessionSort import (
    ProjectSessionSort,
    ProjectSessionSortConfig,
)
from phoenix.server.api.input_types.SpanSort import SpanColumn, SpanSort, SpanSortConfig
from phoenix.server.api.input_types.TimeBinConfig import TimeBinConfig, TimeBinScale
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.AnnotationConfig import AnnotationConfig, to_gql_annotation_config
from phoenix.server.api.types.AnnotationNameCount import AnnotationNameCount
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.DocumentEvaluationSummary import DocumentEvaluationSummary
from phoenix.server.api.types.GenerativeModel import GenerativeModel
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
    CursorString,
    connection_from_cursors_and_nodes,
    connection_from_list,
)
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary
from phoenix.server.api.types.TimeSeries import TimeSeries, TimeSeriesDataPoint
from phoenix.server.api.types.Trace import Trace
from phoenix.server.api.types.ValidationResult import ValidationResult
from phoenix.server.session_filters import get_filtered_session_rowids_subquery
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanFilter

DEFAULT_PAGE_SIZE = 30
_TOKEN_COUNT_DETAIL_EPSILON = 1e-9
_TOKEN_COUNT_DETAIL_SORT_ORDER = {
    "input": 0,
    "output": 0,
    "cache_read": 1,
    "cache_write": 2,
    "reasoning": 3,
    "audio": 4,
}
if TYPE_CHECKING:
    from phoenix.server.api.types.ProjectTraceRetentionPolicy import ProjectTraceRetentionPolicy


def _merge_token_count_detail(
    details: list["TraceTokenCountDetailsTimeSeriesEntry"],
    token_type: str,
    token_count: float,
) -> None:
    """Add ``token_count`` tokens of ``token_type`` into ``details`` in place.

    If an entry for ``token_type`` already exists, its count is incremented;
    otherwise a new entry is appended. Contributions at or below
    ``_TOKEN_COUNT_DETAIL_EPSILON`` are ignored so the breakdown does not
    accumulate entries that round to zero.
    """
    if token_count <= _TOKEN_COUNT_DETAIL_EPSILON:
        return
    for detail in details:
        if detail.token_type == token_type:
            detail.token_count = (detail.token_count or 0) + token_count
            return
    details.append(
        TraceTokenCountDetailsTimeSeriesEntry(
            token_type=token_type,
            token_count=token_count,
        )
    )


def _ensure_token_count_details_total(
    details: list["TraceTokenCountDetailsTimeSeriesEntry"],
    total_token_count: Optional[float],
    default_token_type: str,
) -> None:
    """Reconcile the per-type breakdown against the authoritative total.

    The detail rows may not account for every token in ``total_token_count``
    (the totals query is the source of truth, the breakdown only refines it).
    Any unaccounted remainder is folded into ``default_token_type`` (e.g.
    ``"input"`` for prompts, ``"output"`` for completions) so the entries sum
    to the total. Does nothing when the total is unknown or already covered.
    """
    if total_token_count is None:
        return
    detail_token_count = sum(detail.token_count or 0 for detail in details)
    remainder = total_token_count - detail_token_count
    if remainder > _TOKEN_COUNT_DETAIL_EPSILON:
        _merge_token_count_detail(details, default_token_type, remainder)


def _sort_token_count_details(details: list["TraceTokenCountDetailsTimeSeriesEntry"]) -> None:
    """Sort ``details`` in place into display order.

    Entries are ordered by the rank in ``_TOKEN_COUNT_DETAIL_SORT_ORDER``;
    unrecognized token types sort last and are then ordered alphabetically.
    """
    details.sort(
        key=lambda detail: (
            _TOKEN_COUNT_DETAIL_SORT_ORDER.get(
                detail.token_type, len(_TOKEN_COUNT_DETAIL_SORT_ORDER)
            ),
            detail.token_type,
        )
    )


async def _annotation_name_counts(
    info: Info[Context, None], stmt: Select[Any]
) -> list[AnnotationNameCount]:
    """Run a ``(name, count)`` aggregation query and map it to ``AnnotationNameCount``."""
    async with info.context.db.read() as session:
        result = (await session.execute(stmt)).all()
    return [AnnotationNameCount(name=name, count=count) for name, count in result]


def _apply_project_session_filters(
    stmt: Select[Any],
    project_rowid: int,
    time_range: Optional[TimeRange],
    filter_io_substring: Optional[str],
    session_id: Optional[str] = None,
) -> Select[Any]:
    """Restrict a ``ProjectSession`` aggregation to the project, time range, and
    input/output substring filter used by the sessions table.

    The time range uses interval-overlap semantics: a session is included iff
    [start_time, end_time] intersects [time_range.start, time_range.end), i.e.
    the session had activity inside the window.

    When ``session_id`` is provided, mirror the ``sessions`` resolver's search
    semantics: an exact session-ID match wins (ignoring the time range and
    substring filter); otherwise fall back to the substring/time-range filters,
    or to no sessions at all when there is no substring to fall back to.
    """
    table = models.ProjectSession
    stmt = stmt.where(table.project_id == project_rowid)
    conditions = []
    if time_range:
        if time_range.start:
            conditions.append(time_range.start <= table.end_time)
        if time_range.end:
            conditions.append(table.start_time < time_range.end)
    if filter_io_substring:
        filtered_session_rowids = get_filtered_session_rowids_subquery(
            session_filter_condition=filter_io_substring,
            project_rowids=[project_rowid],
            start_time=time_range.start if time_range else None,
            end_time=time_range.end if time_range else None,
        )
        conditions.append(table.id.in_(filtered_session_rowids))
    if not session_id:
        return stmt.where(*conditions)
    exact_match = exists(
        select(1).where(
            table.project_id == project_rowid,
            table.session_id == session_id,
        )
    )
    fallback = and_(*conditions) if filter_io_substring else false()
    return stmt.where(
        or_(
            and_(exact_match, table.session_id == session_id),
            and_(~exact_match, fallback),
        )
    )


@strawberry.type
class Project(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.Project]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Project ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            name = self.db_record.name
        else:
            name = await info.context.data_loaders.project_fields.load(
                (self.id, models.Project.name),
            )
        return name

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            description = self.db_record.description
        else:
            description = cast(
                Optional[str],
                await info.context.data_loaders.project_fields.load(
                    (self.id, models.Project.description),
                ),
            )
        return description

    @strawberry.field
    async def gradient_start_color(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            gradient_start_color = self.db_record.gradient_start_color
        else:
            gradient_start_color = await info.context.data_loaders.project_fields.load(
                (self.id, models.Project.gradient_start_color),
            )
        return gradient_start_color

    @strawberry.field
    async def gradient_end_color(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            gradient_end_color = self.db_record.gradient_end_color
        else:
            gradient_end_color = await info.context.data_loaders.project_fields.load(
                (self.id, models.Project.gradient_end_color),
            )
        return gradient_end_color

    @strawberry.field
    async def start_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        start_time = await info.context.data_loaders.min_start_or_max_end_times.load(
            (self.id, "start"),
        )
        start_time, _ = right_open_time_range(start_time, None)
        return start_time

    @strawberry.field
    async def end_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        end_time = await info.context.data_loaders.min_start_or_max_end_times.load(
            (self.id, "end"),
        )
        _, end_time = right_open_time_range(None, end_time)
        return end_time

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Whether the project has any trace data.",
    )
    async def has_traces(
        self,
        info: Info[Context, None],
    ) -> bool:
        return await info.context.data_loaders.project_has_traces.load(self.id)

    @strawberry.field
    async def record_count(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
        session_filter_condition: Optional[str] = UNSET,
    ) -> int:
        if filter_condition and session_filter_condition:
            raise BadRequest(
                "Both a filter condition and session filter condition "
                "cannot be applied at the same time"
            )
        return await info.context.data_loaders.record_counts.load(
            (
                "span",
                self.id,
                time_range or None,
                filter_condition or None,
                session_filter_condition or None,
            ),
        )

    @strawberry.field
    async def trace_count(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
        session_filter_condition: Optional[str] = UNSET,
    ) -> int:
        if filter_condition and session_filter_condition:
            raise BadRequest(
                "Both a filter condition and session filter condition "
                "cannot be applied at the same time"
            )
        return await info.context.data_loaders.record_counts.load(
            (
                "trace",
                self.id,
                time_range or None,
                filter_condition or None,
                session_filter_condition or None,
            ),
        )

    @strawberry.field
    async def token_count_total(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> float:
        return await info.context.data_loaders.token_counts.load(
            ("total", self.id, time_range, filter_condition),
        )

    @strawberry.field
    async def token_count_prompt(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> float:
        return await info.context.data_loaders.token_counts.load(
            ("prompt", self.id, time_range, filter_condition),
        )

    @strawberry.field
    async def token_count_completion(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> float:
        return await info.context.data_loaders.token_counts.load(
            ("completion", self.id, time_range, filter_condition),
        )

    @strawberry.field
    async def cost_summary(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
        session_filter_condition: Optional[str] = UNSET,
    ) -> SpanCostSummary:
        if filter_condition and session_filter_condition:
            raise BadRequest(
                "Both a filter condition and session filter condition "
                "cannot be applied at the same time"
            )
        summary = await info.context.data_loaders.span_cost_summary_by_project.load(
            (
                self.id,
                time_range or None,
                filter_condition or None,
                session_filter_condition or None,
            )
        )
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
        filter_condition: Optional[str] = UNSET,
        session_filter_condition: Optional[str] = UNSET,
    ) -> Optional[float]:
        if filter_condition and session_filter_condition:
            raise BadRequest(
                "Both a filter condition and session filter condition "
                "cannot be applied at the same time"
            )
        return await info.context.data_loaders.latency_ms_quantile.load(
            (
                "trace",
                self.id,
                time_range or None,
                filter_condition or None,
                session_filter_condition or None,
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
        session_filter_condition: Optional[str] = UNSET,
    ) -> Optional[float]:
        if filter_condition and session_filter_condition:
            raise BadRequest(
                "Both a filter condition and session filter condition "
                "cannot be applied at the same time"
            )
        return await info.context.data_loaders.latency_ms_quantile.load(
            (
                "span",
                self.id,
                time_range or None,
                filter_condition or None,
                session_filter_condition or None,
                probability,
            ),
        )

    @strawberry.field
    async def trace(self, trace_id: ID, info: Info[Context, None]) -> Optional[Trace]:
        stmt = select(models.Trace).where(models.Trace.project_rowid == self.id)
        try:
            trace_rowid = from_global_id_with_expected_type(
                GlobalID.from_id(str(trace_id)), Trace.__name__
            )
            stmt = stmt.where(models.Trace.id == trace_rowid)
        except ValueError:
            stmt = stmt.where(models.Trace.trace_id == str(trace_id))
        async with info.context.db.read() as session:
            if (trace := await session.scalar(stmt)) is None:
                return None
        return Trace(id=trace.id, db_record=trace)

    @strawberry.field(extensions=[RequireForwardPaginationExtension()])  # type: ignore[untyped-decorator]
    async def spans(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        first: Optional[int] = UNSET,
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
                project_rowid=self.id,
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
            .where(models.Trace.project_rowid == self.id)
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
                if sort_column.type is CursorSortColumnDataType.NULL:
                    stmt = stmt.where(sort_config.orm_expression.is_(None))
                    stmt = stmt.where(compare(models.Span.id, cursor.rowid))
                else:
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
        async with info.context.db.read() as session:
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
                cursors_and_nodes.append((cursor, Span(id=span_rowid)))
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

    @strawberry.field(
        description="Sessions in the project. The time range filter uses interval-overlap "
        "semantics: a session is included iff [startTime, endTime] intersects "
        "[timeRange.start, timeRange.end), i.e. the session had activity inside the "
        "window. Long-running sessions therefore appear in every window they overlap."
    )  # type: ignore
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
            async with info.context.db.read() as session:
                ans = await session.scalar(
                    select(table).filter_by(
                        session_id=session_id,
                        project_id=self.id,
                    )
                )
            if ans:
                return connection_from_list(
                    data=[ProjectSession(id=ans.id, db_record=ans)],
                    args=ConnectionArgs(),
                )
            elif not filter_io_substring:
                return connection_from_list(
                    data=[],
                    args=ConnectionArgs(),
                )
        stmt = _apply_project_session_filters(
            select(table),
            project_rowid=self.id,
            time_range=time_range or None,
            filter_io_substring=filter_io_substring or None,
        )
        sort_config: Optional[ProjectSessionSortConfig] = None
        cursor_rowid_column: Any = table.id
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
                if sort_column.type is CursorSortColumnDataType.NULL:
                    stmt = stmt.where(sort_config.orm_expression.is_(None))
                    stmt = stmt.where(compare(table.id, cursor.rowid))
                else:
                    stmt = stmt.where(
                        compare(
                            tuple_(sort_config.orm_expression, table.id),
                            (sort_column.value, cursor.rowid),
                        )
                    )
            else:
                stmt = stmt.where(table.id < cursor.rowid)
        stmt = stmt.order_by(cursor_rowid_column)
        if first:
            stmt = stmt.limit(
                first + 1  # over-fetch by one to determine whether there's a next page
            )
        cursors_and_nodes = []
        async with info.context.db.read() as session:
            records = await session.stream(stmt)
            async for record in islice(records, first):
                project_session = record[0]
                cursor = Cursor(rowid=project_session.id)
                if sort_config:
                    assert len(record) > 1
                    cursor.sort_column = CursorSortColumn(
                        type=sort_config.column_data_type,
                        value=record[1],
                    )
                cursors_and_nodes.append(
                    (cursor, ProjectSession(id=project_session.id, db_record=project_session))
                )
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
        description="Number of sessions in the project, optionally filtered by "
        "a time range and a substring of the session input/output. An exact "
        "session-ID match takes precedence over the other filters, mirroring "
        "the sessions table search."
    )  # type: ignore
    async def session_count(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_io_substring: Optional[str] = UNSET,
        session_id: Optional[str] = UNSET,
    ) -> int:
        # When there is no substring / session-ID filter, the count depends only on
        # the project and time range, so it can be batched across projects through
        # the record_counts dataloader (this is the projects-list / project-card
        # path, which would otherwise issue one query per project).
        if not filter_io_substring and not session_id:
            return await info.context.data_loaders.record_counts.load(
                (
                    "session",
                    self.id,
                    time_range or None,
                    None,
                    None,
                ),
            )
        stmt = _apply_project_session_filters(
            select(func.count(models.ProjectSession.id)),
            project_rowid=self.id,
            time_range=time_range or None,
            filter_io_substring=filter_io_substring or None,
            session_id=session_id or None,
        )
        async with info.context.db.read() as session:
            return await session.scalar(stmt) or 0

    @strawberry.field(
        description="Average session duration in milliseconds, i.e. the mean of "
        "end time minus start time across sessions, optionally filtered by a "
        "time range and a substring of the session input/output. An exact "
        "session-ID match takes precedence over the other filters, mirroring "
        "the sessions table search."
    )  # type: ignore
    async def average_session_duration_ms(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_io_substring: Optional[str] = UNSET,
        session_id: Optional[str] = UNSET,
    ) -> Optional[float]:
        stmt = _apply_project_session_filters(
            select(
                func.avg(
                    models.LatencyMs(
                        models.ProjectSession.start_time,
                        models.ProjectSession.end_time,
                    )
                )
            ),
            project_rowid=self.id,
            time_range=time_range or None,
            filter_io_substring=filter_io_substring or None,
            session_id=session_id or None,
        )
        async with info.context.db.read() as session:
            average_duration_ms = await session.scalar(stmt)
        return None if average_duration_ms is None else float(average_duration_ms)

    @strawberry.field(
        description="Average number of traces (e.g. conversation turns) per "
        "session, optionally filtered by a time range and a substring of the "
        "session input/output. An exact session-ID match takes precedence "
        "over the other filters, mirroring the sessions table search."
    )  # type: ignore
    async def average_traces_per_session(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        filter_io_substring: Optional[str] = UNSET,
        session_id: Optional[str] = UNSET,
    ) -> Optional[float]:
        traces_per_session = _apply_project_session_filters(
            select(func.count(models.Trace.id).label("num_traces"))
            .select_from(models.ProjectSession)
            .outerjoin(
                models.Trace,
                models.Trace.project_session_rowid == models.ProjectSession.id,
            )
            .group_by(models.ProjectSession.id),
            project_rowid=self.id,
            time_range=time_range or None,
            filter_io_substring=filter_io_substring or None,
            session_id=session_id or None,
        ).subquery()
        stmt = select(func.avg(traces_per_session.c.num_traces))
        async with info.context.db.read() as session:
            average_num_traces = await session.scalar(stmt)
        return None if average_num_traces is None else float(average_num_traces)

    @strawberry.field(
        description="Quantile (e.g. p50, p99) of session duration in "
        "milliseconds, i.e. end time minus start time, optionally filtered by "
        "a time range and a substring of the session input/output. An exact "
        "session-ID match takes precedence over the other filters, mirroring "
        "the sessions table search."
    )  # type: ignore
    async def session_duration_ms_quantile(
        self,
        info: Info[Context, None],
        probability: float,
        time_range: Optional[TimeRange] = UNSET,
        filter_io_substring: Optional[str] = UNSET,
        session_id: Optional[str] = UNSET,
    ) -> Optional[float]:
        if not 0 <= probability <= 1:
            raise BadRequest("Probability must be between 0 and 1 (inclusive)")
        duration_ms = models.LatencyMs(
            models.ProjectSession.start_time,
            models.ProjectSession.end_time,
        )
        dialect = info.context.db.dialect
        quantile: Any
        if dialect is SupportedSQLDialect.POSTGRESQL:
            quantile = percentile_cont(probability).within_group(duration_ms)
        elif dialect is SupportedSQLDialect.SQLITE:
            quantile = func.percentile(duration_ms, probability * 100)
        else:
            assert_never(dialect)
        stmt = _apply_project_session_filters(
            select(quantile),
            project_rowid=self.id,
            time_range=time_range or None,
            filter_io_substring=filter_io_substring or None,
            session_id=session_id or None,
        )
        async with info.context.db.read() as session:
            quantile_value = await session.scalar(stmt)
        return None if quantile_value is None else float(quantile_value)

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
            .where(models.Trace.project_rowid == self.id)
        )
        async with info.context.db.read() as session:
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
            .where(models.Trace.project_rowid == self.id)
        )
        async with info.context.db.read() as session:
            return list(await session.scalars(stmt))

    @strawberry.field(
        description="Names of all available annotations for sessions. "
        "(The list contains no duplicates.)"
    )  # type: ignore
    async def session_annotation_names(
        self,
        info: Info[Context, None],
    ) -> list[str]:
        stmt = (
            select(distinct(models.ProjectSessionAnnotation.name))
            .join(models.ProjectSession)
            .where(models.ProjectSession.project_id == self.id)
        )
        async with info.context.db.read() as session:
            return list(await session.scalars(stmt))

    @strawberry.field(
        description="Span annotation names along with the number of span annotations "
        "that have been added for each name in this project."
    )  # type: ignore
    async def span_annotation_name_counts(
        self,
        info: Info[Context, None],
    ) -> list[AnnotationNameCount]:
        stmt = (
            select(models.SpanAnnotation.name, func.count(models.SpanAnnotation.id))
            .join(models.Span, models.SpanAnnotation.span_rowid == models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.id)
            .group_by(models.SpanAnnotation.name)
            .order_by(models.SpanAnnotation.name)
        )
        return await _annotation_name_counts(info, stmt)

    @strawberry.field(
        description="Trace annotation names along with the number of trace annotations "
        "that have been added for each name in this project."
    )  # type: ignore
    async def trace_annotation_name_counts(
        self,
        info: Info[Context, None],
    ) -> list[AnnotationNameCount]:
        stmt = (
            select(models.TraceAnnotation.name, func.count(models.TraceAnnotation.id))
            .join(models.Trace, models.TraceAnnotation.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.id)
            .group_by(models.TraceAnnotation.name)
            .order_by(models.TraceAnnotation.name)
        )
        return await _annotation_name_counts(info, stmt)

    @strawberry.field(
        description="Session annotation names along with the number of session annotations "
        "that have been added for each name in this project."
    )  # type: ignore
    async def session_annotation_name_counts(
        self,
        info: Info[Context, None],
    ) -> list[AnnotationNameCount]:
        stmt = (
            select(
                models.ProjectSessionAnnotation.name,
                func.count(models.ProjectSessionAnnotation.id),
            )
            .join(
                models.ProjectSession,
                models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
            )
            .where(models.ProjectSession.project_id == self.id)
            .group_by(models.ProjectSessionAnnotation.name)
            .order_by(models.ProjectSessionAnnotation.name)
        )
        return await _annotation_name_counts(info, stmt)

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
            .where(models.Trace.project_rowid == self.id)
            .where(models.DocumentAnnotation.annotator_kind == "LLM")
        )
        if span_id:
            stmt = stmt.where(models.Span.span_id == str(span_id))
        async with info.context.db.read() as session:
            return list(await session.scalars(stmt))

    @strawberry.field
    async def trace_annotation_summary(
        self,
        info: Info[Context, None],
        annotation_name: str,
        filter_condition: Optional[str] = UNSET,
        session_filter_condition: Optional[str] = UNSET,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[AnnotationSummary]:
        if filter_condition and session_filter_condition:
            raise BadRequest(
                "Both a filter condition and session filter condition "
                "cannot be applied at the same time"
            )
        return await info.context.data_loaders.annotation_summaries.load(
            (
                "trace",
                self.id,
                time_range or None,
                filter_condition or None,
                session_filter_condition or None,
                None,
                annotation_name,
            ),
        )

    @strawberry.field
    async def span_annotation_summary(
        self,
        info: Info[Context, None],
        annotation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
        session_filter_condition: Optional[str] = UNSET,
    ) -> Optional[AnnotationSummary]:
        if filter_condition and session_filter_condition:
            raise BadRequest(
                "Both a filter condition and session filter condition "
                "cannot be applied at the same time"
            )
        return await info.context.data_loaders.annotation_summaries.load(
            (
                "span",
                self.id,
                time_range or None,
                filter_condition or None,
                session_filter_condition or None,
                None,
                annotation_name,
            ),
        )

    @strawberry.field(
        description="Summary (score and label fractions) of a session "
        "annotation across the project's sessions, optionally filtered by a "
        "time range and a substring of the session input/output. An exact "
        "session-ID match takes precedence over the other filters, mirroring "
        "the sessions table search."
    )  # type: ignore
    async def session_annotation_summary(
        self,
        info: Info[Context, None],
        annotation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_io_substring: Optional[str] = UNSET,
        session_id: Optional[str] = UNSET,
    ) -> Optional[AnnotationSummary]:
        if session_id:
            async with info.context.db.read() as session:
                session_rowid = await session.scalar(
                    select(models.ProjectSession.id).where(
                        models.ProjectSession.project_id == self.id,
                        models.ProjectSession.session_id == session_id,
                    )
                )
            if session_rowid is not None:
                # Mirror the sessions table: the exact match wins and ignores
                # the time range and substring filter.
                return await info.context.data_loaders.annotation_summaries.load(
                    ("session", self.id, None, None, None, session_rowid, annotation_name),
                )
            if not filter_io_substring:
                return None
        return await info.context.data_loaders.annotation_summaries.load(
            (
                "session",
                self.id,
                time_range or None,
                None,
                filter_io_substring or None,
                None,
                annotation_name,
            ),
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
            (self.id, time_range, filter_condition, evaluation_name),
        )

    @strawberry.field
    def streaming_last_updated_at(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        return info.context.last_updated_at.get(models.Project, self.id)

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
                str(stmt.compile(dialect=sqlite.dialect()))
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
        configs = await loader.load(self.id)
        data = [to_gql_annotation_config(config) for config in configs]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def trace_retention_policy(
        self,
        info: Info[Context, None],
    ) -> Annotated["ProjectTraceRetentionPolicy", lazy(".ProjectTraceRetentionPolicy")]:
        from .ProjectTraceRetentionPolicy import ProjectTraceRetentionPolicy

        id_ = await info.context.data_loaders.trace_retention_policy_id_by_project_id.load(self.id)
        return ProjectTraceRetentionPolicy(id=id_)

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            created_at = self.db_record.created_at
        else:
            created_at = await info.context.data_loaders.project_fields.load(
                (self.id, models.Project.created_at),
            )
        return created_at

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            updated_at = self.db_record.updated_at
        else:
            updated_at = await info.context.data_loaders.project_fields.load(
                (self.id, models.Project.updated_at),
            )
        return updated_at

    @strawberry.field
    async def span_count_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> "SpanCountTimeSeries":
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
            .where(models.Trace.project_rowid == self.id)
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
        async with info.context.db.read() as session:
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
    ) -> "TraceCountTimeSeries":
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
            .where(models.Trace.project_rowid == self.id)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        data = {}
        async with info.context.db.read() as session:
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
    ) -> "TraceCountByStatusTimeSeries":
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
            .where(models.Trace.project_rowid == self.id)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        data: dict[datetime, TraceCountByStatusTimeSeriesDataPoint] = {}
        async with info.context.db.read() as session:
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
    ) -> "TraceLatencyPercentileTimeSeries":
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

        stmt = select(bucket).where(models.Trace.project_rowid == self.id)
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
        async with info.context.db.read() as session:
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
    ) -> "TraceTokenCountTimeSeries":
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
            .where(models.Trace.project_rowid == self.id)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        details_stmt = (
            select(
                bucket,
                models.SpanCostDetail.is_prompt,
                models.SpanCostDetail.token_type,
                func.sum(func.coalesce(models.SpanCostDetail.tokens, 0)),
            )
            .join_from(
                models.Trace,
                models.SpanCost,
                onclause=models.SpanCost.trace_rowid == models.Trace.id,
            )
            .join(
                models.SpanCostDetail,
                models.SpanCostDetail.span_cost_id == models.SpanCost.id,
            )
            .where(models.Trace.project_rowid == self.id)
            .group_by(bucket, models.SpanCostDetail.is_prompt, models.SpanCostDetail.token_type)
            .order_by(
                bucket,
                models.SpanCostDetail.is_prompt.desc(),
                models.SpanCostDetail.token_type,
            )
        )
        if time_range:
            if time_range.start:
                details_stmt = details_stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                details_stmt = details_stmt.where(models.Trace.start_time < time_range.end)
        data: dict[datetime, TraceTokenCountTimeSeriesDataPoint] = {}
        async with info.context.db.read() as session:
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
            async for (
                t,
                is_prompt,
                token_type,
                token_count,
            ) in await session.stream(details_stmt):
                timestamp = _as_datetime(t)
                data_point = data.setdefault(
                    timestamp,
                    TraceTokenCountTimeSeriesDataPoint(timestamp=timestamp),
                )
                details = (
                    data_point.prompt_token_count_details
                    if is_prompt
                    else data_point.completion_token_count_details
                )
                _merge_token_count_detail(details, token_type, token_count)

        for data_point in data.values():
            _ensure_token_count_details_total(
                data_point.prompt_token_count_details,
                data_point.prompt_token_count,
                "input",
            )
            _ensure_token_count_details_total(
                data_point.completion_token_count_details,
                data_point.completion_token_count,
                "output",
            )
            _sort_token_count_details(data_point.prompt_token_count_details)
            _sort_token_count_details(data_point.completion_token_count_details)

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
    ) -> "TraceTokenCostTimeSeries":
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
            .where(models.Trace.project_rowid == self.id)
            .group_by(bucket)
            .order_by(bucket)
        )
        if time_range:
            if time_range.start:
                stmt = stmt.where(time_range.start <= models.Trace.start_time)
            if time_range.end:
                stmt = stmt.where(models.Trace.start_time < time_range.end)
        data: dict[datetime, TraceTokenCostTimeSeriesDataPoint] = {}
        async with info.context.db.read() as session:
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
    ) -> "AnnotationScoreTimeSeries":
        stride, utc_offset_minutes = _time_bin_stride(time_bin_config)
        bucket = date_trunc(
            info.context.db.dialect, stride, models.Trace.start_time, utc_offset_minutes
        )
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
            .where(models.Trace.project_rowid == self.id)
            .group_by(bucket, models.SpanAnnotation.name)
            .order_by(bucket)
        )
        return await _annotation_score_time_series(
            db=info.context.db,
            stmt=stmt,
            time_range=time_range,
            start_time_col=models.Trace.start_time,
            stride=stride,
            utc_offset_minutes=utc_offset_minutes,
        )

    @strawberry.field
    async def trace_annotation_score_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> "AnnotationScoreTimeSeries":
        stride, utc_offset_minutes = _time_bin_stride(time_bin_config)
        bucket = date_trunc(
            info.context.db.dialect, stride, models.Trace.start_time, utc_offset_minutes
        )
        stmt = (
            select(
                bucket,
                models.TraceAnnotation.name,
                func.avg(models.TraceAnnotation.score).label("average_score"),
            )
            .join_from(
                models.TraceAnnotation,
                models.Trace,
                onclause=models.TraceAnnotation.trace_rowid == models.Trace.id,
            )
            .where(models.Trace.project_rowid == self.id)
            .group_by(bucket, models.TraceAnnotation.name)
            .order_by(bucket)
        )
        return await _annotation_score_time_series(
            db=info.context.db,
            stmt=stmt,
            time_range=time_range,
            start_time_col=models.Trace.start_time,
            stride=stride,
            utc_offset_minutes=utc_offset_minutes,
        )

    @strawberry.field
    async def session_annotation_score_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> "AnnotationScoreTimeSeries":
        stride, utc_offset_minutes = _time_bin_stride(time_bin_config)
        # Buckets by start_time (a session belongs to exactly one bucket), so unlike the
        # sessions connection's interval-overlap filter, a long-running session appears
        # only in the bucket where it started — the two surfaces intentionally differ.
        bucket = date_trunc(
            info.context.db.dialect, stride, models.ProjectSession.start_time, utc_offset_minutes
        )
        stmt = (
            select(
                bucket,
                models.ProjectSessionAnnotation.name,
                func.avg(models.ProjectSessionAnnotation.score).label("average_score"),
            )
            .join_from(
                models.ProjectSessionAnnotation,
                models.ProjectSession,
                onclause=models.ProjectSessionAnnotation.project_session_id
                == models.ProjectSession.id,
            )
            .where(models.ProjectSession.project_id == self.id)
            .group_by(bucket, models.ProjectSessionAnnotation.name)
            .order_by(bucket)
        )
        return await _annotation_score_time_series(
            db=info.context.db,
            stmt=stmt,
            time_range=time_range,
            start_time_col=models.ProjectSession.start_time,
            stride=stride,
            utc_offset_minutes=utc_offset_minutes,
        )

    @strawberry.field
    async def span_annotation_metrics_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> "AnnotationMetricsTimeSeries":
        stride, utc_offset_minutes = _time_bin_stride(time_bin_config)
        bucket = date_trunc(
            info.context.db.dialect, stride, models.Trace.start_time, utc_offset_minutes
        )
        stmt: Select[Any] = (
            select(
                bucket.label("bucket"),
                models.Span.id.label("entity_id"),
                models.SpanAnnotation.name.label("name"),
                models.SpanAnnotation.label.label("label"),
                models.SpanAnnotation.score.label("score"),
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
            .where(models.Trace.project_rowid == self.id)
            .where(
                or_(
                    models.SpanAnnotation.score.is_not(None),
                    models.SpanAnnotation.label.is_not(None),
                )
            )
        )
        return await _annotation_metrics_time_series(
            db=info.context.db,
            stmt=stmt,
            time_range=time_range,
            start_time_col=models.Trace.start_time,
            stride=stride,
            utc_offset_minutes=utc_offset_minutes,
        )

    @strawberry.field
    async def trace_annotation_metrics_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> "AnnotationMetricsTimeSeries":
        stride, utc_offset_minutes = _time_bin_stride(time_bin_config)
        bucket = date_trunc(
            info.context.db.dialect, stride, models.Trace.start_time, utc_offset_minutes
        )
        stmt: Select[Any] = (
            select(
                bucket.label("bucket"),
                models.Trace.id.label("entity_id"),
                models.TraceAnnotation.name.label("name"),
                models.TraceAnnotation.label.label("label"),
                models.TraceAnnotation.score.label("score"),
            )
            .join_from(
                models.TraceAnnotation,
                models.Trace,
                onclause=models.TraceAnnotation.trace_rowid == models.Trace.id,
            )
            .where(models.Trace.project_rowid == self.id)
            .where(
                or_(
                    models.TraceAnnotation.score.is_not(None),
                    models.TraceAnnotation.label.is_not(None),
                )
            )
        )
        return await _annotation_metrics_time_series(
            db=info.context.db,
            stmt=stmt,
            time_range=time_range,
            start_time_col=models.Trace.start_time,
            stride=stride,
            utc_offset_minutes=utc_offset_minutes,
        )

    @strawberry.field
    async def session_annotation_metrics_time_series(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
        time_bin_config: Optional[TimeBinConfig] = UNSET,
    ) -> "AnnotationMetricsTimeSeries":
        stride, utc_offset_minutes = _time_bin_stride(time_bin_config)
        # Match `session_annotation_score_time_series` in this file: assign each
        # session to its start-time bucket instead of using interval overlap.
        bucket = date_trunc(
            info.context.db.dialect, stride, models.ProjectSession.start_time, utc_offset_minutes
        )
        stmt: Select[Any] = (
            select(
                bucket.label("bucket"),
                models.ProjectSession.id.label("entity_id"),
                models.ProjectSessionAnnotation.name.label("name"),
                models.ProjectSessionAnnotation.label.label("label"),
                models.ProjectSessionAnnotation.score.label("score"),
            )
            .join_from(
                models.ProjectSessionAnnotation,
                models.ProjectSession,
                onclause=models.ProjectSessionAnnotation.project_session_id
                == models.ProjectSession.id,
            )
            .where(models.ProjectSession.project_id == self.id)
            .where(
                or_(
                    models.ProjectSessionAnnotation.score.is_not(None),
                    models.ProjectSessionAnnotation.label.is_not(None),
                )
            )
        )
        return await _annotation_metrics_time_series(
            db=info.context.db,
            stmt=stmt,
            time_range=time_range,
            start_time_col=models.ProjectSession.start_time,
            stride=stride,
            utc_offset_minutes=utc_offset_minutes,
        )

    @strawberry.field
    async def top_models_by_cost(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
    ) -> list[GenerativeModel]:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        async with info.context.db.read() as session:
            stmt = (
                select(
                    models.GenerativeModel,
                    func.sum(models.SpanCost.total_tokens).label("total_tokens"),
                    func.sum(models.SpanCost.prompt_tokens).label("prompt_tokens"),
                    func.sum(models.SpanCost.completion_tokens).label("completion_tokens"),
                    func.sum(models.SpanCost.total_cost).label("total_cost"),
                    func.sum(models.SpanCost.prompt_cost).label("prompt_cost"),
                    func.sum(models.SpanCost.completion_cost).label("completion_cost"),
                )
                .join(
                    models.SpanCost,
                    models.SpanCost.model_id == models.GenerativeModel.id,
                )
                .join(
                    models.Trace,
                    models.SpanCost.trace_rowid == models.Trace.id,
                )
                .where(models.Trace.project_rowid == self.id)
                .where(models.SpanCost.model_id.isnot(None))
                .where(models.SpanCost.span_start_time >= time_range.start)
                .group_by(models.GenerativeModel.id)
                .order_by(func.sum(models.SpanCost.total_cost).desc())
            )
            if time_range.end:
                stmt = stmt.where(models.SpanCost.span_start_time < time_range.end)
            results: list[GenerativeModel] = []
            async for (
                model,
                total_tokens,
                prompt_tokens,
                completion_tokens,
                total_cost,
                prompt_cost,
                completion_cost,
            ) in await session.stream(stmt):
                cost_summary = SpanCostSummary(
                    prompt=CostBreakdown(tokens=prompt_tokens, cost=prompt_cost),
                    completion=CostBreakdown(tokens=completion_tokens, cost=completion_cost),
                    total=CostBreakdown(tokens=total_tokens, cost=total_cost),
                )
                cache_time_range = TimeRange(
                    start=time_range.start,
                    end=time_range.end,
                )
                gql_model = GenerativeModel(id=model.id, db_record=model)
                gql_model.add_cached_cost_summary(self.id, cache_time_range, cost_summary)
                results.append(gql_model)
            return results

    @strawberry.field
    async def top_models_by_token_count(
        self,
        info: Info[Context, None],
        time_range: TimeRange,
    ) -> list[GenerativeModel]:
        if time_range.start is None:
            raise BadRequest("Start time is required")

        async with info.context.db.read() as session:
            stmt = (
                select(
                    models.GenerativeModel,
                    func.sum(models.SpanCost.total_tokens).label("total_tokens"),
                    func.sum(models.SpanCost.prompt_tokens).label("prompt_tokens"),
                    func.sum(models.SpanCost.completion_tokens).label("completion_tokens"),
                    func.sum(models.SpanCost.total_cost).label("total_cost"),
                    func.sum(models.SpanCost.prompt_cost).label("prompt_cost"),
                    func.sum(models.SpanCost.completion_cost).label("completion_cost"),
                )
                .join(
                    models.SpanCost,
                    models.SpanCost.model_id == models.GenerativeModel.id,
                )
                .join(
                    models.Trace,
                    models.SpanCost.trace_rowid == models.Trace.id,
                )
                .where(models.Trace.project_rowid == self.id)
                .where(models.SpanCost.model_id.isnot(None))
                .where(models.SpanCost.span_start_time >= time_range.start)
                .group_by(models.GenerativeModel.id)
                .order_by(func.sum(models.SpanCost.total_tokens).desc())
            )
            if time_range.end:
                stmt = stmt.where(models.SpanCost.span_start_time < time_range.end)
            results: list[GenerativeModel] = []
            async for (
                model,
                total_tokens,
                prompt_tokens,
                completion_tokens,
                total_cost,
                prompt_cost,
                completion_cost,
            ) in await session.stream(stmt):
                cost_summary = SpanCostSummary(
                    prompt=CostBreakdown(tokens=prompt_tokens, cost=prompt_cost),
                    completion=CostBreakdown(tokens=completion_tokens, cost=completion_cost),
                    total=CostBreakdown(tokens=total_tokens, cost=total_cost),
                )
                cache_time_range = TimeRange(
                    start=time_range.start,
                    end=time_range.end,
                )
                gql_model = GenerativeModel(id=model.id, db_record=model)
                gql_model.add_cached_cost_summary(self.id, cache_time_range, cost_summary)
                results.append(gql_model)
            return results


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
class TraceTokenCountDetailsTimeSeriesEntry:
    token_type: str
    token_count: Optional[float] = None


@strawberry.type
class TraceTokenCountTimeSeriesDataPoint:
    timestamp: datetime
    prompt_token_count: Optional[float] = None
    completion_token_count: Optional[float] = None
    total_token_count: Optional[float] = None
    prompt_token_count_details: list[TraceTokenCountDetailsTimeSeriesEntry] = strawberry.field(
        default_factory=list
    )
    completion_token_count_details: list[TraceTokenCountDetailsTimeSeriesEntry] = strawberry.field(
        default_factory=list
    )


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
class AnnotationScoreWithLabel:
    label: str
    score: float


@strawberry.type
class AnnotationScoreTimeSeriesDataPoint:
    timestamp: datetime
    scores_with_labels: list[AnnotationScoreWithLabel]


@strawberry.type
class AnnotationScoreTimeSeries:
    data: list[AnnotationScoreTimeSeriesDataPoint]
    names: list[str]


@strawberry.type
class AnnotationMetricsTimeSeriesDataPoint:
    timestamp: datetime
    annotation_summaries: list[AnnotationSummary]


@strawberry.type
class AnnotationMetricsTimeSeries:
    data: list[AnnotationMetricsTimeSeriesDataPoint]
    names: list[str]


_TimeBinStride = Literal["minute", "hour", "day", "week", "month", "year"]


def _time_bin_stride(time_bin_config: Optional[TimeBinConfig]) -> tuple[_TimeBinStride, int]:
    if not time_bin_config:
        return "hour", 0
    return time_bin_config.scale.value, time_bin_config.utc_offset_minutes


async def _annotation_score_time_series(
    db: DbSessionFactory,
    stmt: Select[Any],
    time_range: TimeRange,
    start_time_col: InstrumentedAttribute[datetime],
    stride: _TimeBinStride,
    utc_offset_minutes: int,
) -> AnnotationScoreTimeSeries:
    """Execute a (bucket, name, average_score) statement and fill in empty time bins.

    Args:
        db: The database session factory.
        stmt: A statement selecting (time bucket, annotation name, average score) rows.
        time_range: The requested time range; the start is required.
        start_time_col: The timestamp column the time range filters on.
        stride: The time bin stride used to fill in empty bins.
        utc_offset_minutes: The UTC offset applied when binning timestamps.

    Returns:
        The average annotation scores per time bin, keyed by annotation name.
    """
    if time_range.start is None:
        raise BadRequest("Start time is required")
    stmt = stmt.where(time_range.start <= start_time_col)
    if time_range.end:
        stmt = stmt.where(start_time_col < time_range.end)
    scores: dict[datetime, dict[str, float]] = {}
    unique_names: set[str] = set()
    async with db.read() as session:
        async for bucket_value, name, average_score in await session.stream(stmt):
            if average_score is None:
                continue
            timestamp = _as_datetime(bucket_value)
            scores.setdefault(timestamp, {})[name] = average_score
            unique_names.add(name)

    min_time = min([*scores, time_range.start])
    max_time = max([*scores, time_range.end if time_range.end else datetime.now(timezone.utc)])
    data: dict[datetime, AnnotationScoreTimeSeriesDataPoint] = {
        timestamp: AnnotationScoreTimeSeriesDataPoint(
            timestamp=timestamp,
            scores_with_labels=[
                AnnotationScoreWithLabel(label=label, score=score)
                for label, score in scores_by_name.items()
            ],
        )
        for timestamp, scores_by_name in scores.items()
    }
    for timestamp in get_timestamp_range(
        start_time=min_time,
        end_time=max_time,
        stride=stride,
        utc_offset_minutes=utc_offset_minutes,
    ):
        if timestamp not in data:
            data[timestamp] = AnnotationScoreTimeSeriesDataPoint(
                timestamp=timestamp,
                scores_with_labels=[],
            )
    return AnnotationScoreTimeSeries(
        data=sorted(data.values(), key=lambda x: x.timestamp),
        names=sorted(unique_names),
    )


async def _annotation_metrics_time_series(
    db: DbSessionFactory,
    stmt: Select[Any],
    time_range: TimeRange,
    start_time_col: InstrumentedAttribute[datetime],
    stride: _TimeBinStride,
    utc_offset_minutes: int,
) -> AnnotationMetricsTimeSeries:
    """Build bounded, entity-weighted summaries and fill in empty time bins."""
    if time_range.start is None:
        raise BadRequest("Start time is required")
    stmt = stmt.where(time_range.start <= start_time_col)
    if time_range.end:
        stmt = stmt.where(start_time_col < time_range.end)

    rows_by_timestamp_and_name: dict[tuple[datetime, str], list[dict[str, Any]]] = {}
    unique_names: set[str] = set()
    metrics_stmt = build_entity_weighted_annotation_metrics_stmt(stmt)
    async with db.read() as session:
        async for result_row in await session.stream(metrics_stmt):
            timestamp = _as_datetime(result_row.bucket)
            name = result_row.name
            unique_names.add(name)
            rows_by_timestamp_and_name.setdefault((timestamp, name), []).append(
                {
                    "label": result_row.label,
                    "record_count": result_row.record_count,
                    "label_count": result_row.label_count,
                    "score_count": result_row.score_count,
                    "score_sum": result_row.score_sum,
                    "avg_label_fraction": result_row.avg_label_fraction,
                    "avg_score": result_row.avg_score,
                }
            )

    summaries_by_timestamp: dict[datetime, list[AnnotationSummary]] = {}
    for (timestamp, name), rows in rows_by_timestamp_and_name.items():
        summaries_by_timestamp.setdefault(timestamp, []).append(
            AnnotationSummary(name=name, df=DataFrame(rows))
        )

    # Mirror `_annotation_score_time_series` in this file by emitting empty bins
    # throughout the requested range, keeping all Project metrics time axes aligned.
    min_time = min([*summaries_by_timestamp, time_range.start])
    max_time = max(
        [
            *summaries_by_timestamp,
            time_range.end if time_range.end else datetime.now(timezone.utc),
        ]
    )
    data = {
        timestamp: AnnotationMetricsTimeSeriesDataPoint(
            timestamp=timestamp,
            annotation_summaries=sorted(summaries, key=lambda summary: summary.name),
        )
        for timestamp, summaries in summaries_by_timestamp.items()
    }
    for timestamp in get_timestamp_range(
        start_time=min_time,
        end_time=max_time,
        stride=stride,
        utc_offset_minutes=utc_offset_minutes,
    ):
        if timestamp not in data:
            data[timestamp] = AnnotationMetricsTimeSeriesDataPoint(
                timestamp=timestamp,
                annotation_summaries=[],
            )
    return AnnotationMetricsTimeSeries(
        data=sorted(data.values(), key=lambda point: point.timestamp),
        names=sorted(unique_names),
    )


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
                edges.append(Edge(node=Span(id=span_rowid), cursor=str(cursor)))
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
        id=project.id,
        db_record=project,
    )
