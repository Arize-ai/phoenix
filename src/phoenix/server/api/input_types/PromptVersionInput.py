from typing import Optional

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import (
    ImageContentValue,
    PromptChatTemplateV1,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolDefinition,
    TextContentValue,
    ToolCallContentValue,
    ToolResultContentValue,
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


@strawberry.experimental.pydantic.input(TextContentValue)
class TextContentValueInput:
    text: str


@strawberry.experimental.pydantic.input(ImageContentValue)
class ImageContentValueInput:
    url: str


@strawberry.experimental.pydantic.input(ToolResultContentValue)
class ToolResultContentValueInput:
    tool_call_id: strawberry.auto
    result: JSON


@strawberry.experimental.pydantic.input(ToolCallContentValue)
class ToolCallContentValueInput:
    tool_call_id: strawberry.auto


@strawberry.input(one_of=True)
class ContentPartInput:
    text: Optional[TextContentValueInput] = strawberry.UNSET
    image: Optional[ImageContentValueInput] = strawberry.UNSET
    tool_call: Optional[ToolCallContentValueInput] = strawberry.UNSET
    tool_result: Optional[ToolResultContentValueInput] = strawberry.UNSET


@strawberry.experimental.pydantic.input(PromptMessageModel)
class PromptMessageInput:
    role: str
    content: list[ContentPartInput] = strawberry.field(default_factory=list)


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
