import strawberry

from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@strawberry.type
class GenerativeModel:
    name: str
    provider_key: GenerativeProviderKey
