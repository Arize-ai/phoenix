import json
from typing import Optional, cast

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    ContentPart,
    PromptChatTemplate,
    PromptMessage,
    PromptMessageRole,
    PromptTemplateFormat,
    RoleConversion,
    TextContentPart,
    ToolCallContentPart,
    ToolCallFunction,
    ToolResultContentPart,
)


@strawberry.input
class ToolDefinitionInput:
    definition: JSON


@strawberry.input
class ResponseFormatInput:
    definition: JSON


@strawberry.input
class TextContentValueInput:
    text: str


@strawberry.input
class ToolResultContentValueInput:
    tool_call_id: str
    result: JSON


@strawberry.input
class ToolCallFunctionInput:
    type: Optional[str] = strawberry.field(default="function")
    name: str
    arguments: str


@strawberry.input
class ToolCallContentValueInput:
    tool_call_id: str
    tool_call: ToolCallFunctionInput


@strawberry.input(one_of=True)
class ContentPartInput:
    text: Optional[TextContentValueInput] = strawberry.UNSET
    tool_call: Optional[ToolCallContentValueInput] = strawberry.UNSET
    tool_result: Optional[ToolResultContentValueInput] = strawberry.UNSET


@strawberry.input
class PromptMessageInput:
    role: str
    content: list[ContentPartInput]


@strawberry.input
class PromptChatTemplateInput:
    messages: list[PromptMessageInput]


@strawberry.input
class ChatPromptVersionInput:
    description: Optional[str] = None
    template_format: PromptTemplateFormat
    template: PromptChatTemplateInput
    invocation_parameters: JSON = strawberry.field(default_factory=dict)
    tools: list[ToolDefinitionInput] = strawberry.field(default_factory=list)
    response_format: Optional[ResponseFormatInput] = None
    model_provider: ModelProvider
    model_name: str


def to_pydantic_prompt_chat_template_v1(
    prompt_chat_template_input: PromptChatTemplateInput,
) -> PromptChatTemplate:
    return PromptChatTemplate(
        type="chat",
        messages=[
            to_pydantic_prompt_message(message) for message in prompt_chat_template_input.messages
        ],
    )


def to_pydantic_prompt_message(prompt_message_input: PromptMessageInput) -> PromptMessage:
    content = [
        to_pydantic_content_part(content_part) for content_part in prompt_message_input.content
    ]
    return PromptMessage(
        role=RoleConversion.from_gql(PromptMessageRole(prompt_message_input.role)),
        content=content,
    )


def to_pydantic_content_part(content_part_input: ContentPartInput) -> ContentPart:
    if content_part_input.text is not UNSET:
        assert content_part_input.text is not None
        return TextContentPart(
            type="text",
            text=content_part_input.text.text,
        )
    if content_part_input.tool_call is not UNSET:
        assert content_part_input.tool_call is not None
        return ToolCallContentPart(
            type="tool_call",
            tool_call_id=content_part_input.tool_call.tool_call_id,
            tool_call=ToolCallFunction(
                type="function",
                name=content_part_input.tool_call.tool_call.name,
                arguments=content_part_input.tool_call.tool_call.arguments,
            ),
        )
    if content_part_input.tool_result is not UNSET:
        assert content_part_input.tool_result is not None
        return ToolResultContentPart(
            type="tool_result",
            tool_call_id=content_part_input.tool_result.tool_call_id,
            tool_result=json.loads(cast(str, content_part_input.tool_result.result)),
        )
    raise ValueError("content part input has no content")
