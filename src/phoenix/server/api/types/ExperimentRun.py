from datetime import datetime
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import Connection, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
)


@strawberry.type
class ExperimentRun(Node):
    id_attr: NodeID[int]
    trace_id: Optional[str]
    output: Optional[JSON]
    start_time: datetime
    end_time: datetime
    error: Optional[str]

    @strawberry.field
    async def annotations(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[ExperimentRunAnnotation]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        assert args
        raise NotImplementedError("annotations resolver on ExperimentRun is not implemented yet")


def to_gql_experiment_run(run: models.ExperimentRun) -> ExperimentRun:
    """
    Converts an ORM experiment run to a GraphQL ExperimentRun.
    """
    return ExperimentRun(
        id_attr=run.id,
        trace_id=trace_id
        if (trace := run.trace) and (trace_id := trace.trace_id) is not None
        else None,
        output=run.output,
        start_time=run.start_time,
        end_time=run.end_time,
        error=run.error,
    )
