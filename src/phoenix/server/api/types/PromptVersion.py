# Part of the Phoenix PromptHub feature set

from enum import Enum
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON

from phoenix.server.api.types.PromptVersionTemplate import PromptTemplateVersion


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
    template: PromptTemplateVersion
    invocation_parameters: Optional[JSON] = None
    tools: Optional[JSON] = None
    output_schema: Optional[JSON] = None
    model_name: str
    model_provider: str
