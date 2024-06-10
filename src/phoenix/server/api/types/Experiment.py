from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models


@strawberry.type
class Experiment(Node):
    id_attr: NodeID[int]
    description: Optional[str]
    metadata: JSON
    created_at: datetime
    updated_at: datetime


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
