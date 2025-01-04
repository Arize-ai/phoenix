from typing import Optional

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolDefinition,
    TextPromptMessage,
)


@strawberry.experimental.pydantic.input(PromptToolDefinition)
class ToolDefinitionInput:
    definition: JSON


@strawberry.input
class JSONSchemaInput:
    definition: JSON


@strawberry.experimental.pydantic.input(TextPromptMessage)
class TextPromptMessageInput:
    role: strawberry.auto
    content: strawberry.auto


@strawberry.experimental.pydantic.input(PromptChatTemplateV1)
class PromptChatTemplateInput:
    messages: list[TextPromptMessageInput]


@strawberry.input
class ChatPromptVersionInput:
    description: Optional[str] = None
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: PromptChatTemplateInput
    invocation_parameters: JSON = strawberry.field(default_factory=dict)
    tools: list[ToolDefinitionInput] = strawberry.field(default_factory=list)
    output_schema: Optional[JSONSchemaInput] = None
    model_provider: str
    model_name: str
