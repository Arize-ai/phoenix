"""Invocation categories exposed by the playground model catalog."""

from enum import Enum

import strawberry


@strawberry.enum(description="The kind of model a playground instance runs.")
class ModelType(Enum):
    LLM = strawberry.enum_value(
        "LLM", description="Chat completion models that generate text from messages."
    )
    DECISION = strawberry.enum_value(
        "DECISION",
        description=(
            "Decision models that answer typed questions (choice, noul, score) about a state "
            "and return probabilities rather than text."
        ),
    )
