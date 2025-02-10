# Part of the Phoenix PromptHub feature set


from typing import Annotated, Union

import strawberry
from strawberry.scalars import JSON
from typing_extensions import TypeAlias, assert_never

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.server.api.helpers.prompts.models import ImageContentPart as ImageContentPartModel
from phoenix.server.api.helpers.prompts.models import (
    ImageContentValue as ImageContentValueModel,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate as PromptChatTemplateModel,
)
from phoenix.server.api.helpers.prompts.models import PromptMessage as PromptMessageModel
from phoenix.server.api.helpers.prompts.models import (
    PromptStringTemplate as PromptStringTemplateModel,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptTemplateType,
)
from phoenix.server.api.helpers.prompts.models import TextContentPart as TextContentPartModel
from phoenix.server.api.helpers.prompts.models import (
    TextContentValue as TextContentValueModel,
)
from phoenix.server.api.helpers.prompts.models import (
    ToolCallContentPart as ToolCallContentPartModel,
)
from phoenix.server.api.helpers.prompts.models import (
    ToolCallContentValue as ToolCallContentValueModel,
)
from phoenix.server.api.helpers.prompts.models import (
    ToolCallFunction as ToolCallFunctionModel,
)
from phoenix.server.api.helpers.prompts.models import (
    ToolResultContentPart as ToolResultContentPartModel,
)
from phoenix.server.api.helpers.prompts.models import (
    ToolResultContentValue as ToolResultContentValueModel,
)


@strawberry.experimental.pydantic.type(TextContentValueModel, all_fields=True)
class TextContentValue:
    pass


@strawberry.experimental.pydantic.type(TextContentPartModel)
class TextContentPart:
    text: TextContentValue


@strawberry.experimental.pydantic.type(ImageContentValueModel, all_fields=True)
class ImageContentValue:
    pass


@strawberry.experimental.pydantic.type(ImageContentPartModel)
class ImageContentPart:
    image: ImageContentValue


@strawberry.experimental.pydantic.type(ToolCallFunctionModel)
class ToolCallFunction:
    name: strawberry.auto
    arguments: strawberry.auto


@strawberry.experimental.pydantic.type(ToolCallContentValueModel)
class ToolCallContentValue:
    tool_call_id: strawberry.auto
    tool_call: ToolCallFunction


@strawberry.experimental.pydantic.type(ToolCallContentPartModel)
class ToolCallContentPart:
    tool_call: ToolCallContentValue


@strawberry.experimental.pydantic.type(ToolResultContentValueModel)
class ToolResultContentValue:
    tool_call_id: strawberry.auto
    result: JSON


@strawberry.experimental.pydantic.type(ToolResultContentPartModel)
class ToolResultContentPart:
    tool_result: ToolResultContentValue


ContentPart: TypeAlias = Annotated[
    Union[TextContentPart, ImageContentPart, ToolCallContentPart, ToolResultContentPart],
    strawberry.union("ContentPart"),
]


@strawberry.experimental.pydantic.type(PromptMessageModel)
class PromptMessage:
    role: strawberry.auto
    content: list[ContentPart]


@strawberry.experimental.pydantic.type(PromptChatTemplateModel)
class PromptChatTemplate:
    messages: list[PromptMessage]


def to_gql_prompt_chat_template_from_orm(orm_model: "ORMPromptVersion") -> "PromptChatTemplate":
    template = PromptChatTemplateModel.model_validate(orm_model.template)
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
    model = PromptStringTemplateModel.model_validate(orm_model.template)
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
