from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Identifier import Identifier


@strawberry.type
class PromptLabel(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.PromptLabel]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("PromptLabel ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.prompt_label_fields.load(
                (self.id, models.PromptLabel.name),
            )
        return Identifier(val)

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.prompt_label_fields.load(
                (self.id, models.PromptLabel.description),
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
            val = await info.context.data_loaders.prompt_label_fields.load(
                (self.id, models.PromptLabel.color),
            )
        return val
