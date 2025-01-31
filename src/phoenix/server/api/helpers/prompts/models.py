from enum import Enum
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
from typing_extensions import Annotated, TypeAlias, assert_never

from phoenix.server.api.helpers.jsonschema import JSONSchemaObjectDefinition

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
    FSTRING = "FSTRING"
    NONE = "NONE"


class PromptModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",  # disallow extra attributes
        use_enum_values=True,
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs = {k: v for k, v in kwargs.items() if v is not UNDEFINED}
        super().__init__(*args, **kwargs)

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return super().model_dump(*args, exclude_unset=True, by_alias=True, **kwargs)


class PartBase(PromptModel):
    type: Literal["text", "image", "tool", "tool_call", "tool_result"]


class TextContentValue(BaseModel):
    text: str


class TextContentPart(PartBase):
    type: Literal["text"]
    text: TextContentValue


class ImageContentValue(BaseModel):
    # http url, or base64 encoded image
    url: str
    # detail: Optional[Literal["auto", "low", "high"]]


class ImageContentPart(PartBase):
    type: Literal["image"]
    # the image data
    image: ImageContentValue


class ToolCallFunction(BaseModel):
    type: Literal["function"]
    name: str
    arguments: str


class ToolCallContentValue(BaseModel):
    tool_call_id: str
    tool_call: ToolCallFunction


class ToolCallContentPart(PartBase):
    type: Literal["tool_call"]
    # the identifier of the tool call function
    tool_call: ToolCallContentValue


class ToolResultContentValue(BaseModel):
    tool_call_id: str
    result: JSONSerializable


class ToolResultContentPart(PartBase):
    type: Literal["tool_result"]
    tool_result: ToolResultContentValue


ContentPart: TypeAlias = Annotated[
    Union[TextContentPart, ImageContentPart, ToolCallContentPart, ToolResultContentPart],
    Field(..., discriminator="type"),
]


class PromptMessage(PromptModel):
    role: PromptMessageRole
    content: list[ContentPart]


class PromptChatTemplateV1(PromptModel):
    version: Literal["chat-template-v1"]
    messages: list[PromptMessage]


class PromptStringTemplateV1(PromptModel):
    version: Literal["string-template-v1"]
    template: str


PromptTemplate: TypeAlias = Annotated[
    Union[PromptChatTemplateV1, PromptStringTemplateV1], Field(..., discriminator="version")
]


class PromptTemplateWrapper(PromptModel):
    template: PromptTemplate


class PromptOutputSchema(PromptModel):
    definition: JSONSchemaObjectDefinition


class PromptCacheControlParam(PromptModel):
    type: Literal["ephemeral"]


class PromptFunctionToolV1(PromptModel):
    type: Literal["function-tool-v1"]
    name: str
    description: str = UNDEFINED
    schema_: JSONSchemaObjectDefinition = Field(
        default=UNDEFINED,
        alias="schema",  # avoid conflict with pydantic schema class method
    )
    strict: Optional[bool] = UNDEFINED
    cache_control: Optional[PromptCacheControlParam] = UNDEFINED


class PromptToolsV1(PromptModel):
    type: Literal["tools-v1"]
    tools: list[Annotated[Union[PromptFunctionToolV1], Field(..., discriminator="type")]]


def _get_tool_definition_model(
    model_provider: str,
) -> Optional[Union[type["OpenAIToolDefinition"], type["AnthropicToolDefinition"]]]:
    if model_provider.lower() == "openai":
        return OpenAIToolDefinition
    if model_provider.lower() == "anthropic":
        return AnthropicToolDefinition
    return None


# OpenAI tool definitions
class OpenAIFunctionDefinition(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/1e07c9d839e7e96f02d0a4b745f379a43086334c/src/openai/types/shared_params/function_definition.py#L13
    """

    name: str
    description: str = UNDEFINED
    parameters: JSONSchemaObjectDefinition = UNDEFINED
    strict: Optional[bool] = UNDEFINED


class OpenAIToolDefinition(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/1e07c9d839e7e96f02d0a4b745f379a43086334c/src/openai/types/chat/chat_completion_tool_param.py#L12
    """

    function: OpenAIFunctionDefinition
    type: Literal["function"]


# Anthropic tool definitions
class AnthropicCacheControlEphemeralParam(PromptModel):
    """
    Based on https://github.com/anthropics/anthropic-sdk-python/blob/93cbbbde964e244f02bf1bd2b579c5fabce4e267/src/anthropic/types/cache_control_ephemeral_param.py#L10
    """

    type: Literal["ephemeral"]


class AnthropicToolDefinition(PromptModel):
    """
    Based on https://github.com/anthropics/anthropic-sdk-python/blob/93cbbbde964e244f02bf1bd2b579c5fabce4e267/src/anthropic/types/tool_param.py#L22
    """

    input_schema: JSONSchemaObjectDefinition
    name: str
    cache_control: Optional[AnthropicCacheControlEphemeralParam] = UNDEFINED
    description: str = UNDEFINED


def normalize_tools(schemas: list[dict[str, Any]], model_provider: str) -> PromptToolsV1:
    tools: list[PromptFunctionToolV1]
    if model_provider.lower() == "openai":
        openai_tools = [OpenAIToolDefinition.model_validate(schema) for schema in schemas]
        tools = [_openai_to_prompt_tool(openai_tool) for openai_tool in openai_tools]
    elif model_provider.lower() == "anthropic":
        anthropic_tools = [AnthropicToolDefinition.model_validate(schema) for schema in schemas]
        tools = [_anthropic_to_prompt_tool(anthropic_tool) for anthropic_tool in anthropic_tools]
    else:
        raise ValueError(f"Unsupported model provider: {model_provider}")
    return PromptToolsV1(type="tools-v1", tools=tools)


def denormalize_tools(tools: PromptToolsV1, model_provider: str) -> list[dict[str, Any]]:
    assert tools.type == "tools-v1"
    denormalized_tools: list[PromptModel]
    if model_provider.lower() == "openai":
        denormalized_tools = [_prompt_to_openai_tool(tool) for tool in tools.tools]
    elif model_provider.lower() == "anthropic":
        denormalized_tools = [_prompt_to_anthropic_tool(tool) for tool in tools.tools]
    else:
        raise ValueError(f"Unsupported model provider: {model_provider}")
    return [tool.model_dump() for tool in denormalized_tools]


def _openai_to_prompt_tool(
    tool: OpenAIToolDefinition,
) -> PromptFunctionToolV1:
    function_definition = tool.function
    name = function_definition.name
    description = function_definition.description
    parameters = function_definition.parameters
    strict = function_definition.strict
    return PromptFunctionToolV1(
        type="function-tool-v1",
        name=name,
        description=description,
        schema=parameters,
        strict=strict,
    )


def _prompt_to_openai_tool(
    tool: PromptFunctionToolV1,
) -> OpenAIToolDefinition:
    return OpenAIToolDefinition(
        type="function",
        function=OpenAIFunctionDefinition(
            name=tool.name,
            description=tool.description,
            parameters=tool.schema_,
            strict=tool.strict,
        ),
    )


def _anthropic_to_prompt_tool(
    tool: AnthropicToolDefinition,
) -> PromptFunctionToolV1:
    return PromptFunctionToolV1(
        type="function-tool-v1",
        name=tool.name,
        description=tool.description,
        schema=tool.input_schema,
        cache_control=_anthropic_to_prompt_cache_control(tool.cache_control)
        if tool.cache_control is not UNDEFINED
        else UNDEFINED,
    )


def _anthropic_to_prompt_cache_control(
    cache_control: Optional[AnthropicCacheControlEphemeralParam],
) -> Optional[PromptCacheControlParam]:
    if cache_control is None:
        return cache_control
    if cache_control.type == "ephemeral":
        return PromptCacheControlParam(type="ephemeral")
    assert_never(cache_control)


def _prompt_to_anthropic_tool(
    tool: PromptFunctionToolV1,
) -> AnthropicToolDefinition:
    return AnthropicToolDefinition(
        input_schema=tool.schema_,
        name=tool.name,
        description=tool.description,
        cache_control=_prompt_to_anthropic_cache_control(tool.cache_control)
        if tool.cache_control is not UNDEFINED
        else UNDEFINED,
    )


def _prompt_to_anthropic_cache_control(
    cache_control: Optional[PromptCacheControlParam],
) -> Optional[AnthropicCacheControlEphemeralParam]:
    if cache_control is None:
        return cache_control
    if cache_control.type == "ephemeral":
        return AnthropicCacheControlEphemeralParam(type="ephemeral")
    assert_never(cache_control)
