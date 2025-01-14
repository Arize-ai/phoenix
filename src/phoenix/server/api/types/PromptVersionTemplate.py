# Part of the Phoenix PromptHub feature set


from typing import Annotated, Union

import strawberry
from strawberry.scalars import JSON
from typing_extensions import TypeAlias, assert_never

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.server.api.helpers.prompts.models import (
    ImageContentValue as ImageContentValueModel,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptStringTemplateV1,
    PromptTemplateType,
)
from phoenix.server.api.helpers.prompts.models import PromptMessage as PromptMessageModel
from phoenix.server.api.helpers.prompts.models import (
    PromptStringTemplateV1 as PromptStringTemplateModel,
)
from phoenix.server.api.helpers.prompts.models import (
    TextContentValue as TextContentValueModel,
)
from phoenix.server.api.helpers.prompts.models import (
    ToolCallContentValue as ToolCallContentValueModel,
)
from phoenix.server.api.helpers.prompts.models import (
    ToolResultContentValue as ToolResultContentValueModel,
)


@strawberry.experimental.pydantic.type(TextContentValueModel, all_fields=True)
class TextContentValue:
    pass


@strawberry.experimental.pydantic.type(ImageContentValueModel, all_fields=True)
class ImageContentValue:
    pass


@strawberry.experimental.pydantic.type(ToolCallContentValueModel, all_fields=True)
class ToolCallContentValue:
    pass


@strawberry.experimental.pydantic.type(ToolResultContentValueModel)
class ToolResultContentValue:
    tool_call_id: strawberry.auto
    result: JSON


ContentPart: TypeAlias = Annotated[
    Union[TextContentValue, ImageContentValue, ToolCallContentValue, ToolResultContentValue],
    strawberry.union("ContentPart"),
]


@strawberry.experimental.pydantic.type(PromptMessageModel)
class PromptMessage:
    role: strawberry.auto
    content: list[ContentPart]


@strawberry.experimental.pydantic.type(PromptChatTemplateV1)
class PromptChatTemplate:
    _version: strawberry.Private[str] = "messages-v1"
    messages: list[PromptMessage]


def to_gql_prompt_chat_template_from_orm(orm_model: "ORMPromptVersion") -> "PromptChatTemplate":
    template = PromptChatTemplateV1.model_validate(orm_model.template)
    messages: list[PromptMessage] = []
    for msg in template.messages:
        if isinstance(msg, PromptMessageModel):
            messages.append(PromptMessage(role=msg.role, content=msg.content))
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
