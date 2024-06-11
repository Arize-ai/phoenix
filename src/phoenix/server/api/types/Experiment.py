from datetime import datetime
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.api.types.pagination import (
    CursorString,
)


@strawberry.type
class Experiment(Node):
    id_attr: NodeID[int]
    description: Optional[str]
    metadata: JSON
    created_at: datetime
    updated_at: datetime

    def runs(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> ExperimentRun:
        # async with info.context.db() as session:
        raise NotImplementedError("runs resolver on Experiment not yet implemented")


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
