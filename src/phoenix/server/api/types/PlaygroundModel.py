import strawberry

from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.ModelInterface import ModelInterface


@strawberry.type
class PlaygroundModel(ModelInterface):
    name: str
    provider_key: GenerativeProviderKey  # PlaygroundModel always has a provider_key
