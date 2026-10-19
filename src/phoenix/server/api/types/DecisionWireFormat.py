"""Request body shapes spoken by decision model APIs."""

from enum import Enum

import strawberry


@strawberry.enum(
    description=(
        "The request body shape a provider's decision API accepts. SYSTEM_ONE is the "
        "TypeSafe System One body (`state` and named `questions`); OPENAI_DECISIONS is the "
        "OpenAI Decisions API body (`input` and a `questions` array)."
    )
)
class DecisionWireFormat(Enum):
    SYSTEM_ONE = "SYSTEM_ONE"
    OPENAI_DECISIONS = "OPENAI_DECISIONS"
