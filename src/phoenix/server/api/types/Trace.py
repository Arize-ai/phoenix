from __future__ import annotations

from typing import List, Optional

import strawberry
from sqlalchemy import desc, select
from sqlalchemy.orm import contains_eager
from strawberry import UNSET, Private
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.TraceAnnotationSort import TraceAnnotationSort
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation, to_gql_trace_annotation


@strawberry.type
class Trace(Node):
    id_attr: NodeID[int]
    project_rowid: Private[int]
    trace_id: str

    @strawberry.field
    async def project_id(self) -> GlobalID:
        from phoenix.server.api.types.Project import Project

        return GlobalID(type_name=Project.__name__, node_id=str(self.project_rowid))

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
            select(models.Span)
            .join(models.Trace)
            .where(models.Trace.id == self.id_attr)
            .options(contains_eager(models.Span.trace).load_only(models.Trace.trace_id))
            # Sort descending because the root span tends to show up later
            # in the ingestion process.
            .order_by(desc(models.Span.id))
            .limit(first)
        )
        async with info.context.db() as session:
            spans = await session.stream_scalars(stmt)
            data = [to_gql_span(span) async for span in spans]
        return connection_from_list(data=data, args=args)

    @strawberry.field(description="Annotations associated with the trace.")  # type: ignore
    async def span_annotations(
        self,
        info: Info[Context, None],
        sort: Optional[TraceAnnotationSort] = None,
    ) -> List[TraceAnnotation]:
        async with info.context.db() as session:
            stmt = select(models.TraceAnnotation).filter_by(span_rowid=self.id_attr)
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
