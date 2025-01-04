from enum import Enum
from typing import Any, Literal, Union

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


class PromptJSONSchema(BaseModel):
    """A JSON schema definition used to guide an LLM's output"""

    definition: dict[str, Any]


class PromptToolDefinition(PromptModel):
    definition: dict[str, Any]


class PromptToolsV1(PromptModel):
    version: Literal["tools-v1"] = "tools-v1"
    tool_definitions: list[PromptToolDefinition] = Field(..., min_length=1)
