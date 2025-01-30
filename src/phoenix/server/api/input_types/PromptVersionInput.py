from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import (
    ContentPart,
    ImageContentPart,
    ImageContentValue,
    PromptChatTemplateV1,
    PromptMessage,
    PromptTemplateFormat,
    PromptToolDefinition,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolCallContentValue,
    ToolCallFunction,
    ToolResultContentPart,
    ToolResultContentValue,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptMessage as PromptMessageModel,
)


@strawberry.experimental.pydantic.input(PromptToolDefinition)
class ToolDefinitionInput:
    definition: JSON


@strawberry.input
class OutputSchemaInput:
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


@strawberry.experimental.pydantic.input(ToolCallFunction)
class ToolCallFunctionInput:
    name: strawberry.auto
    arguments: strawberry.auto


@strawberry.experimental.pydantic.input(ToolCallContentValue)
class ToolCallContentValueInput:
    tool_call_id: strawberry.auto
    tool_call: ToolCallFunctionInput


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


@strawberry.input
class PromptChatTemplateInput:
    messages: list[PromptMessageInput]
    version: strawberry.Private[str] = "chat-template-v1"


@strawberry.input
class ChatPromptVersionInput:
    description: Optional[str] = None
    template_format: PromptTemplateFormat
    template: PromptChatTemplateInput
    invocation_parameters: JSON = strawberry.field(default_factory=dict)
    tools: list[ToolDefinitionInput] = strawberry.field(default_factory=list)
    output_schema: Optional[OutputSchemaInput] = None
    model_provider: str
    model_name: str


def to_pydantic_prompt_chat_template_v1(
    prompt_chat_template_input: PromptChatTemplateInput,
) -> PromptChatTemplateV1:
    return PromptChatTemplateV1(
        version="chat-template-v1",
        messages=[
            to_pydantic_prompt_message(message) for message in prompt_chat_template_input.messages
        ],
    )


def to_pydantic_prompt_message(prompt_message_input: PromptMessageInput) -> PromptMessage:
    return PromptMessage(
        role=prompt_message_input.role,
        content=[
            to_pydantic_content_part(content_part) for content_part in prompt_message_input.content
        ],
    )


def to_pydantic_content_part(content_part_input: ContentPartInput) -> ContentPart:
    content_part_cls: type[ContentPart]
    if content_part_input.text is not UNSET:
        content_part_cls = TextContentPart
        content_part_type = "text"
    elif content_part_input.image is not UNSET:
        content_part_cls = ImageContentPart
        content_part_type = "image"
    elif content_part_input.tool_call is not UNSET:
        content_part_cls = ToolCallContentPart
        content_part_type = "tool_call"
    elif content_part_input.tool_result is not UNSET:
        content_part_cls = ToolResultContentPart
        content_part_type = "tool_result"
    else:
        raise ValueError("content part input has no content")
    content_part_data = {
        k: v for k, v in strawberry.asdict(content_part_input).items() if v is not UNSET
    }
    return content_part_cls.model_validate(
        {
            "type": content_part_type,
            **content_part_data,
        }
    )
