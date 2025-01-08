from enum import Enum
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
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
) -> Optional[Union["OpenAIToolDefinition", "AnthropicToolDefinition"]]:
    if model_provider.lower() == "openai":
        return OpenAIToolDefinition
    if model_provider.lower() == "anthropic":
        return AnthropicToolDefinition
    return None


# JSON schema
JSONSchemaPrimitiveProperty: TypeAlias = Union[
    "JSONSchemaIntegerProperty",
    "JSONSchemaNumberProperty",
    "JSONSchemaBooleanProperty",
    "JSONSchemaNullProperty",
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


class JSONSchemaIntegerProperty(PromptModel):
    type: Literal["integer"]
    description: str = UNDEFINED
    minimum: int = UNDEFINED
    maximum: int = UNDEFINED

    @model_validator(mode="after")
    def ensure_minimum_lte_maximum(self) -> "JSONSchemaIntegerProperty":
        if (
            self.minimum is not UNDEFINED
            and self.maximum is not UNDEFINED
            and self.minimum > self.maximum
        ):
            raise ValueError("minimum must be less than or equal to maximum")
        return self


class JSONSchemaNumberProperty(PromptModel):
    type: Literal["number"]
    description: str = UNDEFINED
    minimum: float = UNDEFINED
    maximum: float = UNDEFINED

    @model_validator(mode="after")
    def ensure_minimum_lte_maximum(self) -> "JSONSchemaNumberProperty":
        if (
            self.minimum is not UNDEFINED
            and self.maximum is not UNDEFINED
            and self.minimum > self.maximum
        ):
            raise ValueError("minimum must be less than or equal to maximum")
        return self


class JSONSchemaBooleanProperty(PromptModel):
    type: Literal["boolean"]
    description: str = UNDEFINED


class JSONSchemaNullProperty(PromptModel):
    type: Literal["null"]
    description: str = UNDEFINED


class JSONSchemaStringProperty(PromptModel):
    type: Literal["string"]
    description: str = UNDEFINED
    enum: list[str] = UNDEFINED

    @field_validator("enum")
    def ensure_unique_enum_values(cls, enum_values: list[str]) -> list[str]:
        if enum_values is UNDEFINED:
            return enum_values
        if len(enum_values) != len(set(enum_values)):
            raise ValueError("Enum values must be unique")
        return enum_values


class JSONSchemaArrayProperty(PromptModel):
    type: Literal["array"]
    description: str = UNDEFINED
    items: Union[JSONSchemaProperty, "JSONSchemaAnyOf"]


class JSONSchemaObjectProperty(PromptModel):
    type: Literal["object"]
    description: str = UNDEFINED
    properties: dict[str, Union[JSONSchemaProperty, "JSONSchemaAnyOf"]]
    required: list[str] = UNDEFINED
    additional_properties: bool = Field(UNDEFINED, alias="additionalProperties")

    @model_validator(mode="after")
    def ensure_required_fields_are_included_in_properties(self) -> "JSONSchemaObjectProperty":
        if self.required is UNDEFINED:
            return self
        invalid_fields = [field for field in self.required if field not in self.properties]
        if invalid_fields:
            raise ValueError(f"Required fields {invalid_fields} are not defined in properties")
        return self


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


class AnthropicCacheControlEphemeralParam(PromptModel):
    """
    Based on https://github.com/anthropics/anthropic-sdk-python/blob/93cbbbde964e244f02bf1bd2b579c5fabce4e267/src/anthropic/types/cache_control_ephemeral_param.py#L10
    """

    type: Literal["ephemeral"]


# Anthropic tool definitions
class AnthropicToolDefinition(PromptModel):
    """
    Based on https://github.com/anthropics/anthropic-sdk-python/blob/93cbbbde964e244f02bf1bd2b579c5fabce4e267/src/anthropic/types/tool_param.py#L22
    """

    input_schema: JSONSchemaObjectProperty
    name: str
    cache_control: Optional[AnthropicCacheControlEphemeralParam] = UNDEFINED
    description: str = UNDEFINED
