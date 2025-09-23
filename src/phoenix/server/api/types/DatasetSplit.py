from datetime import datetime
from typing import ClassVar, Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models


@strawberry.type
class DatasetSplit(Node):
    _table: ClassVar[type[models.Base]] = models.DatasetSplit
    id_attr: NodeID[int]
    name: str
    description: Optional[str]
    metadata: JSON
    color: str
    created_at: datetime
    updated_at: datetime


def to_gql_dataset_split(dataset_split: models.DatasetSplit) -> DatasetSplit:
    return DatasetSplit(
        id_attr=dataset_split.id,
        name=dataset_split.name,
        description=dataset_split.description,
        color=dataset_split.color or "#ffffff",
        metadata=dataset_split.metadata_,
        created_at=dataset_split.created_at,
        updated_at=dataset_split.updated_at,
    )
