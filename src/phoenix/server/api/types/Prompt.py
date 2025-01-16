# Part of the Phoenix PromptHub feature set
from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import func, select
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)

from .PromptVersion import (
    PromptVersion,
    to_gql_prompt_version,
)
from .PromptVersionTag import PromptVersionTag, to_gql_prompt_version_tag


@strawberry.type
class Prompt(Node):
    id_attr: NodeID[int]
    source_prompt_id: Optional[GlobalID]
    name: Identifier
    description: Optional[str]
    created_at: datetime

    @strawberry.field
    async def version(
        self, info: Info[Context, None], version_id: Optional[GlobalID] = None
    ) -> PromptVersion:
        async with info.context.db() as session:
            if version_id:
                v_id = from_global_id_with_expected_type(version_id, PromptVersion.__name__)
                version = await session.scalar(
                    select(models.PromptVersion).where(
                        models.PromptVersion.id == v_id,
                        models.PromptVersion.prompt_id == self.id_attr,
                    )
                )
                if not version:
                    raise NotFound(f"Prompt version not found: {version_id}")
            else:
                stmt = (
                    select(models.PromptVersion)
                    .where(models.PromptVersion.prompt_id == self.id_attr)
                    .order_by(models.PromptVersion.id.desc())
                    .limit(1)
                )
                version = await session.scalar(stmt)
                if not version:
                    raise NotFound("This prompt has no associated versions")
            return to_gql_prompt_version(version)

    @strawberry.field
    async def version_tags(self, info: Info[Context, None]) -> list[PromptVersionTag]:
        async with info.context.db() as session:
            stmt = select(models.PromptVersionTag).where(
                models.PromptVersionTag.prompt_id == self.id_attr
            )
            return [
                to_gql_prompt_version_tag(tag) async for tag in await session.stream_scalars(stmt)
            ]

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
        row_number = func.row_number().over(order_by=models.PromptVersion.id).label("row_number")
        stmt = (
            select(models.PromptVersion, row_number)
            .where(models.PromptVersion.prompt_id == self.id_attr)
            .order_by(models.PromptVersion.id.desc())
        )
        async with info.context.db() as session:
            data = [
                to_gql_prompt_version(prompt_version, sequence_number)
                async for prompt_version, sequence_number in await session.stream(stmt)
            ]
            return connection_from_list(data=data, args=args)

    @strawberry.field
    async def source_prompt(self, info: Info[Context, None]) -> Optional["Prompt"]:
        if not self.source_prompt_id:
            return None

        source_prompt_id = from_global_id_with_expected_type(
            global_id=self.source_prompt_id, expected_type_name=Prompt.__name__
        )

        async with info.context.db() as session:
            source_prompt = await session.scalar(
                select(models.Prompt).where(models.Prompt.id == source_prompt_id)
            )
            if not source_prompt:
                raise NotFound(f"Source prompt not found: {self.source_prompt_id}")
            return to_gql_prompt_from_orm(source_prompt)


def to_gql_prompt_from_orm(orm_model: "models.Prompt") -> Prompt:
    if not orm_model.source_prompt_id:
        source_prompt_gid = None
    else:
        source_prompt_gid = GlobalID(
            Prompt.__name__,
            str(orm_model.source_prompt_id),
        )
    return Prompt(
        id_attr=orm_model.id,
        source_prompt_id=source_prompt_gid,
        name=Identifier(orm_model.name.root),
        description=orm_model.description,
        created_at=orm_model.created_at,
    )
