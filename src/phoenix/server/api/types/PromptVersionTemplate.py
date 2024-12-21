# Part of the Phoenix PromptHub feature set


from typing import TYPE_CHECKING, Annotated, Any, Union

import strawberry
from strawberry.scalars import JSON
from typing_extensions import TypeAlias, assert_never

from phoenix.server.api.helpers.prompts.models import (
    PromptMessageRole,
)

if TYPE_CHECKING:
    from phoenix.server.api.types.PromptVersion import PromptTemplateType


@strawberry.type
class TextPromptMessage:
    role: PromptMessageRole
    content: str


@strawberry.type
class JSONPromptMessage:
    role: PromptMessageRole
    content: JSON


PromptTemplateMessage: TypeAlias = Annotated[
    Union[TextPromptMessage, JSONPromptMessage],
    strawberry.union("PromptTemplateMessage", (TextPromptMessage, JSONPromptMessage)),
]


@strawberry.type
class PromptChatTemplate:
    _version: str = "messages-v1"
    messages: list[PromptTemplateMessage]


@strawberry.type
class PromptStringTemplate:
    template: str


PromptTemplate: TypeAlias = Annotated[
    Union[PromptStringTemplate, PromptChatTemplate],
    strawberry.union("PromptTemplate", (PromptStringTemplate, PromptChatTemplate)),
]


def to_gql_prompt_template(
    template: dict[str, Any], prompt_template_type: "PromptTemplateType"
) -> PromptTemplate:
    from phoenix.server.api.types.PromptVersion import PromptTemplateType

    if prompt_template_type == PromptTemplateType.STRING:
        return to_gql_prompt_string_template(template)
    elif prompt_template_type == PromptTemplateType.CHAT:
        return to_gql_prompt_chat_template(template)
    assert_never(prompt_template_type)


def to_gql_prompt_chat_template(template: dict[str, Any]) -> PromptChatTemplate:
    messages: list[PromptTemplateMessage] = []
    for message in template.get("messages", []):
        role = message["role"]
        content = message["content"]
        messages.append(TextPromptMessage(role=role, content=content))
    return PromptChatTemplate(messages=messages)


def to_gql_prompt_string_template(template: dict[str, Any]) -> PromptStringTemplate:
    raise NotImplementedError
