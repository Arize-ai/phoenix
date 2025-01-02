# Part of the Phoenix PromptHub feature set

from enum import Enum
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.server.api.context import Context
from phoenix.server.api.types.PromptVersionTemplate import PromptTemplate, template_from_orm

from .JSONSchema import JSONSchema
from .PromptVersionTag import PromptVersionTag
from .ToolDefinition import ToolDefinition, to_gql_tool_definitions_from_orm


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
    description: Optional[str]
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: PromptTemplate
    invocation_parameters: Optional[JSON] = None
    tools: list[ToolDefinition]
    output_schema: Optional[JSONSchema] = None
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


def to_gql_prompt_version_from_orm(orm_model: ORMPromptVersion) -> PromptVersion:
    return PromptVersion(
        id_attr=orm_model.id,
        user=None,  # TODO: propagate user if provided
        description=orm_model.description,
        template_type=PromptTemplateType(orm_model.template_type),
        template_format=PromptTemplateFormat(orm_model.template_format),
        template=template_from_orm(orm_model),
        invocation_parameters=orm_model.invocation_parameters,
        tools=to_gql_tool_definitions_from_orm(orm_model),
        output_schema=JSONSchema(schema=orm_model.output_schema)
        if orm_model.output_schema
        else None,
        model_name=orm_model.model_name,
        model_provider=orm_model.model_provider,
    )
