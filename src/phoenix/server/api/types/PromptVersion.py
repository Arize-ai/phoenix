# Part of the Phoenix PromptHub feature set

from enum import Enum
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON


@strawberry.enum
class PromptTemplateType(str, Enum):
    TEXT = "text"
    JSON = "json"


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
    template: JSON
    invocation_parameters: Optional[JSON]
    tools: Optional[JSON]
    output_schema: Optional[JSON]
    model_name: str
    model_provider: str
