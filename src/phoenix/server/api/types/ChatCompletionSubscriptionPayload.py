from typing import Optional, Union

import strawberry
from typing_extensions import Annotated, TypeAlias

from .Span import Span


@strawberry.type
class TextChunk:
    content: str


@strawberry.type
class FunctionCallChunk:
    name: str
    arguments: str


@strawberry.type
class ToolCallChunk:
    id: str
    function: FunctionCallChunk


@strawberry.type
class FinishedChatCompletion:
    span: Span
    error_message: Optional[str] = None


ChatCompletionSubscriptionPayload: TypeAlias = Annotated[
    Union[TextChunk, ToolCallChunk, FinishedChatCompletion],
    strawberry.union("ChatCompletionSubscriptionPayload"),
]
