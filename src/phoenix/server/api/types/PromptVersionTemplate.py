# Part of the Phoenix PromptHub feature set
import json
from typing import Annotated, Union

import strawberry
from strawberry.scalars import JSON
from typing_extensions import TypeAlias, assert_never

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.db.types.media import MediaContent as MediaContentModel
from phoenix.db.types.prompts import (
    PromptChatTemplate as PromptChatTemplateModel,
)
from phoenix.db.types.prompts import PromptMessage as PromptMessageModel
from phoenix.db.types.prompts import (
    PromptMessageRole,
    PromptTemplateType,
    RoleConversion,
    media_source,
)
from phoenix.db.types.prompts import (
    PromptStringTemplate as PromptStringTemplateModel,
)


@strawberry.type
class TextContentValue:
    text: str


@strawberry.type
class TextContentPart:
    text: TextContentValue


@strawberry.type
class ToolCallFunction:
    name: str
    arguments: str


@strawberry.type
class ToolCallContentValue:
    tool_call_id: str
    tool_call: ToolCallFunction


@strawberry.type
class ToolCallContentPart:
    tool_call: ToolCallContentValue


@strawberry.type
class ToolResultContentValue:
    tool_call_id: str
    result: JSON


@strawberry.type
class ToolResultContentPart:
    tool_result: ToolResultContentValue


@strawberry.type
class ImageContentValue:
    """Media stored in Phoenix, or carried inline in the prompt."""

    url: str = strawberry.field(
        description=(
            "A `phoenix://media/<sha256>` reference to media stored in Phoenix, or a "
            "base64 `data:` URL carrying the media inline."
        )
    )
    media_type: str


@strawberry.type
class ImageVariableValue:
    """Media supplied when the prompt runs, named by a template variable."""

    variable: str = strawberry.field(
        description="The input name the image is supplied under at run time."
    )


ImageSource: TypeAlias = Annotated[
    Union[ImageContentValue, ImageVariableValue],
    strawberry.union("ImageSource"),
]


@strawberry.type
class ImageContentPart:
    image: ImageSource


@strawberry.type
class FileContentPart:
    file: ImageSource = strawberry.field(
        description=(
            "Where the document comes from. Shares `ImageSource` because a stored "
            "reference and a run-time variable look the same for either kind."
        )
    )


ContentPart: TypeAlias = Annotated[
    Union[
        TextContentPart,
        ToolCallContentPart,
        ToolResultContentPart,
        ImageContentPart,
        FileContentPart,
    ],
    strawberry.union("ContentPart"),
]


@strawberry.type
class PromptMessage:
    role: PromptMessageRole
    content: list[ContentPart]


@strawberry.experimental.pydantic.type(PromptChatTemplateModel)
class PromptChatTemplate:
    messages: list[PromptMessage]


def to_gql_prompt_chat_template_from_orm(orm_model: "ORMPromptVersion") -> "PromptChatTemplate":
    template = PromptChatTemplateModel.model_validate(orm_model.template)
    messages: list[PromptMessage] = []
    for msg in template.messages:
        role = RoleConversion.to_gql(msg.role)
        if isinstance(msg, PromptMessageModel):
            if isinstance(msg.content, str):
                messages.append(
                    PromptMessage(
                        role=role,
                        content=[TextContentPart(text=TextContentValue(text=msg.content))],
                    )
                )
                continue
            content: list[ContentPart] = []
            for part in msg.content:
                if part.type == "text":
                    content.append(TextContentPart(text=TextContentValue(text=part.text)))
                elif part.type == "tool_call":
                    content.append(
                        ToolCallContentPart(
                            tool_call=ToolCallContentValue(
                                tool_call_id=part.tool_call_id,
                                tool_call=ToolCallFunction(
                                    name=part.tool_call.name,
                                    arguments=part.tool_call.arguments,
                                ),
                            )
                        )
                    )
                elif part.type == "tool_result":
                    content.append(
                        ToolResultContentPart(
                            tool_result=ToolResultContentValue(
                                tool_call_id=part.tool_call_id,
                                result=JSON(json.dumps(part.tool_result)),
                            )
                        )
                    )
                elif part.type == "image" or part.type == "file":
                    source = media_source(part)
                    value: ImageSource = (
                        ImageContentValue(
                            url=source.url,
                            media_type=source.media_type,
                        )
                        if isinstance(source, MediaContentModel)
                        else ImageVariableValue(variable=source.variable)
                    )
                    content.append(
                        ImageContentPart(image=value)
                        if part.type == "image"
                        else FileContentPart(file=value)
                    )
                else:
                    assert_never(part)
            messages.append(PromptMessage(role=role, content=content))
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
