from enum import Enum
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.server.api.types.PromptVersionTemplate import PromptTemplate, to_gql_prompt_template


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
    user: Optional[str] = None
    description: Optional[str] = None
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: PromptTemplate
    invocation_parameters: Optional[JSON] = None
    tools: Optional[JSON] = None
    output_schema: Optional[JSON] = None
    model_name: str
    model_provider: str


def to_gql_prompt_version(prompt_version: models.PromptVersion) -> PromptVersion:
    prompt_template_type = PromptTemplateType(prompt_version.template_type)
    prompt_template = to_gql_prompt_template(prompt_version.template, prompt_template_type)
    prompt_template_format = PromptTemplateFormat(prompt_version.template_format)
    return PromptVersion(
        id_attr=prompt_version.id,
        description=prompt_version.description,
        template_type=prompt_template_type,
        template_format=prompt_template_format,
        template=prompt_template,
        invocation_parameters=prompt_version.invocation_parameters,
        tools=prompt_version.tools,
        output_schema=prompt_version.output_schema,
        model_name=prompt_version.model_name,
        model_provider=prompt_version.model_provider,
    )
