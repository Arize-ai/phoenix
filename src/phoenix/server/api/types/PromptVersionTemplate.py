# Part of the Phoenix PromptHub feature set


import strawberry
from strawberry.scalars import JSON

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.server.api.helpers.prompts.models import JSONPromptMessage as JSONPromptMessageModel
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptMessageRole,
    PromptStringTemplateV1,
)
from phoenix.server.api.helpers.prompts.models import TextPromptMessage as TextPromptMessageModel


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


def to_gql_prompt_chat_template_from_orm(orm_model: "ORMPromptVersion") -> "PromptChatTemplate":
    model = PromptChatTemplateV1.model_validate(orm_model.template)
    messages: list[PromptTemplateMessage] = []
    for msg in model.template:
        if isinstance(msg.content, TextPromptMessageModel):
            messages.append(TextPromptMessage(role=msg.role, content=msg.content))
        elif isinstance(msg.content, JSONPromptMessageModel):
            messages.append(JSONPromptMessage(role=msg.role, content=msg.content))
        else:
            raise ValueError(f"Unknown message type: {msg}")
    return PromptChatTemplate(messages=messages)


@strawberry.type
class PromptStringTemplate:
    template: str


def to_gql_prompt_string_template_from_orm(orm_model: "ORMPromptVersion") -> "PromptStringTemplate":
    model = PromptStringTemplateV1.model_validate(orm_model.template)
    return PromptStringTemplate(template=model.template)


def to_gql_template_from_orm(orm_prompt_version: "ORMPromptVersion") -> "PromptTemplate":
    if orm_prompt_version.template_type == "str":
        return to_gql_prompt_string_template_from_orm(orm_prompt_version)
    elif orm_prompt_version.template_type == "chat":
        return to_gql_prompt_chat_template_from_orm(orm_prompt_version)
    else:
        raise ValueError(f"Unknown template type: {orm_prompt_version.template_type}")


PromptTemplate = strawberry.union("PromptTemplate", (PromptStringTemplate, PromptChatTemplate))
