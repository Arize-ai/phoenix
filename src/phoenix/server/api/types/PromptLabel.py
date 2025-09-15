from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models
from phoenix.server.api.types.Identifier import Identifier


@strawberry.type
class PromptLabel(Node):
    id_attr: NodeID[int]
    name: Identifier
    description: Optional[str] = None
    color: str


def to_gql_prompt_label(label_orm: models.PromptLabel) -> PromptLabel:
    return PromptLabel(
        id_attr=label_orm.id,
        name=Identifier(label_orm.name),
        description=label_orm.description,
        color=label_orm.color,
    )
