from enum import Enum

import strawberry


@strawberry.enum
class PromptFilterColumn(Enum):
    name = "name"


@strawberry.input(description="The filter key and value for prompt connections")
class PromptFilter:
    col: PromptFilterColumn
    value: str
