# Part of the Phoenix PromptHub feature set


from typing import Annotated, Union

import strawberry
from strawberry.scalars import JSON
from typing_extensions import TypeAlias, assert_never

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.server.api.helpers.prompts.models import ImagePart as ImagePartModel
from phoenix.server.api.helpers.prompts.models import ImageResult as ImageResultModel
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptStringTemplateV1,
    PromptTemplateType,
)
from phoenix.server.api.helpers.prompts.models import PromptMessage as PromptMessageModel
from phoenix.server.api.helpers.prompts.models import (
    PromptStringTemplateV1 as PromptStringTemplateModel,
)
from phoenix.server.api.helpers.prompts.models import TextPart as TextPartModel
from phoenix.server.api.helpers.prompts.models import ToolCallPart as ToolCallPartModel
from phoenix.server.api.helpers.prompts.models import ToolResult as ToolResultModel
from phoenix.server.api.helpers.prompts.models import ToolResultPart as ToolResultPartModel


@strawberry.experimental.pydantic.type(ImageResultModel)
class ImageResult:
    type: str
    url: strawberry.auto


@strawberry.experimental.pydantic.type(ToolResultModel)
class ToolResult:
    type: str
    tool_call_id: strawberry.auto
    result: JSON


@strawberry.experimental.pydantic.type(TextPartModel)
class TextPart:
    type: str
    text: strawberry.auto


@strawberry.experimental.pydantic.type(ImagePartModel)
class ImagePart:
    type: str
    image: ImageResult


@strawberry.experimental.pydantic.type(ToolCallPartModel)
class ToolCallPart:
    type: str
    tool_call: strawberry.auto


@strawberry.experimental.pydantic.type(ToolResultPartModel)
class ToolResultPart:
    type: str
    tool_result: ToolResult


Part: TypeAlias = Annotated[
    Union[TextPart, ImagePart, ToolCallPart, ToolResultPart],
    strawberry.union("Part"),
]


@strawberry.experimental.pydantic.type(PromptMessageModel)
class PromptMessage:
    role: strawberry.auto
    content: list[Part]


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
