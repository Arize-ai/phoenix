# Part of the Phoenix PromptHub feature set

from typing import Union

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompthub.models import (
    PromptMessageRole,
)
from phoenix.server.api.helpers.prompthub.models import (
    PromptStringTemplate as PromptStringTemplateModel,
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
class PromptMessagesTemplateV1:
    version: str = "messages-v1"
    messages: list[Union[TextPromptMessage, JSONPromptMessage]]


@strawberry.type
class PromptStringTemplate:
    template: str

    @classmethod
    def from_model(cls, model: PromptStringTemplateModel) -> "PromptStringTemplate":
        return PromptStringTemplate(template=model.template)


PromptTemplateVersion = strawberry.union(
    "PromptTemplateVersion", (PromptStringTemplate, PromptMessagesTemplateV1)
)
