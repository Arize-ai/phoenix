import json
from typing import Any, Optional, Union, cast

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    ContentPart,
    PromptChatTemplate,
    PromptMessage,
    PromptMessageRole,
    PromptTemplateFormat,
    PromptTemplateType,
    RoleConversion,
    TextContentPart,
    ToolCallContentPart,
    ToolCallFunction,
    ToolResultContentPart,
    normalize_response_format,
    normalize_tools,
    validate_invocation_parameters,
)
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type


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
    custom_provider_id: Optional[GlobalID] = None

    def __post_init__(self) -> None:
        self.invocation_parameters = {
            k: v for k, v in self.invocation_parameters.items() if v is not None
        }

    def to_orm_prompt_version(
        self,
        user_id: Optional[int],
    ) -> models.PromptVersion:
        tool_definitions = [tool.definition for tool in self.tools]
        tool_choice = cast(
            Optional[Union[str, dict[str, Any]]],
            cast(dict[str, Any], self.invocation_parameters).pop("tool_choice", None),
        )
        model_provider = ModelProvider(self.model_provider)
        tools = (
            normalize_tools(tool_definitions, model_provider, tool_choice)
            if tool_definitions
            else None
        )
        template = to_pydantic_prompt_chat_template_v1(self.template)
        response_format = (
            normalize_response_format(
                self.response_format.definition,
                model_provider,
            )
            if self.response_format
            else None
        )
        invocation_parameters = validate_invocation_parameters(
            self.invocation_parameters,
            model_provider,
        )
        # Parse GlobalID to get the integer custom provider ID
        custom_provider_id: Optional[int] = None
        if self.custom_provider_id is not None:
            custom_provider_id = from_global_id_with_expected_type(
                global_id=self.custom_provider_id,
                expected_type_name=GenerativeModelCustomProvider.__name__,
            )
        return models.PromptVersion(
            description=self.description,
            user_id=user_id,
            template_type=PromptTemplateType.CHAT,
            template_format=self.template_format,
            template=template,
            invocation_parameters=invocation_parameters,
            tools=tools,
            response_format=response_format,
            model_provider=ModelProvider(self.model_provider),
            model_name=self.model_name,
            custom_provider_id=custom_provider_id,
            # metadata_ will default to {} in the DB if not provided due to the NOT NULL constraint,
            # so setting it here allows us to more accurately check prompt version equality
            # between prompts that have been saved to the DB and those that haven't.
            metadata_={},
        )


def to_pydantic_prompt_chat_template_v1(
    prompt_chat_template_input: PromptChatTemplateInput,
) -> PromptChatTemplate:
    return PromptChatTemplate(
        type="chat",
        messages=[
            to_pydantic_prompt_message(message) for message in prompt_chat_template_input.messages
        ],
    )


def to_pydantic_prompt_message(
    prompt_message_input: PromptMessageInput,
) -> PromptMessage:
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
