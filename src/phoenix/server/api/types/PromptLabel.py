from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.Prompt import Prompt, to_gql_prompt_from_orm


@strawberry.type
class PromptLabel(Node):
    id_attr: NodeID[int]
    name: Identifier
    description: Optional[str] = None

    @strawberry.field
    async def prompts(self, info: Info[Context, None]) -> list[Prompt]:
        async with info.context.db() as session:
            statement = (
                select(models.Prompt)
                .join(
                    models.PromptPromptLabel, models.Prompt.id == models.PromptPromptLabel.prompt_id
                )
                .where(models.PromptPromptLabel.prompt_label_id == self.id_attr)
            )
            return [
                to_gql_prompt_from_orm(prompt_orm)
                async for prompt_orm in await session.stream_scalars(statement)
            ]


def to_gql_prompt_label(label_orm: models.PromptLabel) -> PromptLabel:
    return PromptLabel(
        id_attr=label_orm.id,
        name=Identifier(label_orm.name),
        description=label_orm.description,
    )
