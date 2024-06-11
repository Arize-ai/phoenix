from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry import UNSET
from strawberry.relay import Connection, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.ExperimentRunAnnotation import (
    ExperimentRunAnnotation,
    to_gql_experiment_run_annotation,
)
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
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
        run_id = self.id_attr
        async with info.context.db() as session:
            annotations = (
                await session.scalars(
                    select(models.ExperimentAnnotation)
                    .where(models.ExperimentAnnotation.experiment_run_id == run_id)
                    .order_by(models.ExperimentAnnotation.id.desc())
                )
            ).all()
        return connection_from_list(
            [to_gql_experiment_run_annotation(annotation) for annotation in annotations], args
        )


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
