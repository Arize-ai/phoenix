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
from phoenix.server.api.types.Evaluation import TraceEvaluation
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.Span import Span, to_gql_span


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

    @strawberry.field(description="Evaluations associated with the trace")  # type: ignore
    async def trace_evaluations(self, info: Info[Context, None]) -> List[TraceEvaluation]:
        return await info.context.data_loaders.trace_evaluations.load(self.id_attr)
