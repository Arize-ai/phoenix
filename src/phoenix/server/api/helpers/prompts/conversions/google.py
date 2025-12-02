from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional, Union

from typing_extensions import TypedDict, assert_never

if TYPE_CHECKING:
    from phoenix.server.api.helpers.prompts.models import (
        PromptToolChoiceNone,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
        PromptToolChoiceZeroOrMore,
    )


class GoogleFunctionCallingConfig(TypedDict, total=False):
    """
    Matches Google's FunctionCallingConfig format.
    @see https://github.com/googleapis/python-genai/blob/main/google/genai/types.py#L4226
    Note: Google's API is case-insensitive for mode values.
    """

    mode: Optional[str]  # "auto", "any", "none" (case-insensitive)
    allowed_function_names: Optional[list[str]]


# GoogleToolChoice is now the FunctionCallingConfig dict format
GoogleToolChoice = GoogleFunctionCallingConfig


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
        """Convert internal PromptToolChoice to Google's FunctionCallingConfig format."""
        if obj.type == "none":
            return {"mode": "none"}
        if obj.type == "zero_or_more":
            return {"mode": "auto"}
        if obj.type == "one_or_more":
            return {"mode": "any"}
        if obj.type == "specific_function":
            return {"mode": "any", "allowed_function_names": [obj.function_name]}
        assert_never(obj)

    @staticmethod
    def from_google(
        obj: Any,
    ) -> Union[
        PromptToolChoiceNone,
        PromptToolChoiceZeroOrMore,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
    ]:
        """Convert Google's FunctionCallingConfig format to internal PromptToolChoice."""
        from phoenix.server.api.helpers.prompts.models import (
            PromptToolChoiceNone,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
            PromptToolChoiceZeroOrMore,
        )

        if not isinstance(obj, dict):
            raise ValueError(f"Expected dict for Google tool choice, got: {type(obj)}")

        # Normalize mode to lowercase (Google's API is case-insensitive)
        raw_mode = obj.get("mode", "auto")
        mode = raw_mode.lower() if isinstance(raw_mode, str) else "auto"
        allowed_function_names = obj.get("allowed_function_names")

        # If specific function names are provided, use the first one
        if allowed_function_names and len(allowed_function_names) > 0:
            return PromptToolChoiceSpecificFunctionTool(
                type="specific_function",
                function_name=allowed_function_names[0],
            )

        # Otherwise, map mode to internal format
        if mode == "none":
            return PromptToolChoiceNone(type="none")
        if mode == "auto":
            return PromptToolChoiceZeroOrMore(type="zero_or_more")
        if mode == "any":
            return PromptToolChoiceOneOrMore(type="one_or_more")

        raise ValueError(f"Unsupported Google tool choice mode: {mode}")
