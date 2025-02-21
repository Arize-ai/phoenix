from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional, Union

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import desc, select
from strawberry import UNSET, Private, lazy
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.TraceAnnotationSort import TraceAnnotationSort
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation, to_gql_trace_annotation

if TYPE_CHECKING:
    from phoenix.server.api.types.ProjectSession import ProjectSession

ProjectRowId: TypeAlias = int
TraceRowId: TypeAlias = int


@strawberry.type
class Trace(Node):
    trace_rowid: NodeID[TraceRowId]
    project_rowid: Private[ProjectRowId]
    project_session_rowid: Private[Optional[int]]
    trace_id: str
    start_time: datetime
    end_time: datetime

    @strawberry.field
    async def latency_ms(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        async with info.context.db() as session:
            latency = await session.scalar(
                select(
                    models.Trace.latency_ms,
                ).where(models.Trace.id == self.trace_rowid)
            )
        return latency

    @strawberry.field
    async def project_id(self) -> GlobalID:
        from phoenix.server.api.types.Project import Project

        return GlobalID(type_name=Project.__name__, node_id=str(self.project_rowid))

    @strawberry.field
    async def project_session_id(self) -> Optional[GlobalID]:
        if self.project_session_rowid is None:
            return None
        from phoenix.server.api.types.ProjectSession import ProjectSession

        return GlobalID(type_name=ProjectSession.__name__, node_id=str(self.project_session_rowid))

    @strawberry.field
    async def session(
        self,
        info: Info[Context, None],
    ) -> Union[Annotated["ProjectSession", lazy(".ProjectSession")], None]:
        if self.project_session_rowid is None:
            return None
        from phoenix.server.api.types.ProjectSession import to_gql_project_session

        stmt = select(models.ProjectSession).filter_by(id=self.project_session_rowid)
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
    async def span_annotations(
        self,
        info: Info[Context, None],
        sort: Optional[TraceAnnotationSort] = None,
    ) -> list[TraceAnnotation]:
        async with info.context.db() as session:
            stmt = select(models.TraceAnnotation).filter_by(span_rowid=self.trace_rowid)
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


def to_gql_trace(trace: models.Trace) -> Trace:
    return Trace(
        trace_rowid=trace.id,
        project_rowid=trace.project_rowid,
        project_session_rowid=trace.project_session_rowid,
        trace_id=trace.trace_id,
        start_time=trace.start_time,
        end_time=trace.end_time,
    )


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
