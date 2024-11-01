import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.input_types.ChatCompletionInput import ChatCompletionInput


@strawberry.type
class ChatCompletionMutationMixin:
    @strawberry.mutation
    async def generate_chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> str:
        return "test"
