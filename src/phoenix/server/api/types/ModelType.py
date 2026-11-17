"""Invocation categories exposed by the playground model catalog."""

from enum import Enum

import strawberry
from typing_extensions import assert_never

from phoenix.db.types.model_provider import ModelTypeKey


@strawberry.enum(description="The kind of model a playground instance runs.")
class ModelType(Enum):
    CHAT = strawberry.enum_value(
        "CHAT", description="Chat models that generate text from messages."
    )
    DECISION = strawberry.enum_value(
        "DECISION",
        description=(
            "Decision models that answer typed questions (predicate, choice, scale) about a state "
            "and return probabilities rather than text."
        ),
    )

    def to_model_type_key(self) -> ModelTypeKey:
        if self is ModelType.CHAT:
            return "CHAT"
        if self is ModelType.DECISION:
            return "DECISION"
        assert_never(self)
