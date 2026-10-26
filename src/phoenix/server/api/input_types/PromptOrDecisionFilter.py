from enum import Enum

import strawberry


@strawberry.enum
class PromptOrDecisionFilterColumn(Enum):
    name = "name"


@strawberry.input(
    description="The filter key and value for combined prompt and decision connections"
)
class PromptOrDecisionFilter:
    col: PromptOrDecisionFilterColumn
    value: str
