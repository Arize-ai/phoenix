from enum import Enum

import strawberry


@strawberry.enum(
    description=(
        "The client a custom provider's decision models run through: OpenAI's Decisions API "
        "or System One."
    )
)
class DecisionSDK(Enum):
    OPENAI = "openai"
    TYPESAFE = "typesafe"
