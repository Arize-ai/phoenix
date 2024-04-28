from typing import List, Optional

import strawberry
from sqlalchemy import select
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
        async with info.context.db() as session:
            spans = await session.scalars(
                select(models.Span)
                .join(models.Trace)
                .where(models.Trace.id == self.trace_rowid)
                .options(contains_eager(models.Span.trace))
            )
        data = [to_gql_span(span) for span in spans]
        return connection_from_list(data=data, args=args)

    @strawberry.field(description="Evaluations associated with the trace")  # type: ignore
    async def trace_evaluations(self, info: Info[Context, None]) -> List[TraceEvaluation]:
        return await info.context.data_loaders.trace_evaluations.load(self.trace_rowid)
