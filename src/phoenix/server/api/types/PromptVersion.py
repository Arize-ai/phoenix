from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.helpers.prompts.models import (
    PromptJSONSchema,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolsV1,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptVersion as PromptVersionModel,
)
from phoenix.server.api.types.PromptVersionTemplate import (
    PromptTemplate,
    to_gql_prompt_template,
)

from .JSONSchema import JSONSchema, to_gql_json_schema_from_pydantic
from .PromptVersionTag import PromptVersionTag
from .ToolDefinition import ToolDefinition


@strawberry.experimental.pydantic.type(PromptVersionModel)
class PromptVersion(Node):
    id_attr: NodeID[int]
    user: strawberry.auto
    description: strawberry.auto
    template_type: strawberry.auto
    template_format: strawberry.auto
    template: PromptTemplate
    invocation_parameters: Optional[JSON] = None
    tools: list[ToolDefinition]
    output_schema: Optional[JSONSchema] = None
    model_name: strawberry.auto
    model_provider: strawberry.auto

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


def to_gql_prompt_version(prompt_version: models.PromptVersion) -> PromptVersion:
    prompt_template_type = PromptTemplateType(prompt_version.template_type)
    prompt_template = to_gql_prompt_template(prompt_version.template, prompt_template_type)
    prompt_template_format = PromptTemplateFormat(prompt_version.template_format)
    if prompt_version.tools is not None:
        prompt_tools = PromptToolsV1.model_validate(prompt_version.tools)
        tools = [
            ToolDefinition(definition=tool.definition) for tool in prompt_tools.tool_definitions
        ]
    else:
        tools = []
    output_schema = (
        to_gql_json_schema_from_pydantic(
            PromptJSONSchema.model_validate(prompt_version.output_schema)
        )
        if prompt_version.output_schema is not None
        else None
    )
    return PromptVersion(
        id_attr=prompt_version.id,
        description=prompt_version.description,
        template_type=prompt_template_type,
        template_format=prompt_template_format,
        template=prompt_template,
        invocation_parameters=prompt_version.invocation_parameters,
        tools=tools,
        output_schema=output_schema,
        model_name=prompt_version.model_name,
        model_provider=prompt_version.model_provider,
    )
