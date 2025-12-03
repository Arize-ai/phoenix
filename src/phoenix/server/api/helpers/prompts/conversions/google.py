from typing import TYPE_CHECKING, Any, Literal, Union

from google.genai.types import ToolConfig
from typing_extensions import NotRequired, TypedDict, assert_never

if TYPE_CHECKING:
    from phoenix.server.api.helpers.prompts.models import (
        PromptToolChoiceNone,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
        PromptToolChoiceZeroOrMore,
    )


class GoogleToolChoice(TypedDict, total=False):
    """
    Based on https://github.com/googleapis/python-genai/blob/97cc7e4eafbee4fa4035e7420170ab6a2c9da7fb/google/genai/types.py#L4245
    """

    mode: NotRequired[Literal["auto", "any", "none"]]
    allowed_function_names: NotRequired[list[str]]


class GoogleToolChoiceConversion:
    @staticmethod
    def to_google(
        obj: Union[
            "PromptToolChoiceNone",
            "PromptToolChoiceZeroOrMore",
            "PromptToolChoiceOneOrMore",
            "PromptToolChoiceSpecificFunctionTool",
        ],
    ) -> GoogleToolChoice:
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
        "PromptToolChoiceNone",
        "PromptToolChoiceZeroOrMore",
        "PromptToolChoiceOneOrMore",
        "PromptToolChoiceSpecificFunctionTool",
    ]:
        from phoenix.server.api.helpers.prompts.models import (
            PromptToolChoiceNone,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
            PromptToolChoiceZeroOrMore,
        )

        tool_config = ToolConfig.model_validate(obj)
        if (function_calling_config := tool_config.function_calling_config) is None:
            raise ValueError("function_calling_config is required")
        # normalize mode to lowercase since Google's API is case-insensitive
        # https://github.com/googleapis/python-genai/blob/97cc7e4eafbee4fa4035e7420170ab6a2c9da7fb/google/genai/types.py#L645
        normalized_mode = (
            function_calling_config.mode.value.lower()
            if function_calling_config.mode is not None
            else None
        )
        allowed_function_names = function_calling_config.allowed_function_names

        if allowed_function_names:
            if len(allowed_function_names) != 1:
                raise ValueError("Only one allowed function name is currently supported")
            if normalized_mode != "any":
                raise ValueError("allowed function names only supported in 'any' mode")
            return PromptToolChoiceSpecificFunctionTool(
                type="specific_function",
                function_name=allowed_function_names[0],
            )

        if normalized_mode == "none":
            return PromptToolChoiceNone(type="none")
        if normalized_mode == "auto" or normalized_mode is None:
            return PromptToolChoiceZeroOrMore(type="zero_or_more")
        if normalized_mode == "any":
            return PromptToolChoiceOneOrMore(type="one_or_more")

        raise ValueError(f"Unsupported Google tool choice mode: {normalized_mode}")
