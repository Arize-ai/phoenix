from enum import Enum

import strawberry


@strawberry.enum
class GenerativeProviderKey(Enum):
    OPENAI = "OpenAI"
    ANTHROPIC = "Anthropic"
    AZURE_OPENAI = "Azure OpenAI"


@strawberry.type
class GenerativeProvider:
    name: str
    key: GenerativeProviderKey
