# Part of the Phoenix PromptHub feature set

from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy.sql import select
from strawberry import UNSET
from strawberry.relay import Connection, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list

from .PromptVersion import PromptVersion, to_gql_prompt_version_from_orm


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
        stmt = (
            select(models.PromptVersion)
            .where(models.PromptVersion.prompt_id == self.id_attr)
            .order_by(models.PromptVersion.created_at.desc())
        )
        async with info.context.db() as session:
            orm_prompt_versions = await session.stream_scalars(stmt)
            data = [
                to_gql_prompt_version_from_orm(prompt_version)
                async for prompt_version in orm_prompt_versions
            ]
            return connection_from_list(data=data, args=args)


def to_gql_prompt_from_orm(orm_model: "models.Prompt") -> Prompt:
    return Prompt(
        id_attr=orm_model.id,
        name=orm_model.name,
        description=orm_model.description,
        created_at=orm_model.created_at,
    )
