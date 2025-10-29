from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry import Info
from strawberry.relay import GlobalID, Node, NodeID

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.User import User

if TYPE_CHECKING:
    from .User import User


@strawberry.type
class PromptVersionTag(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.PromptVersionTag]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("PromptVersionTag ID mismatch")

    @strawberry.field
    async def prompt_version_id(
        self,
        info: Info[Context, None],
    ) -> GlobalID:
        from phoenix.server.api.types.PromptVersion import PromptVersion

        if self.db_record:
            version_id = self.db_record.prompt_version_id
        else:
            version_id = await info.context.data_loaders.prompt_version_tag_fields.load(
                (self.id, models.PromptVersionTag.prompt_version_id),
            )
        return GlobalID(PromptVersion.__name__, str(version_id))

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.prompt_version_tag_fields.load(
                (self.id, models.PromptVersionTag.name),
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
            val = await info.context.data_loaders.prompt_version_tag_fields.load(
                (self.id, models.PromptVersionTag.description),
            )
        return val

    @strawberry.field
    async def user(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.prompt_version_tag_fields.load(
                (self.id, models.PromptVersionTag.user_id),
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)
