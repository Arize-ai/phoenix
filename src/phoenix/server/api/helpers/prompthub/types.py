from enum import Enum
from typing import TypeAlias, Union

from pydantic import BaseModel, Field

JSONSerializable: TypeAlias = Union[
    None, bool, int, float, str, dict["JSONSerializable"], list["JSONSerializable"]
]


class PromptMessageRole(str, Enum):
    USER = "user"
    SYSTEM = "system"
    AI = "ai"  # E.g. the assistant. Normalize to AI for consistency.


class TextPromptMessage(BaseModel):
    role: PromptMessageRole
    content: str


class JSONPromptMessage(BaseModel):
    role: PromptMessageRole
    content: JSONSerializable


class PromptMessagesTemplateV1(BaseModel):
    _version: str = "messages-v1"
    messages: list[Union[TextPromptMessage, JSONPromptMessage]]


class PromptToolParameter(BaseModel):
    name: str
    type: str
    description: str
    required: bool
    default: str


class PromptToolDefinition(BaseModel):
    _version: str = "tool-definition-v1"
    name: str
    type: str
    description: str
    parameters: list[PromptToolParameter] = Field(default_factory=list)
