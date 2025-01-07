from enum import Enum
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
from typing_extensions import TypeAlias

JSONSerializable = Union[None, bool, int, float, str, dict[str, Any], list[Any]]


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


class TextPromptMessage(PromptModel):
    role: PromptMessageRole
    content: str


class JSONPromptMessage(PromptModel):
    role: PromptMessageRole
    content: JSONSerializable


class PromptChatTemplateV1(PromptModel):
    _version: str = "messages-v1"
    messages: list[Union[TextPromptMessage, JSONPromptMessage]]


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
    tool_definitions: list[PromptToolDefinition] = Field(..., min_length=1)


# Tool models
JSONSchemaDataType = Literal["string", "number", "boolean", "object", "array", "null", "integer"]


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


JSONSchemaPropertyType = Union["JSONSchema", "JSONSchemaProperty", "JSONSchemaPropertyUnion"]


class JSONSchemaProperty(PromptModel):
    type: JSONSchemaDataType
    description: str = UNDEFINED
    items: JSONSchemaPropertyType = UNDEFINED
    enum: list[str] = UNDEFINED


class JSONSchemaPropertyUnion(PromptModel):
    any_of: list[Union["JSONSchema", "JSONSchemaProperty"]] = Field(UNDEFINED, alias="anyOf")


class JSONSchema(PromptModel):
    type: JSONSchemaDataType
    description: str = UNDEFINED
    properties: dict[str, JSONSchemaPropertyType] = UNDEFINED
    required: list[str] = UNDEFINED
    additional_properties: bool = Field(UNDEFINED, alias="additionalProperties")


class OpenAIFunctionDefinition(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/1e07c9d839e7e96f02d0a4b745f379a43086334c/src/openai/types/shared_params/function_definition.py#L13
    """

    name: str
    description: str = UNDEFINED
    parameters: JSONSchema = UNDEFINED
    strict: Optional[bool] = UNDEFINED


class OpenAIToolDefinition(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/1e07c9d839e7e96f02d0a4b745f379a43086334c/src/openai/types/chat/chat_completion_tool_param.py#L12
    """

    function: OpenAIFunctionDefinition
    type: Literal["function"]
