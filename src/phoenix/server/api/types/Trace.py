from typing import List, Optional

import strawberry
from sqlalchemy import desc, select
from sqlalchemy.orm import contains_eager
from strawberry import UNSET
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Evaluation import TraceEvaluation
from phoenix.server.api.types.pagination import (
    Connection,
    ConnectionArgs,
    Cursor,
    connection_from_list,
)
from phoenix.server.api.types.Span import Span, to_gql_span


@strawberry.type
class Trace:
    trace_rowid: strawberry.Private[int]

    @strawberry.field
    async def spans(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
    ) -> Connection[Span]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, Cursor) else None,
            last=last,
            before=before if isinstance(before, Cursor) else None,
        )
        stmt = (
            select(models.Span)
            .join(models.Trace)
            .where(models.Trace.id == self.trace_rowid)
            .options(contains_eager(models.Span.trace))
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
        return await info.context.data_loaders.trace_evaluations.load(self.trace_rowid)
