from enum import Enum

import strawberry


class TokenKind(Enum):
    PROMPT = "prompt"
    COMPLETION = "completion"


@strawberry.type
class TokenPrice:
    token_type: str
    kind: TokenKind
    cost_per_million_tokens: float
    cost_per_token: float
