# Part of the Phoenix PromptHub feature set

from typing import Union

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompthub.models import (
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


@strawberry.type
class PromptChatTemplateV1:
    version: str = "messages-v1"
    messages: list[Union[TextPromptMessage, JSONPromptMessage]]


@strawberry.type
class PromptStringTemplate:
    template: str


PromptTemplate = strawberry.union(
    "PromptTemplate", (PromptStringTemplate, PromptChatTemplateV1)
)
