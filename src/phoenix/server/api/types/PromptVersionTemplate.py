# Part of the Phoenix PromptHub feature set


from typing import Annotated, Any, Union

import strawberry
from pydantic import Field
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
    PromptToolDefinition as PromptToolDefinitionModelModel,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptToolsV1 as PromptToolsModel,
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
        if isinstance(msg.content, TextPromptMessageModel):
            messages.append(TextPromptMessage(role=msg.role, content=msg.content))
        elif isinstance(msg.content, JSONPromptMessageModel):
            messages.append(JSONPromptMessage(role=msg.role, content=msg.content))
        else:
            raise ValueError(f"Unknown message type: {msg}")
    return PromptChatTemplate(messages=messages)


@strawberry.experimental.pydantic.type(PromptStringTemplateModel)
class PromptStringTemplate:
    template: strawberry.auto


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


PromptTemplate: TypeAlias = Annotated[
    Union[PromptStringTemplate, PromptChatTemplate],
    strawberry.union("PromptTemplate"),
]


@strawberry.experimental.pydantic.type(PromptToolDefinitionModelModel)
class PromptToolDefinition:
    definition: JSON


@strawberry.experimental.pydantic.type(PromptToolsModel)
class PromptTools:
    version: strawberry.auto
    tool_definitions: list[PromptToolDefinition] = Field(default_factory=list)


def to_gql_prompt_template(
    template: dict[str, Any], prompt_template_type: "PromptTemplateType"
) -> PromptTemplate:
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
