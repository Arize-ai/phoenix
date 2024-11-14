from enum import Enum

import strawberry


@strawberry.enum
class GenerativeProviderKey(Enum):
    OPENAI = "OpenAI"
    ANTHROPIC = "Anthropic"
    AZURE_OPENAI = "Azure OpenAI"
    GEMINI = "Google AI Studio"


@strawberry.type
class GenerativeProvider:
    name: str
    key: GenerativeProviderKey

    @strawberry.field
    async def dependencies(self) -> list[str]:
        from phoenix.server.api.helpers.playground_registry import (
            PLAYGROUND_CLIENT_REGISTRY,
            PROVIDER_DEFAULT,
        )

        default_client = PLAYGROUND_CLIENT_REGISTRY.get_client(self.key, PROVIDER_DEFAULT)
        if default_client:
            return [dependency.name for dependency in default_client.dependencies()]
        return []

    @strawberry.field
    async def dependencies_installed(self) -> bool:
        from phoenix.server.api.helpers.playground_registry import (
            PLAYGROUND_CLIENT_REGISTRY,
            PROVIDER_DEFAULT,
        )

        default_client = PLAYGROUND_CLIENT_REGISTRY.get_client(self.key, PROVIDER_DEFAULT)
        if default_client:
            return default_client.dependencies_are_installed()
        return False
