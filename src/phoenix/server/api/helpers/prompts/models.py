from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Mapping, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, RootModel
from typing_extensions import Annotated, TypeAlias, TypeGuard, assert_never

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.conversions.anthropic import AnthropicToolChoiceConversion
from phoenix.server.api.helpers.prompts.conversions.openai import OpenAIToolChoiceConversion

JSONSerializable = Union[None, bool, int, float, str, dict[str, Any], list[Any]]


class Undefined:
    """
    A singleton class that represents an unset or undefined value. Needed since Pydantic
    can't natively distinguish between an undefined value and a value that is set to
    None.
    """

    def __new__(cls) -> Any:
        if not hasattr(cls, "_instance"):
            cls._instance = super().__new__(cls)
        return cls._instance

    def __bool__(self) -> bool:
        return False


UNDEFINED: Any = Undefined()


class PromptTemplateType(str, Enum):
    STRING = "STR"
    CHAT = "CHAT"


class PromptMessageRole(str, Enum):
    USER = "USER"
    SYSTEM = "SYSTEM"  # e.g. the OpenAI developer role or an Anthropic system instruction
    AI = "AI"  # E.g. the assistant. Normalize to AI for consistency.
    TOOL = "TOOL"


class PromptTemplateFormat(str, Enum):
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"
    NONE = "NONE"


class PromptModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",  # disallow extra attributes
        use_enum_values=True,
        validate_assignment=True,
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs = {k: v for k, v in kwargs.items() if v is not UNDEFINED}
        super().__init__(*args, **kwargs)

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return super().model_dump(*args, exclude_unset=True, by_alias=True, **kwargs)


class TextContentPart(PromptModel):
    type: Literal["text"]
    text: str


class ToolCallFunction(PromptModel):
    type: Literal["function"]
    name: str
    arguments: str


class ToolCallContentPart(PromptModel):
    type: Literal["tool_call"]
    tool_call_id: str
    tool_call: Annotated[
        ToolCallFunction,
        Field(..., discriminator="type"),
    ]


class ToolResultContentPart(PromptModel):
    type: Literal["tool_result"]
    tool_call_id: str
    tool_result: JSONSerializable


ContentPart: TypeAlias = Annotated[
    Union[TextContentPart, ToolCallContentPart, ToolResultContentPart],
    Field(..., discriminator="type"),
]

Role: TypeAlias = Literal["user", "assistant", "model", "ai", "tool", "system", "developer"]


class RoleConversion:
    @staticmethod
    def from_gql(role: PromptMessageRole) -> Role:
        if role is PromptMessageRole.USER:
            return "user"
        if role is PromptMessageRole.AI:
            return "ai"
        if role is PromptMessageRole.TOOL:
            return "tool"
        if role is PromptMessageRole.SYSTEM:
            return "system"
        assert_never(role)

    @staticmethod
    def to_gql(role: Role) -> PromptMessageRole:
        if role == "user":
            return PromptMessageRole.USER
        if role == "assistant":
            return PromptMessageRole.AI
        if role == "model":
            return PromptMessageRole.AI
        if role == "ai":
            return PromptMessageRole.AI
        if role == "tool":
            return PromptMessageRole.TOOL
        if role == "system":
            return PromptMessageRole.SYSTEM
        if role == "developer":
            return PromptMessageRole.SYSTEM
        assert_never(role)


class PromptMessage(PromptModel):
    role: Role
    content: Union[str, Annotated[list[ContentPart], Field(..., min_length=1)]]


class PromptChatTemplate(PromptModel):
    type: Literal["chat"]
    messages: list[PromptMessage]


class PromptStringTemplate(PromptModel):
    type: Literal["string"]
    template: str


PromptTemplate: TypeAlias = Annotated[
    Union[PromptChatTemplate, PromptStringTemplate], Field(..., discriminator="type")
]


def is_prompt_template(value: Any) -> TypeGuard[PromptTemplate]:
    return isinstance(value, (PromptChatTemplate, PromptStringTemplate))


class PromptTemplateRootModel(RootModel[PromptTemplate]):
    root: PromptTemplate


class PromptToolFunction(PromptModel):
    type: Literal["function"]
    function: PromptToolFunctionDefinition


class PromptToolFunctionDefinition(PromptModel):
    name: str
    description: str = UNDEFINED
    parameters: dict[str, Any] = UNDEFINED
    strict: bool = UNDEFINED


PromptTool: TypeAlias = Annotated[Union[PromptToolFunction], Field(..., discriminator="type")]


class PromptTools(PromptModel):
    type: Literal["tools"]
    tools: Annotated[list[PromptTool], Field(..., min_length=1)]
    tool_choice: PromptToolChoice = UNDEFINED
    disable_parallel_tool_calls: bool = UNDEFINED


class PromptToolChoiceNone(PromptModel):
    type: Literal["none"]


class PromptToolChoiceZeroOrMore(PromptModel):
    type: Literal["zero_or_more"]


class PromptToolChoiceOneOrMore(PromptModel):
    type: Literal["one_or_more"]


class PromptToolChoiceSpecificFunctionTool(PromptModel):
    type: Literal["specific_function"]
    function_name: str


PromptToolChoice: TypeAlias = Annotated[
    Union[
        PromptToolChoiceNone,
        PromptToolChoiceZeroOrMore,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
    ],
    Field(..., discriminator="type"),
]


class PromptOpenAIJSONSchema(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/d16e6edde5a155626910b5758a0b939bfedb9ced/src/openai/types/shared/response_format_json_schema.py#L13
    """

    name: str
    description: str = UNDEFINED
    schema_: dict[str, Any] = Field(
        ...,
        alias="schema",  # an alias is used to avoid conflict with the pydantic schema class method
    )
    strict: Optional[bool] = UNDEFINED


class PromptOpenAIResponseFormatJSONSchema(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/d16e6edde5a155626910b5758a0b939bfedb9ced/src/openai/types/shared/response_format_json_schema.py#L40
    """

    json_schema: PromptOpenAIJSONSchema
    type: Literal["json_schema"]


class PromptResponseFormatJSONSchema(PromptModel):
    type: Literal["json_schema"]
    json_schema: PromptResponseFormatJSONSchemaDefinition


class PromptResponseFormatJSONSchemaDefinition(PromptModel):
    name: str
    description: str = UNDEFINED
    schema_: dict[str, Any] = Field(UNDEFINED, alias="schema")
    strict: bool = UNDEFINED


PromptResponseFormat: TypeAlias = Annotated[
    Union[PromptResponseFormatJSONSchema], Field(..., discriminator="type")
]


class PromptResponseFormatRootModel(RootModel[PromptResponseFormat]):
    root: PromptResponseFormat


def _openai_to_prompt_response_format(
    schema: PromptOpenAIResponseFormatJSONSchema,
) -> PromptResponseFormat:
    json_schema = schema.json_schema
    return PromptResponseFormatJSONSchema(
        type="json_schema",
        json_schema=PromptResponseFormatJSONSchemaDefinition(
            name=json_schema.name,
            description=json_schema.description,
            schema=json_schema.schema_,
            strict=json_schema.strict if isinstance(json_schema.strict, bool) else UNDEFINED,
        ),
    )


def _prompt_to_openai_response_format(
    response_format: PromptResponseFormat,
) -> PromptOpenAIResponseFormatJSONSchema:
    assert isinstance(response_format, PromptResponseFormatJSONSchema)
    json_schema = response_format.json_schema
    return PromptOpenAIResponseFormatJSONSchema(
        type="json_schema",
        json_schema=PromptOpenAIJSONSchema(
            name=json_schema.name,
            description=json_schema.description,
            schema=json_schema.schema_,
            strict=json_schema.strict if isinstance(json_schema.strict, bool) else UNDEFINED,
        ),
    )


def normalize_response_format(
    response_format: dict[str, Any], model_provider: ModelProvider
) -> PromptResponseFormat:
    if model_provider is ModelProvider.OPENAI or model_provider is ModelProvider.AZURE_OPENAI:
        openai_response_format = PromptOpenAIResponseFormatJSONSchema.model_validate(
            response_format
        )
        return _openai_to_prompt_response_format(openai_response_format)
    raise ValueError(f"Unsupported model provider: {model_provider}")


def denormalize_response_format(
    response_format: PromptResponseFormat, model_provider: ModelProvider
) -> dict[str, Any]:
    if model_provider is ModelProvider.OPENAI or model_provider is ModelProvider.AZURE_OPENAI:
        openai_response_format = _prompt_to_openai_response_format(response_format)
        return openai_response_format.model_dump()
    raise ValueError(f"Unsupported model provider: {model_provider}")


# OpenAI tool definitions
class OpenAIFunctionDefinition(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/1e07c9d839e7e96f02d0a4b745f379a43086334c/src/openai/types/shared_params/function_definition.py#L13
    """

    name: str
    description: str = UNDEFINED
    parameters: dict[str, Any] = UNDEFINED
    strict: Optional[bool] = UNDEFINED


class OpenAIToolDefinition(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/1e07c9d839e7e96f02d0a4b745f379a43086334c/src/openai/types/chat/chat_completion_tool_param.py#L12
    """

    function: OpenAIFunctionDefinition
    type: Literal["function"]


# Anthropic tool definitions
class AnthropicCacheControlParam(PromptModel):
    """
    Based on https://github.com/anthropics/anthropic-sdk-python/blob/93cbbbde964e244f02bf1bd2b579c5fabce4e267/src/anthropic/types/cache_control_ephemeral_param.py#L10
    """

    type: Literal["ephemeral"]


class AnthropicToolDefinition(PromptModel):
    """
    Based on https://github.com/anthropics/anthropic-sdk-python/blob/93cbbbde964e244f02bf1bd2b579c5fabce4e267/src/anthropic/types/tool_param.py#L22
    """

    input_schema: dict[str, Any]
    name: str
    cache_control: Optional[AnthropicCacheControlParam] = UNDEFINED
    description: str = UNDEFINED


class PromptOpenAIInvocationParametersContent(PromptModel):
    temperature: float = UNDEFINED
    max_tokens: int = UNDEFINED
    frequency_penalty: float = UNDEFINED
    presence_penalty: float = UNDEFINED
    top_p: float = UNDEFINED
    seed: int = UNDEFINED
    reasoning_effort: Literal["low", "medium", "high"] = UNDEFINED


class PromptOpenAIInvocationParameters(PromptModel):
    type: Literal["openai"]
    openai: PromptOpenAIInvocationParametersContent


class PromptAzureOpenAIInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptAzureOpenAIInvocationParameters(PromptModel):
    type: Literal["azure_openai"]
    azure_openai: PromptAzureOpenAIInvocationParametersContent


class PromptAnthropicInvocationParametersContent(PromptModel):
    max_tokens: int
    temperature: float = UNDEFINED
    top_p: float = UNDEFINED
    stop_sequences: list[str] = UNDEFINED


class PromptAnthropicInvocationParameters(PromptModel):
    type: Literal["anthropic"]
    anthropic: PromptAnthropicInvocationParametersContent


class PromptGoogleInvocationParametersContent(PromptModel):
    temperature: float = UNDEFINED
    max_output_tokens: int = UNDEFINED
    stop_sequences: list[str] = UNDEFINED
    presence_penalty: float = UNDEFINED
    frequency_penalty: float = UNDEFINED
    top_p: float = UNDEFINED
    top_k: int = UNDEFINED


class PromptGoogleInvocationParameters(PromptModel):
    type: Literal["google"]
    google: PromptGoogleInvocationParametersContent


PromptInvocationParameters: TypeAlias = Annotated[
    Union[
        PromptOpenAIInvocationParameters,
        PromptAzureOpenAIInvocationParameters,
        PromptAnthropicInvocationParameters,
        PromptGoogleInvocationParameters,
    ],
    Field(..., discriminator="type"),
]


def get_raw_invocation_parameters(
    invocation_parameters: PromptInvocationParameters,
) -> dict[str, Any]:
    if isinstance(invocation_parameters, PromptOpenAIInvocationParameters):
        return invocation_parameters.openai.model_dump()
    if isinstance(invocation_parameters, PromptAzureOpenAIInvocationParameters):
        return invocation_parameters.azure_openai.model_dump()
    if isinstance(invocation_parameters, PromptAnthropicInvocationParameters):
        return invocation_parameters.anthropic.model_dump()
    if isinstance(invocation_parameters, PromptGoogleInvocationParameters):
        return invocation_parameters.google.model_dump()
    assert_never(invocation_parameters)


def is_prompt_invocation_parameters(
    invocation_parameters: Any,
) -> TypeGuard[PromptInvocationParameters]:
    return isinstance(
        invocation_parameters,
        (
            PromptOpenAIInvocationParameters,
            PromptAzureOpenAIInvocationParameters,
            PromptAnthropicInvocationParameters,
            PromptGoogleInvocationParameters,
        ),
    )


class PromptInvocationParametersRootModel(RootModel[PromptInvocationParameters]):
    root: PromptInvocationParameters


def validate_invocation_parameters(
    invocation_parameters: dict[str, Any],
    model_provider: ModelProvider,
) -> PromptInvocationParameters:
    if model_provider is ModelProvider.OPENAI:
        return PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent.model_validate(invocation_parameters),
        )
    elif model_provider is ModelProvider.AZURE_OPENAI:
        return PromptAzureOpenAIInvocationParameters(
            type="azure_openai",
            azure_openai=PromptAzureOpenAIInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.ANTHROPIC:
        return PromptAnthropicInvocationParameters(
            type="anthropic",
            anthropic=PromptAnthropicInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.GOOGLE:
        return PromptGoogleInvocationParameters(
            type="google",
            google=PromptGoogleInvocationParametersContent.model_validate(invocation_parameters),
        )
    assert_never(model_provider)


def normalize_tools(
    schemas: list[dict[str, Any]],
    model_provider: ModelProvider,
    tool_choice: Optional[Union[str, Mapping[str, Any]]] = None,
) -> PromptTools:
    tools: list[PromptToolFunction]
    if model_provider is ModelProvider.OPENAI or model_provider is ModelProvider.AZURE_OPENAI:
        openai_tools = [OpenAIToolDefinition.model_validate(schema) for schema in schemas]
        tools = [_openai_to_prompt_tool(openai_tool) for openai_tool in openai_tools]
    elif model_provider is ModelProvider.ANTHROPIC:
        anthropic_tools = [AnthropicToolDefinition.model_validate(schema) for schema in schemas]
        tools = [_anthropic_to_prompt_tool(anthropic_tool) for anthropic_tool in anthropic_tools]
    else:
        raise ValueError(f"Unsupported model provider: {model_provider}")
    ans = PromptTools(type="tools", tools=tools)
    if tool_choice is not None:
        if model_provider is ModelProvider.OPENAI or model_provider is ModelProvider.AZURE_OPENAI:
            ans.tool_choice = OpenAIToolChoiceConversion.from_openai(tool_choice)  # type: ignore[arg-type]
        elif model_provider is ModelProvider.ANTHROPIC:
            choice, disable_parallel_tool_calls = AnthropicToolChoiceConversion.from_anthropic(
                tool_choice  # type: ignore[arg-type]
            )
            ans.tool_choice = choice
            if disable_parallel_tool_calls is not None:
                ans.disable_parallel_tool_calls = disable_parallel_tool_calls
    return ans


def denormalize_tools(
    tools: PromptTools, model_provider: ModelProvider
) -> tuple[list[dict[str, Any]], Optional[Any]]:
    assert tools.type == "tools"
    denormalized_tools: list[PromptModel]
    tool_choice: Optional[Any] = None
    if model_provider is ModelProvider.OPENAI or model_provider is ModelProvider.AZURE_OPENAI:
        denormalized_tools = [_prompt_to_openai_tool(tool) for tool in tools.tools]
        if tools.tool_choice:
            tool_choice = OpenAIToolChoiceConversion.to_openai(tools.tool_choice)
    elif model_provider is ModelProvider.ANTHROPIC:
        denormalized_tools = [_prompt_to_anthropic_tool(tool) for tool in tools.tools]
        if tools.tool_choice and tools.tool_choice.type != "none":
            tool_choice = AnthropicToolChoiceConversion.to_anthropic(tools.tool_choice)
    else:
        raise ValueError(f"Unsupported model provider: {model_provider}")
    return [tool.model_dump() for tool in denormalized_tools], tool_choice


def _openai_to_prompt_tool(
    tool: OpenAIToolDefinition,
) -> PromptToolFunction:
    function_definition = tool.function
    name = function_definition.name
    description = function_definition.description
    return PromptToolFunction(
        type="function",
        function=PromptToolFunctionDefinition(
            name=name,
            description=description,
            parameters=function_definition.parameters,
            strict=function_definition.strict
            if isinstance(function_definition.strict, bool)
            else UNDEFINED,
        ),
    )


def _prompt_to_openai_tool(
    tool: PromptToolFunction,
) -> OpenAIToolDefinition:
    function = tool.function
    return OpenAIToolDefinition(
        type="function",
        function=OpenAIFunctionDefinition(
            name=function.name,
            description=function.description,
            parameters=function.parameters,
            strict=function.strict if isinstance(function.strict, bool) else UNDEFINED,
        ),
    )


def _anthropic_to_prompt_tool(
    tool: AnthropicToolDefinition,
) -> PromptToolFunction:
    return PromptToolFunction(
        type="function",
        function=PromptToolFunctionDefinition(
            name=tool.name,
            description=tool.description,
            parameters=tool.input_schema,
        ),
    )


def _prompt_to_anthropic_tool(
    tool: PromptToolFunction,
) -> AnthropicToolDefinition:
    function = tool.function
    return AnthropicToolDefinition(
        input_schema=function.parameters if function.parameters is not UNDEFINED else {},
        name=function.name,
        description=function.description,
    )
