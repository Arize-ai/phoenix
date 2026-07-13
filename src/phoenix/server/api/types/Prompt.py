# Part of the Phoenix PromptHub feature set
from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from sqlalchemy import func, select
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)

from .PromptLabel import PromptLabel
from .PromptVersion import (
    PromptVersion,
    to_gql_prompt_version,
)
from .PromptVersionTag import PromptVersionTag

if TYPE_CHECKING:
    from .User import User


@strawberry.type
class Prompt(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.Prompt]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Prompt ID mismatch")

    @strawberry.field
    async def source_prompt_id(
        self,
        info: Info[Context, None],
    ) -> Optional[GlobalID]:
        if self.db_record:
            source_id = self.db_record.source_prompt_id
        else:
            source_id = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.source_prompt_id),
            )
        if not source_id:
            return None
        return GlobalID(Prompt.__name__, str(source_id))

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.name),
            )
        return Identifier(val.root)

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.description),
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
            val = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.metadata_),
            )
        return JSON(val)

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.created_at),
            )
        return val

    @strawberry.field(
        description="The user that created the prompt, i.e. the author of its first version."
    )  # type: ignore
    async def created_by(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        authors = await info.context.data_loaders.prompt_authors.load(self.id)
        from .User import to_gql_user

        return to_gql_user(authors.created_by)

    @strawberry.field(
        description="The user that last updated the prompt, i.e. the author of its latest version."
    )  # type: ignore
    async def updated_by(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        authors = await info.context.data_loaders.prompt_authors.load(self.id)
        from .User import to_gql_user

        return to_gql_user(authors.updated_by)

    @strawberry.field
    async def version(
        self,
        info: Info[Context, None],
        version_id: Optional[GlobalID] = None,
        tag_name: Optional[Identifier] = None,
    ) -> PromptVersion:
        if version_id:
            v_id = from_global_id_with_expected_type(version_id, PromptVersion.__name__)
            async with info.context.db.read() as session:
                version = await session.scalar(
                    select(models.PromptVersion).where(
                        models.PromptVersion.id == v_id,
                        models.PromptVersion.prompt_id == self.id,
                    )
                )
            if not version:
                raise NotFound(f"Prompt version not found: {version_id}")
            return to_gql_prompt_version(version)
        if tag_name:
            async with info.context.db.read() as session:
                version = await session.scalar(
                    select(models.PromptVersion)
                    .where(models.PromptVersion.prompt_id == self.id)
                    .join_from(models.PromptVersion, models.PromptVersionTag)
                    .where(models.PromptVersionTag.name == tag_name)
                )
            if not version:
                raise NotFound(f"This prompt has no associated versions by tag {tag_name}")
            return to_gql_prompt_version(version)
        latest_version_id = await info.context.data_loaders.latest_prompt_version_ids.load(self.id)
        if latest_version_id is None:
            raise NotFound("This prompt has no associated versions")
        version = await info.context.data_loaders.prompt_versions.load(latest_version_id)
        if not version:
            raise NotFound("This prompt has no associated versions")
        return to_gql_prompt_version(version)

    @strawberry.field
    async def version_count(self, info: Info[Context, None]) -> int:
        return await info.context.data_loaders.prompt_version_counts.load(self.id)

    @strawberry.field
    async def version_tags(self, info: Info[Context, None]) -> list[PromptVersionTag]:
        tags = await info.context.data_loaders.prompt_version_tags_by_prompt.load(self.id)
        return [PromptVersionTag(id=tag.id, db_record=tag) for tag in tags]

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
            .where(models.PromptVersion.prompt_id == self.id)
            .order_by(models.PromptVersion.id.desc())
        )
        async with info.context.db.read() as session:
            data = [
                to_gql_prompt_version(prompt_version, sequence_number)
                async for prompt_version, sequence_number in await session.stream(stmt)
            ]
            return connection_from_list(data=data, args=args)

    @strawberry.field
    async def source_prompt(self, info: Info[Context, None]) -> Optional["Prompt"]:
        if self.db_record:
            id_ = self.db_record.source_prompt_id
        else:
            id_ = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.source_prompt_id),
            )
        if not id_:
            return None
        async with info.context.db.read() as session:
            source_prompt = await session.get(models.Prompt, id_)
        if not source_prompt:
            raise NotFound(f"Source prompt not found: {id_}")
        return Prompt(id=source_prompt.id, db_record=source_prompt)

    @strawberry.field
    async def labels(self, info: Info[Context, None]) -> list["PromptLabel"]:
        labels = await info.context.data_loaders.prompt_labels_by_prompt.load(self.id)
        return [PromptLabel(id=label.id, db_record=label) for label in labels]
