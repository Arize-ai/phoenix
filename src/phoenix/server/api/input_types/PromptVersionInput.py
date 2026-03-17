import json
from typing import Any, Optional, cast

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.prompts import (
    ContentPart,
    PromptChatTemplate,
    PromptMessage,
    PromptMessageRole,
    PromptResponseFormatJSONSchema,
    PromptResponseFormatJSONSchemaDefinition,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolChoice,
    PromptToolChoiceNone,
    PromptToolChoiceOneOrMore,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolChoiceZeroOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
    RoleConversion,
    TextContentPart,
    ToolCallContentPart,
    ToolCallFunction,
    ToolResultContentPart,
    validate_invocation_parameters,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.GenerativeModelCustomProvider import GenerativeModelCustomProvider
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.node import from_global_id_with_expected_type

# ---------------------------------------------------------------------------
# Canonical tool input types  (isomorphic to DB PromptTools / PromptTool*)
# ---------------------------------------------------------------------------


@strawberry.input
class PromptToolFunctionDefinitionInput:
    name: str
    description: Optional[str] = None
    parameters: Optional[JSON] = None
    strict: Optional[bool] = None

    def to_orm(self) -> PromptToolFunctionDefinition:
        return PromptToolFunctionDefinition(
            name=self.name,
            description=self.description if self.description is not None else UNDEFINED,
            parameters=self.parameters if self.parameters is not None else UNDEFINED,
            strict=self.strict if isinstance(self.strict, bool) else UNDEFINED,
        )


@strawberry.input
class PromptToolFunctionInput:
    function: PromptToolFunctionDefinitionInput

    def to_orm(self) -> PromptToolFunction:
        return PromptToolFunction(type="function", function=self.function.to_orm())


@strawberry.input(one_of=True)
class PromptToolChoiceInput:
    """
    Canonical tool-choice using OneOf — set exactly one field:
      none: true          → no tool use
      zero_or_more: true  → model may call zero or more tools
      one_or_more: true   → model must call at least one tool
      function_name: str  → model must call the named function
    """

    none: Optional[bool] = UNSET
    zero_or_more: Optional[bool] = UNSET
    one_or_more: Optional[bool] = UNSET
    function_name: Optional[str] = UNSET

    def to_orm(self) -> PromptToolChoice:
        if self.none is not UNSET:
            return PromptToolChoiceNone(type="none")
        if self.zero_or_more is not UNSET:
            return PromptToolChoiceZeroOrMore(type="zero_or_more")
        if self.one_or_more is not UNSET:
            return PromptToolChoiceOneOrMore(type="one_or_more")
        if self.function_name is not UNSET:
            return PromptToolChoiceSpecificFunctionTool(
                type="specific_function",
                function_name=self.function_name or "",
            )
        raise ValueError("PromptToolChoiceInput: no field is set")


@strawberry.input
class PromptToolsInput:
    tools: list[PromptToolFunctionInput]
    tool_choice: Optional[PromptToolChoiceInput] = None
    disable_parallel_tool_calls: Optional[bool] = None

    def to_orm(self) -> PromptTools:
        pt = PromptTools(type="tools", tools=[t.to_orm() for t in self.tools])
        if self.tool_choice is not None:
            pt.tool_choice = self.tool_choice.to_orm()
        if self.disable_parallel_tool_calls is not None:
            pt.disable_parallel_tool_calls = self.disable_parallel_tool_calls
        return pt


# ---------------------------------------------------------------------------
# Canonical response-format input types  (isomorphic to DB PromptResponseFormatJSONSchema)
# ---------------------------------------------------------------------------


@strawberry.input
class PromptResponseFormatJSONSchemaDefinitionInput:
    name: str
    description: Optional[str] = None
    schema: Optional[JSON] = None
    strict: Optional[bool] = None

    def to_orm(self) -> PromptResponseFormatJSONSchemaDefinition:
        return PromptResponseFormatJSONSchemaDefinition(
            name=self.name,
            description=self.description if self.description is not None else UNDEFINED,
            schema=self.schema if self.schema is not None else UNDEFINED,
            strict=self.strict if isinstance(self.strict, bool) else UNDEFINED,
        )


@strawberry.input
class PromptResponseFormatJSONSchemaInput:
    type: str  # always "json_schema"
    json_schema: PromptResponseFormatJSONSchemaDefinitionInput

    def to_orm(self) -> PromptResponseFormatJSONSchema:
        return PromptResponseFormatJSONSchema(
            type="json_schema", json_schema=self.json_schema.to_orm()
        )


# ---------------------------------------------------------------------------
# Message input types (unchanged)
# ---------------------------------------------------------------------------


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

    def to_orm(self) -> ContentPart:
        if self.text:
            return TextContentPart(
                type="text",
                text=self.text.text,
            )
        if self.tool_call:
            return ToolCallContentPart(
                type="tool_call",
                tool_call_id=self.tool_call.tool_call_id,
                tool_call=ToolCallFunction(
                    type="function",
                    name=self.tool_call.tool_call.name,
                    arguments=self.tool_call.tool_call.arguments,
                ),
            )
        if self.tool_result:
            return ToolResultContentPart(
                type="tool_result",
                tool_call_id=self.tool_result.tool_call_id,
                tool_result=json.loads(cast(str, self.tool_result.result)),
            )
        raise BadRequest("ContentPartInput: no field is set")


@strawberry.input
class PromptMessageInput:
    role: PromptMessageRole
    content: list[ContentPartInput]

    def to_orm(self) -> PromptMessage:
        return PromptMessage(
            role=RoleConversion.from_gql(self.role),
            content=[content_part.to_orm() for content_part in self.content],
        )


@strawberry.input
class PromptChatTemplateInput:
    messages: list[PromptMessageInput]

    def to_orm(self) -> PromptChatTemplate:
        return PromptChatTemplate(
            type="chat",
            messages=[message.to_orm() for message in self.messages],
        )


# ---------------------------------------------------------------------------
# Main input type
# ---------------------------------------------------------------------------


@strawberry.input
class ChatPromptVersionInput:
    description: Optional[str] = None
    template_format: PromptTemplateFormat
    template: PromptChatTemplateInput
    invocation_parameters: JSON = strawberry.field(default_factory=dict)
    tools: Optional[PromptToolsInput] = None
    response_format: Optional[PromptResponseFormatJSONSchemaInput] = None
    model_provider: GenerativeProviderKey
    model_name: str
    custom_provider_id: Optional[GlobalID] = None

    def resolved_custom_provider_id(self) -> Optional[int]:
        """Convert the GraphQL GlobalID to a raw DB primary key."""
        if self.custom_provider_id is None:
            return None
        return from_global_id_with_expected_type(
            global_id=self.custom_provider_id,
            expected_type_name=GenerativeModelCustomProvider.__name__,
        )

    def __post_init__(self) -> None:
        self.invocation_parameters = {
            k: v for k, v in self.invocation_parameters.items() if v is not None
        }

    def to_orm_prompt_version(
        self,
        user_id: Optional[int],
    ) -> models.PromptVersion:
        model_provider = self.model_provider.to_model_provider()

        tools = self.tools.to_orm() if self.tools else None
        response_format = self.response_format.to_orm() if self.response_format else None
        invocation_parameters = validate_invocation_parameters(
            cast(dict[str, Any], self.invocation_parameters),
            model_provider,
        )
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
            template=self.template.to_orm(),
            invocation_parameters=invocation_parameters,
            tools=tools,
            response_format=response_format,
            model_provider=self.model_provider.to_model_provider(),
            model_name=self.model_name,
            custom_provider_id=custom_provider_id,
            # metadata_ will default to {} in the DB if not provided due to the NOT NULL constraint,
            # so setting it here allows us to more accurately check prompt version equality
            # between prompts that have been saved to the DB and those that haven't.
            metadata_={},
        )
