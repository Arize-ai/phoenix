from typing import Optional

import strawberry
from strawberry.relay import GlobalID, Node, NodeID

from phoenix.db import models
from phoenix.server.api.types.PromptVersion import PromptVersion


@strawberry.type
class PromptVersionTag(Node):
    id_attr: NodeID[int]
    prompt_version_id: GlobalID
    name: str
    description: Optional[str] = None


def to_gql_prompt_version_tag(prompt_version_tag: models.PromptVersionTag) -> PromptVersionTag:
    version_gid = GlobalID(PromptVersion.__name__, str(prompt_version_tag.prompt_version_id))
    return PromptVersionTag(
        id_attr=prompt_version_tag.id,
        prompt_version_id=version_gid,
        name=prompt_version_tag.name,
        description=prompt_version_tag.description,
    )
