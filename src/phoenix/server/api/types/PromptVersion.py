# Part of the Phoenix PromptHub feature set

from enum import Enum
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.types.PromptVersionTemplate import PromptTemplate

from .PromptVersionTag import PromptVersionTag


@strawberry.enum
class PromptTemplateType(str, Enum):
    STRING = "str"
    CHAT = "chat"


@strawberry.enum
class PromptTemplateFormat(str, Enum):
    MUSTACHE = "mustache"
    FSTRING = "fstring"
    NONE = "none"


@strawberry.type
class PromptVersion(Node):
    id_attr: NodeID[int]
    user: Optional[str]
    description: str
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: PromptTemplate
    invocation_parameters: Optional[JSON] = None
    tools: Optional[JSON] = None
    output_schema: Optional[JSON] = None
    model_name: str
    model_provider: str

    @strawberry.field
    def tags(self, info: Info[Context, None]) -> list[PromptVersionTag]:
        # TODO fill out details
        return [
            PromptVersionTag(
                id_attr=1,
                name="tag 1",
                description="tag 1 description",
            ),
            PromptVersionTag(
                id_attr=2,
                name="tag 2",
                description="tag 2 description",
            ),
        ]
