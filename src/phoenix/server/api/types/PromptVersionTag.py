from typing import Optional

import strawberry
from strawberry import Info
from strawberry.relay import GlobalID, Node, NodeID

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.User import User, to_gql_user


@strawberry.type
class PromptVersionTag(Node):
    id_attr: NodeID[int]
    user_id: strawberry.Private[Optional[int]]
    prompt_version_id: GlobalID
    name: Identifier
    description: Optional[str] = None

    @strawberry.field
    async def user(self, info: Info[Context, None]) -> Optional[User]:
        if self.user_id is None:
            return None
        async with info.context.db() as session:
            user = await session.get(models.User, self.user_id)
        return to_gql_user(user) if user is not None else None


def to_gql_prompt_version_tag(prompt_version_tag: models.PromptVersionTag) -> PromptVersionTag:
    from phoenix.server.api.types.PromptVersion import PromptVersion

    version_gid = GlobalID(PromptVersion.__name__, str(prompt_version_tag.prompt_version_id))
    return PromptVersionTag(
        id_attr=prompt_version_tag.id,
        prompt_version_id=version_gid,
        name=Identifier(prompt_version_tag.name.root),
        description=prompt_version_tag.description,
        user_id=prompt_version_tag.user_id,
    )
