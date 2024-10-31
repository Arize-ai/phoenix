import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.subscriptions import ChatCompletionInput


@strawberry.type
class ChatCompletionMutationMixin:
    @strawberry.mutation
    async def generate_chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> str:
        print(info, input)
        return "test"
