# Part of the Phoenix PromptHub feature set


from typing import Annotated, Union

import strawberry
from strawberry.scalars import JSON
from typing_extensions import TypeAlias, assert_never

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.server.api.helpers.prompts.models import (
    JSONPromptMessage as JSONPromptMessageModel,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptStringTemplateV1,
    PromptTemplateType,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptStringTemplateV1 as PromptStringTemplateModel,
)
from phoenix.server.api.helpers.prompts.models import (
    TextPromptMessage as TextPromptMessageModel,
)


@strawberry.experimental.pydantic.type(TextPromptMessageModel)
class TextPromptMessage:
    role: strawberry.auto
    content: strawberry.auto


@strawberry.experimental.pydantic.type(JSONPromptMessageModel)
class JSONPromptMessage:
    role: strawberry.auto
    content: JSON


PromptTemplateMessage: TypeAlias = Annotated[
    Union[TextPromptMessage, JSONPromptMessage],
    strawberry.union("PromptTemplateMessage"),
]


@strawberry.experimental.pydantic.type(PromptChatTemplateV1)
class PromptChatTemplate:
    _version: strawberry.Private[str] = "messages-v1"
    messages: list[PromptTemplateMessage]


def to_gql_prompt_chat_template_from_orm(orm_model: "ORMPromptVersion") -> "PromptChatTemplate":
    template = PromptChatTemplateV1.model_validate(orm_model.template)
    messages: list[PromptTemplateMessage] = []
    for msg in template.messages:
        if isinstance(msg, TextPromptMessageModel):
            messages.append(TextPromptMessage(role=msg.role, content=msg.content))
        elif isinstance(msg, JSONPromptMessageModel):
            messages.append(JSONPromptMessage(role=msg.role, content=msg.content))
        else:
            assert_never(msg)
    return PromptChatTemplate(messages=messages)


@strawberry.experimental.pydantic.type(PromptStringTemplateModel)
class PromptStringTemplate:
    template: strawberry.auto


def to_gql_prompt_string_template_from_orm(orm_model: "ORMPromptVersion") -> "PromptStringTemplate":
    model = PromptStringTemplateV1.model_validate(orm_model.template)
    return PromptStringTemplate(template=model.template)


def to_gql_template_from_orm(orm_prompt_version: "ORMPromptVersion") -> "PromptTemplate":
    template_type = PromptTemplateType(orm_prompt_version.template_type)
    if template_type is PromptTemplateType.STRING:
        return to_gql_prompt_string_template_from_orm(orm_prompt_version)
    elif template_type is PromptTemplateType.CHAT:
        return to_gql_prompt_chat_template_from_orm(orm_prompt_version)
    assert_never(template_type)


PromptTemplate: TypeAlias = Annotated[
    Union[PromptStringTemplate, PromptChatTemplate],
    strawberry.union("PromptTemplate"),
]
