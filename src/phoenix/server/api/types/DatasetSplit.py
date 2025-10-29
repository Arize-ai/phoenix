from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context


@strawberry.type
class DatasetSplit(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.DatasetSplit]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("DatasetSplit ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.dataset_split_fields.load(
                (self.id, models.DatasetSplit.name),
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
            val = await info.context.data_loaders.dataset_split_fields.load(
                (self.id, models.DatasetSplit.description),
            )
        return val

    @strawberry.field
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        if self.db_record:
            val = self.db_record.metadata_
        else:
            val = await info.context.data_loaders.dataset_split_fields.load(
                (self.id, models.DatasetSplit.metadata_),
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
            val = await info.context.data_loaders.dataset_split_fields.load(
                (self.id, models.DatasetSplit.color),
            )
        return val

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.dataset_split_fields.load(
                (self.id, models.DatasetSplit.created_at),
            )
        return val

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.dataset_split_fields.load(
                (self.id, models.DatasetSplit.updated_at),
            )
        return val
