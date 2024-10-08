import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole


@strawberry.input
class ChatCompletionMessageInput:
    role: ChatCompletionMessageRole
    content: JSON = strawberry.field(
        description="The content of the message as JSON to support text and tools",
    )
