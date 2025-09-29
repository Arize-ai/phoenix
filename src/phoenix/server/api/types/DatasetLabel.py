from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models


@strawberry.type
class DatasetLabel(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str]
    color: str


def to_gql_dataset_label(dataset_label: models.DatasetLabel) -> DatasetLabel:
    return DatasetLabel(
        id_attr=dataset_label.id,
        name=dataset_label.name,
        description=dataset_label.description,
        color=dataset_label.color,
    )
