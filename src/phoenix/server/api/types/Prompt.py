# Part of the Phoenix PromptHub feature set
from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry import UNSET
from strawberry.relay import Connection, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)

from .PromptVersion import (
    PromptVersion,
    to_gql_prompt_version,
)


@strawberry.type
class Prompt(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str]
    created_at: datetime

    @strawberry.field
    async def prompt_versions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[PromptVersion]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            prompt_versions = await session.scalars(
                select(models.PromptVersion)
                .where(models.PromptVersion.prompt_id == self.id_attr)
                .order_by(models.PromptVersion.id.desc())
            )
        return connection_from_list(
            data=[to_gql_prompt_version(prompt_version) for prompt_version in prompt_versions],
            args=args,
        )


def to_gql_prompt(prompt: models.Prompt) -> Prompt:
    return Prompt(
        id_attr=prompt.id,
        name=prompt.name,
        description=prompt.description,
        created_at=prompt.created_at,
    )
