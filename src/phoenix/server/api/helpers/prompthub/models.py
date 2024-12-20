from enum import Enum
from typing import Any, Union

import strawberry
from pydantic import BaseModel

JSONSerializable = Union[None, bool, int, float, str, dict[str, Any], list[Any]]


@strawberry.enum
class PromptMessageRole(str, Enum):
    USER = "user"
    SYSTEM = "system"  # e.g. the OpenAI developer role or an Anthropic system instruction
    AI = "ai"  # E.g. the assistant. Normalize to AI for consistency.
    TOOL = "tool"


class TextPromptMessage(BaseModel):
    role: PromptMessageRole
    content: str


class JSONPromptMessage(BaseModel):
    role: PromptMessageRole
    content: JSONSerializable


class PromptChatTemplateV1(BaseModel):
    _version: str = "messages-v1"
    template: list[Union[TextPromptMessage, JSONPromptMessage]]


class PromptStringTemplate(BaseModel):
    template: str


# TODO: Figure out enums, maybe just store whole tool blobs
# class PromptToolParameter(BaseModel):
#     name: str
#     type: str
#     description: str
#     required: bool
#     default: str


class PromptToolDefinition(BaseModel):
    definition: JSONSerializable


class PromptTools(BaseModel):
    _version: str = "tools-v1"
    tools: list[PromptToolDefinition]
