from enum import Enum
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from typing_extensions import Annotated, TypeAlias

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
    )


class PartBase(BaseModel):
    type: Literal["text", "image", "tool", "tool_call", "tool_result"]


class TextContentValue(BaseModel):
    text: str


class TextContentPart(PartBase):
    type: Literal["text"]
    text: TextContentValue


class ImageContentValue(BaseModel):
    # http url, or base64 encoded image
    url: str


class ImageContentPart(PartBase):
    type: Literal["image"]
    # the image data
    image: ImageContentValue


class ToolCallContentValue(BaseModel):
    tool_call: str


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
    Field(discriminator="type"),
]


class PromptMessage(PromptModel):
    role: PromptMessageRole
    content: list[ContentPart]


class PromptChatTemplateV1(PromptModel):
    _version: str = "messages-v1"
    messages: list[PromptMessage]


class PromptStringTemplateV1(PromptModel):
    _version: str = "string-v1"
    template: str


PromptTemplate: TypeAlias = Union[PromptChatTemplateV1, PromptStringTemplateV1]


class PromptJSONSchema(PromptModel):
    """A JSON schema definition used to guide an LLM's output"""

    definition: dict[str, Any]


class PromptToolDefinition(PromptModel):
    definition: dict[str, Any]


class PromptToolsV1(PromptModel):
    version: Literal["tools-v1"] = "tools-v1"
    tool_definitions: list[PromptToolDefinition]


class PromptVersion(PromptModel):
    user_id: Optional[int]
    description: Optional[str]
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: PromptTemplate
    invocation_parameters: Optional[dict[str, Any]]
    tools: PromptToolsV1
    output_schema: Optional[dict[str, Any]]
    model_name: str
    model_provider: str

    @model_validator(mode="after")
    def validate_tool_definitions_for_known_model_providers(self) -> "PromptVersion":
        tool_definitions = [tool_def.definition for tool_def in self.tools.tool_definitions]
        tool_definition_model = _get_tool_definition_model(self.model_provider)
        if tool_definition_model:
            for tool_definition_index, tool_definition in enumerate(tool_definitions):
                try:
                    tool_definition_model.model_validate(tool_definition)
                except ValidationError as error:
                    raise ValueError(
                        f"Invalid tool definition at index {tool_definition_index}: {error}"
                    )
        return self


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
