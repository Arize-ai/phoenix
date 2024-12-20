# Part of the Phoenix PromptHub feature set


import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import (
    PromptMessageRole,
)


@strawberry.type
class TextPromptMessage:
    role: PromptMessageRole
    content: str


@strawberry.type
class JSONPromptMessage:
    role: PromptMessageRole
    content: JSON


PromptTemplateMessage = strawberry.union(
    "PromptTemplateMessage", (TextPromptMessage, JSONPromptMessage)
)


@strawberry.type
class PromptChatTemplate:
    _version: str = "messages-v1"
    messages: list[PromptTemplateMessage]


@strawberry.type
class PromptStringTemplate:
    template: str


PromptTemplate = strawberry.union("PromptTemplate", (PromptStringTemplate, PromptChatTemplate))
