from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context


@strawberry.type
class DatasetLabel(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.DatasetLabel]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("DatasetLabel ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.dataset_label_fields.load(
                (self.id, models.DatasetLabel.name),
            )
        return val

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.dataset_label_fields.load(
                (self.id, models.DatasetLabel.description),
            )
        return val

    @strawberry.field
    async def color(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.color
        else:
            val = await info.context.data_loaders.dataset_label_fields.load(
                (self.id, models.DatasetLabel.color),
            )
        return val
