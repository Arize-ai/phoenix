from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models


@strawberry.type
class PromptVersionTag(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str] = None


def to_gql_prompt_version_tag(prompt_version_tag: models.PromptVersionTag) -> PromptVersionTag:
    return PromptVersionTag(
        id_attr=prompt_version_tag.id,
        name=prompt_version_tag.name,
        description=prompt_version_tag.description,
    )
