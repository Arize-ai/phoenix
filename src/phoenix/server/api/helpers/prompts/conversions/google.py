from __future__ import annotations

from typing import TYPE_CHECKING, Union

from typing_extensions import assert_never

if TYPE_CHECKING:
    from phoenix.server.api.helpers.prompts.models import (
        PromptToolChoiceNone,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
        PromptToolChoiceZeroOrMore,
    )


GoogleToolChoice = Union[str, dict[str, str]]


class GoogleToolChoiceConversion:
    @staticmethod
    def to_google(
        obj: Union[
            PromptToolChoiceNone,
            PromptToolChoiceZeroOrMore,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
        ],
    ) -> GoogleToolChoice:
        if obj.type == "none":
            return "none"
        if obj.type == "zero_or_more":
            return "auto"
        if obj.type == "one_or_more":
            return "any"
        if obj.type == "specific_function":
            return {"name": obj.function_name}
        assert_never(obj)

    @staticmethod
    def from_google(
        obj: GoogleToolChoice,
    ) -> Union[
        PromptToolChoiceNone,
        PromptToolChoiceZeroOrMore,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
    ]:
        from phoenix.server.api.helpers.prompts.models import (
            PromptToolChoiceNone,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
            PromptToolChoiceZeroOrMore,
        )

        if obj == "none":
            return PromptToolChoiceNone(type="none")
        if obj == "auto":
            return PromptToolChoiceZeroOrMore(type="zero_or_more")
        if obj == "any":
            return PromptToolChoiceOneOrMore(type="one_or_more")
        # Object with name field for specific function
        if isinstance(obj, dict) and "name" in obj:
            return PromptToolChoiceSpecificFunctionTool(
                type="specific_function",
                function_name=obj["name"],
            )
        raise ValueError(f"Unsupported Google tool choice: {obj}")
