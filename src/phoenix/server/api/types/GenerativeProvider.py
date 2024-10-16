from enum import Enum

import strawberry


@strawberry.enum
class GenerativeProviderKey(Enum):
    OPENAI = "OPENAI"
    ANTHROPIC = "ANTHROPIC"
    AZURE_OPENAI = "AZURE_OPENAI"


@strawberry.type
class GenerativeProvider:
    name: str
    key: GenerativeProviderKey
