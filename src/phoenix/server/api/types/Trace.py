from typing import List, Optional

import strawberry
from sqlalchemy import desc, select
from sqlalchemy.orm import contains_eager
from strawberry import UNSET
from strawberry.relay import ListConnection, Node, NodeID, connection
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Evaluation import TraceEvaluation
from phoenix.server.api.types.Span import Span, to_gql_span


@strawberry.type
class Trace(Node):
    id_attr: NodeID[int]

    @connection(ListConnection[Span])  # type: ignore
    async def spans(
        self,
        info: Info[Context, None],
        first: Optional[int] = UNSET,
        last: Optional[int] = UNSET,
        after: Optional[str] = UNSET,
        before: Optional[str] = UNSET,
    ) -> List[Span]:
        stmt = (
            select(models.Span)
            .join(models.Trace)
            .where(models.Trace.id == self.id_attr)
            .options(contains_eager(models.Span.trace))
            # Sort descending because the root span tends to show up later
            # in the ingestion process.
            .order_by(desc(models.Span.id))
            .limit(first)
        )
        async with info.context.db() as session:
            spans = await session.stream_scalars(stmt)
            return [to_gql_span(span) async for span in spans]

    @strawberry.field(description="Evaluations associated with the trace")  # type: ignore
    async def trace_evaluations(self, info: Info[Context, None]) -> List[TraceEvaluation]:
        return await info.context.data_loaders.trace_evaluations.load(self.id_attr)
