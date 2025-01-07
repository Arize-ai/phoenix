from abc import ABC
from enum import Enum
from typing import Any, Generic, Literal, Optional, TypeVar, Union

from pydantic import BaseModel, ConfigDict, Field
from typing_extensions import TypeAlias

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


# JSON schema
JSONSchemaPrimitiveProperty: TypeAlias = Union[
    "JSONSchemaNumberProperty",
    "JSONSchemaBooleanProperty",
    "JSONSchemaNullProperty",
    "JSONSchemaIntegerProperty",
    "JSONSchemaStringProperty",
]
JSONSchemaContainerProperty: TypeAlias = Union[
    "JSONSchemaArrayProperty",
    "JSONSchemaObjectProperty",
]
JSONSchemaProperty: TypeAlias = Union[
    "JSONSchemaPrimitiveProperty",
    "JSONSchemaContainerProperty",
]
JSONSchemaDataType = TypeVar(
    "JSONSchemaDataType",
    bound=Literal["number", "boolean", "null", "integer", "string", "array", "object"],
)


class BaseJSONSchemaProperty(ABC, Generic[JSONSchemaDataType], PromptModel):
    type: JSONSchemaDataType
    description: str = UNDEFINED


class JSONSchemaNumberProperty(BaseJSONSchemaProperty[Literal["number"]]):
    pass


class JSONSchemaBooleanProperty(BaseJSONSchemaProperty[Literal["boolean"]]):
    pass


class JSONSchemaNullProperty(BaseJSONSchemaProperty[Literal["null"]]):
    pass


class JSONSchemaIntegerProperty(BaseJSONSchemaProperty[Literal["integer"]]):
    pass


class JSONSchemaStringProperty(BaseJSONSchemaProperty[Literal["string"]]):
    enum: list[str] = UNDEFINED


class JSONSchemaArrayProperty(BaseJSONSchemaProperty[Literal["array"]]):
    items: Union[JSONSchemaProperty, "JSONSchemaAnyOf"] = UNDEFINED


class JSONSchemaObjectProperty(BaseJSONSchemaProperty[Literal["object"]]):
    properties: dict[str, Union[JSONSchemaProperty, "JSONSchemaAnyOf"]] = UNDEFINED
    required: list[str] = UNDEFINED
    additional_properties: bool = Field(UNDEFINED, alias="additionalProperties")


class JSONSchemaAnyOf(PromptModel):
    description: str = UNDEFINED
    any_of: list[JSONSchemaProperty] = Field(..., alias="anyOf")


# OpenAI tool definitions
class OpenAIFunctionDefinition(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/1e07c9d839e7e96f02d0a4b745f379a43086334c/src/openai/types/shared_params/function_definition.py#L13
    """

    name: str
    description: str = UNDEFINED
    parameters: JSONSchemaObjectProperty = UNDEFINED
    strict: Optional[bool] = UNDEFINED


class OpenAIToolDefinition(PromptModel):
    """
    Based on https://github.com/openai/openai-python/blob/1e07c9d839e7e96f02d0a4b745f379a43086334c/src/openai/types/chat/chat_completion_tool_param.py#L12
    """

    function: OpenAIFunctionDefinition
    type: Literal["function"]
