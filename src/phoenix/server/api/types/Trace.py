from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional, Union

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import desc, select
from strawberry import ID, UNSET, Private, lazy
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.TraceAnnotationSort import TraceAnnotationSort
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation, to_gql_trace_annotation

if TYPE_CHECKING:
    from phoenix.server.api.types.Project import Project
    from phoenix.server.api.types.ProjectSession import ProjectSession

ProjectRowId: TypeAlias = int
TraceRowId: TypeAlias = int


@strawberry.type
class Trace(Node):
    trace_rowid: NodeID[TraceRowId]
    db_trace: Private[models.Trace] = UNSET

    def __post_init__(self) -> None:
        if self.db_trace and self.trace_rowid != self.db_trace.id:
            raise ValueError("Trace ID mismatch")

    @strawberry.field
    async def trace_id(
        self,
        info: Info[Context, None],
    ) -> ID:
        if self.db_trace:
            trace_id = self.db_trace.trace_id
        else:
            trace_id = await info.context.data_loaders.trace_fields.load(
                (self.trace_rowid, models.Trace.trace_id),
            )
        return ID(trace_id)

    @strawberry.field
    async def start_time(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_trace:
            start_time = self.db_trace.start_time
        else:
            start_time = await info.context.data_loaders.trace_fields.load(
                (self.trace_rowid, models.Trace.start_time),
            )
        return start_time

    @strawberry.field
    async def end_time(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_trace:
            end_time = self.db_trace.end_time
        else:
            end_time = await info.context.data_loaders.trace_fields.load(
                (self.trace_rowid, models.Trace.end_time),
            )
        return end_time

    @strawberry.field
    async def latency_ms(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_trace:
            latency_ms = self.db_trace.latency_ms
        else:
            latency_ms = await info.context.data_loaders.trace_fields.load(
                (self.trace_rowid, models.Trace.latency_ms),
            )
        return latency_ms

    @strawberry.field
    async def project(
        self,
        info: Info[Context, None],
    ) -> Annotated["Project", strawberry.lazy(".Project")]:
        if self.db_trace:
            project_rowid = self.db_trace.project_rowid
        else:
            project_rowid = await info.context.data_loaders.trace_fields.load(
                (self.trace_rowid, models.Trace.project_rowid),
            )
        from phoenix.server.api.types.Project import Project

        return Project(project_rowid=project_rowid)

    @strawberry.field
    async def project_id(
        self,
        info: Info[Context, None],
    ) -> GlobalID:
        if self.db_trace:
            project_rowid = self.db_trace.project_rowid
        else:
            project_rowid = await info.context.data_loaders.trace_fields.load(
                (self.trace_rowid, models.Trace.project_rowid),
            )
        from phoenix.server.api.types.Project import Project

        return GlobalID(type_name=Project.__name__, node_id=str(project_rowid))

    @strawberry.field
    async def project_session_id(
        self,
        info: Info[Context, None],
    ) -> Optional[GlobalID]:
        if self.db_trace:
            project_session_rowid = self.db_trace.project_session_rowid
        else:
            project_session_rowid = await info.context.data_loaders.trace_fields.load(
                (self.trace_rowid, models.Trace.project_session_rowid),
            )
        if project_session_rowid is None:
            return None
        from phoenix.server.api.types.ProjectSession import ProjectSession

        return GlobalID(type_name=ProjectSession.__name__, node_id=str(project_session_rowid))

    @strawberry.field
    async def session(
        self,
        info: Info[Context, None],
    ) -> Union[Annotated["ProjectSession", lazy(".ProjectSession")], None]:
        if self.db_trace:
            project_session_rowid = self.db_trace.project_session_rowid
        else:
            project_session_rowid = await info.context.data_loaders.trace_fields.load(
                (self.trace_rowid, models.Trace.project_session_rowid),
            )
        if project_session_rowid is None:
            return None
        from phoenix.server.api.types.ProjectSession import to_gql_project_session

        stmt = select(models.ProjectSession).filter_by(id=project_session_rowid)
        async with info.context.db() as session:
            project_session = await session.scalar(stmt)
        if project_session is None:
            return None
        return to_gql_project_session(project_session)

    @strawberry.field
    async def root_span(
        self,
        info: Info[Context, None],
    ) -> Optional[Span]:
        span_rowid = await info.context.data_loaders.trace_root_spans.load(self.trace_rowid)
        if span_rowid is None:
            return None
        return Span(span_rowid=span_rowid)

    @strawberry.field
    async def num_spans(
        self,
        info: Info[Context, None],
    ) -> int:
        return await info.context.data_loaders.num_spans_per_trace.load(self.trace_rowid)

    @strawberry.field
    async def spans(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Span]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = (
            select(models.Span.id)
            .join(models.Trace)
            .where(models.Trace.id == self.trace_rowid)
            # Sort descending because the root span tends to show up later
            # in the ingestion process.
            .order_by(desc(models.Span.id))
            .limit(first)
        )
        async with info.context.db() as session:
            span_rowids = await session.stream_scalars(stmt)
            data = [Span(span_rowid=span_rowid) async for span_rowid in span_rowids]
        return connection_from_list(data=data, args=args)

    @strawberry.field(description="Annotations associated with the trace.")  # type: ignore
    async def trace_annotations(
        self,
        info: Info[Context, None],
        sort: Optional[TraceAnnotationSort] = None,
    ) -> list[TraceAnnotation]:
        async with info.context.db() as session:
            stmt = select(models.TraceAnnotation).filter_by(trace_rowid=self.trace_rowid)
            if sort:
                sort_col = getattr(models.TraceAnnotation, sort.col.value)
                if sort.dir is SortDir.desc:
                    stmt = stmt.order_by(sort_col.desc(), models.TraceAnnotation.id.desc())
                else:
                    stmt = stmt.order_by(sort_col.asc(), models.TraceAnnotation.id.asc())
            else:
                stmt = stmt.order_by(models.TraceAnnotation.created_at.desc())
            annotations = await session.scalars(stmt)
        return [to_gql_trace_annotation(annotation) for annotation in annotations]

    @strawberry.field
    async def cost_summary(
        self,
        info: Info[Context, None],
    ) -> SpanCostSummary:
        loader = info.context.data_loaders.span_cost_summary_by_trace
        summary = await loader.load(self.trace_rowid)
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
    async def cost_detail_summary_entries(
        self,
        info: Info[Context, None],
    ) -> list[SpanCostDetailSummaryEntry]:
        loader = info.context.data_loaders.span_cost_detail_summary_entries_by_trace
        entries = await loader.load(self.trace_rowid)
        return [
            SpanCostDetailSummaryEntry(
                token_type=entry.token_type,
                is_prompt=entry.is_prompt,
                value=CostBreakdown(tokens=entry.value.tokens, cost=entry.value.cost),
            )
            for entry in entries
        ]


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
