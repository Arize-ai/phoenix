import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.ModelInterface import ModelInterface
from phoenix.server.api.types.ModelType import ModelType


@strawberry.type
class PlaygroundModel(ModelInterface):
    name_value: strawberry.Private[str]
    provider_key_value: strawberry.Private[GenerativeProviderKey]
    model_type: ModelType = ModelType.LLM

    @strawberry.field
    async def name(self, info: Info[Context, None]) -> str:
        return self.name_value

    @strawberry.field
    async def provider_key(self, info: Info[Context, None]) -> GenerativeProviderKey:
        return self.provider_key_value
