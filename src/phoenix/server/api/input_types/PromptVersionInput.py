from typing import Optional

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import (
    Image,
    PromptChatTemplateV1,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolDefinition,
    ToolResult,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptMessage as PromptMessageModel,
)


@strawberry.experimental.pydantic.input(PromptToolDefinition)
class ToolDefinitionInput:
    definition: JSON


@strawberry.input
class JSONSchemaInput:
    definition: JSON


@strawberry.experimental.pydantic.input(Image)
class ImageInput:
    type: str
    url: str


@strawberry.experimental.pydantic.input(ToolResult)
class ToolResultInput:
    type: str
    tool_call_id: strawberry.auto
    result: JSON


@strawberry.input
class PartInput:
    type: str
    text: Optional[str] = None
    image: Optional[ImageInput] = None
    tool_call: Optional[str] = None
    tool_result: Optional[ToolResultInput] = None


@strawberry.experimental.pydantic.input(PromptMessageModel)
class PromptMessageInput:
    role: str
    content: list[PartInput] = strawberry.field(default_factory=list)


@strawberry.experimental.pydantic.input(PromptChatTemplateV1)
class PromptChatTemplateInput:
    messages: list[PromptMessageInput]


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
