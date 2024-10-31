from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from .Span import Span


@strawberry.interface
class ChatCompletionSubscriptionPayload:
    dataset_example_id: Optional[GlobalID] = None


@strawberry.type
class TextChunk(ChatCompletionSubscriptionPayload):
    content: str


@strawberry.type
class FunctionCallChunk(ChatCompletionSubscriptionPayload):
    name: str
    arguments: str


@strawberry.type
class ToolCallChunk(ChatCompletionSubscriptionPayload):
    id: str
    function: FunctionCallChunk


@strawberry.type
class FinishedChatCompletion(ChatCompletionSubscriptionPayload):
    span: Span
    error_message: Optional[str] = None
