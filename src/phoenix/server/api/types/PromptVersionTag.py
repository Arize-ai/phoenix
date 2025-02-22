from typing import Optional

import strawberry
from strawberry.relay import GlobalID, Node, NodeID

from phoenix.db import models
from phoenix.server.api.types.Identifier import Identifier


@strawberry.type
class PromptVersionTag(Node):
    id_attr: NodeID[int]
    prompt_version_id: GlobalID
    name: Identifier
    description: Optional[str] = None


def to_gql_prompt_version_tag(prompt_version_tag: models.PromptVersionTag) -> PromptVersionTag:
    from phoenix.server.api.types.PromptVersion import PromptVersion

    version_gid = GlobalID(PromptVersion.__name__, str(prompt_version_tag.prompt_version_id))
    return PromptVersionTag(
        id_attr=prompt_version_tag.id,
        prompt_version_id=version_gid,
        name=Identifier(prompt_version_tag.name.root),
        description=prompt_version_tag.description,
    )
