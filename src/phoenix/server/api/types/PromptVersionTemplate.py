# Part of the Phoenix PromptHub feature set

from enum import Enum
from typing import Any, Union

import strawberry
from pydantic import BaseModel
from strawberry.scalars import JSON

JSONSerializable = Union[None, bool, int, float, str, dict[str, Any], list[Any]]


@strawberry.enum
class PromptMessageRole(str, Enum):
    USER = "user"
    SYSTEM = "system"
    AI = "ai"  # E.g. the assistant. Normalize to AI for consistency.


class PromptStringTemplate(BaseModel):
    template: str


class TextPromptMessage(BaseModel):
    role: PromptMessageRole
    content: str

    def to_gql(self):
        return TextPromptMessageGQL.from_model(self)


class JSONPromptMessage(BaseModel):
    role: PromptMessageRole
    content: JSONSerializable

    def to_gql(self):
        return JSONPromptMessageGQL.from_model(self)


class PromptMessagesTemplateV1(BaseModel):
    _version: str = "messages-v1"
    template: list[Union[TextPromptMessage, JSONPromptMessage]]


@strawberry.type
class TextPromptMessageGQL:
    role: PromptMessageRole
    content: str

    @classmethod
    def from_model(cls, model: TextPromptMessage) -> "TextPromptMessageGQL":
        return TextPromptMessageGQL(role=model.role, content=model.content)


@strawberry.type
class JSONPromptMessageGQL:
    role: PromptMessageRole
    content: JSON

    @classmethod
    def from_model(cls, model: JSONPromptMessage) -> "JSONPromptMessageGQL":
        return JSONPromptMessageGQL(role=model.role, content=model.content)


@strawberry.type
class PromptMessagesTemplateV1GQL:
    version: str
    template: list[Union[TextPromptMessageGQL, JSONPromptMessageGQL]]

    @classmethod
    def from_model(cls, model: PromptMessagesTemplateV1) -> "PromptMessagesTemplateV1GQL":
        return PromptMessagesTemplateV1GQL(
            version=model._version,
            messages=[message.to_gql() for message in model.template],
        )


@strawberry.type
class PromptStringTemplateGQL:
    template: str

    @classmethod
    def from_model(cls, model: PromptStringTemplate) -> "PromptStringTemplateGQL":
        return PromptStringTemplateGQL(template=model.template)


PromptTemplateVersion = strawberry.union(
    "PromptTemplateVersion", (PromptStringTemplateGQL, PromptMessagesTemplateV1GQL)
)
