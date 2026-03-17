from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

import strawberry
from typing_extensions import assert_never

if TYPE_CHECKING:
    from phoenix.db.types import prompts as orm


@strawberry.enum
class PromptToolChoiceType(str, Enum):
    NONE = "none"
    ZERO_OR_MORE = "zero_or_more"
    ONE_OR_MORE = "one_or_more"
    SPECIFIC_FUNCTION = "specific_function"


@strawberry.type
class PromptToolChoice:
    type: PromptToolChoiceType
    function_name: str | None = None

    @classmethod
    def from_orm(cls, tc: orm.PromptToolChoice) -> PromptToolChoice:
        if tc.type == "none":
            return cls(type=PromptToolChoiceType.NONE)
        if tc.type == "zero_or_more":
            return cls(type=PromptToolChoiceType.ZERO_OR_MORE)
        if tc.type == "one_or_more":
            return cls(type=PromptToolChoiceType.ONE_OR_MORE)
        if tc.type == "specific_function":
            return cls(
                type=PromptToolChoiceType.SPECIFIC_FUNCTION,
                function_name=tc.function_name,
            )
        assert_never(tc.type)
