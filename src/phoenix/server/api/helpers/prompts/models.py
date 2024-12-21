from enum import Enum
from typing import Any, Literal, Optional, TypeVar, Union

from pydantic import BaseModel, ConfigDict, Field
from typing_extensions import TypeAlias

JSONSerializable = Union[None, bool, int, float, str, dict[str, Any], list[Any]]
PromptModel = TypeVar("PromptModel", bound="BasePromptModel")


class PromptTemplateType(str, Enum):
    STRING = "str"
    CHAT = "chat"


class PromptMessageRole(str, Enum):
    USER = "user"
    SYSTEM = "system"  # e.g. the OpenAI developer role or an Anthropic system instruction
    AI = "ai"  # E.g. the assistant. Normalize to AI for consistency.
    TOOL = "tool"


class PromptTemplateFormat(str, Enum):
    MUSTACHE = "mustache"
    FSTRING = "fstring"
    NONE = "none"


class BasePromptModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",  # disallow extra attributes
    )


class TextPromptMessage(BasePromptModel):
    role: PromptMessageRole
    content: str


class JSONPromptMessage(BasePromptModel):
    role: PromptMessageRole
    content: JSONSerializable


class PromptChatTemplateV1(BasePromptModel):
    _version: str = "messages-v1"
    messages: list[Union[TextPromptMessage, JSONPromptMessage]]


class PromptStringTemplateV1(BasePromptModel):
    _version: str = "string-v1"
    template: str


PromptTemplate: TypeAlias = Union[PromptChatTemplateV1, PromptStringTemplateV1]


class PromptJSONSchema(BaseModel):
    """A JSON schema definition used to guide an LLM's output"""

    definition: dict[str, Any]


class PromptToolDefinition(BasePromptModel):
    definition: dict[str, Any]


class PromptToolsV1(BasePromptModel):
    version: Literal["tools-v1"] = "tools-v1"
    tool_definitions: list[PromptToolDefinition] = Field(..., min_length=1)


class PromptVersion(BasePromptModel):
    user: Optional[str] = None
    description: Optional[str] = None
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: PromptTemplate
    tools: list[PromptToolDefinition]
    output_schema: Optional[dict[str, Any]] = None
    model_name: str
    model_provider: str
