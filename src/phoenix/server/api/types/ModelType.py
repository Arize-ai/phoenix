"""Invocation categories exposed by the playground model catalog."""

from enum import Enum

import strawberry


@strawberry.enum
class ModelType(Enum):
    LLM = "LLM"
    DECISION = "DECISION"
