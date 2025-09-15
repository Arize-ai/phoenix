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

    # async def color(self, info: Info[Context, None]) -> str:
    #     return await info.context.data_loaders.dataset_split_color.load(self.id_attr)

    # @strawberry.field
    # async def dataset_examples(
    #     self,
    #     info: Info[Context, None],
    #     first: Optional[int] = 50,
    #     last: Optional[int] = UNSET,
    #     after: Optional[CursorString] = UNSET,
    #     before: Optional[CursorString] = UNSET,
    # ) -> Connection[DatasetExample]:
    #     return await info.context.data_loaders.dataset_split_dataset_examples.load(self.id_attr)


def to_gql_dataset_split(dataset_split: models.DatasetSplit) -> DatasetSplit:
    return DatasetSplit(
        id_attr=dataset_split.id,
        name=dataset_split.name,
        description=dataset_split.description,
        color=dataset_split.color or "#ffffff",
        metadata=dataset_split.metadata,
        created_at=dataset_split.created_at,
        updated_at=dataset_split.updated_at,
    )
