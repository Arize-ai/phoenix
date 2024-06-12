from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry import UNSET
from strawberry.relay import Connection, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.ExperimentRun import ExperimentRun, to_gql_experiment_run
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)


@strawberry.type
class Experiment(Node):
    id_attr: NodeID[int]
    description: Optional[str]
    metadata: JSON
    created_at: datetime
    updated_at: datetime

    @strawberry.field
    async def runs(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[ExperimentRun]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        experiment_id = self.id_attr
        async with info.context.db() as session:
            runs = (
                await session.scalars(
                    select(models.ExperimentRun)
                    .where(models.ExperimentRun.experiment_id == experiment_id)
                    .order_by(models.ExperimentRun.id.desc())
                    .options(
                        joinedload(models.ExperimentRun.trace).load_only(models.Trace.trace_id)
                    )
                )
            ).all()
        return connection_from_list([to_gql_experiment_run(run) for run in runs], args)


def to_gql_experiment(experiment: models.Experiment) -> Experiment:
    """
    Converts an ORM experiment to a GraphQL Experiment.
    """
    return Experiment(
        id_attr=experiment.id,
        description=experiment.description,
        metadata=experiment.metadata_,
        created_at=experiment.created_at,
        updated_at=experiment.updated_at,
    )
