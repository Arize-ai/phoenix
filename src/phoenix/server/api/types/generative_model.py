import strawberry

from .generative_provider import GenerativeProviderKey


@strawberry.type
class GenerativeModel:
    name: str
    provider_key: GenerativeProviderKey
