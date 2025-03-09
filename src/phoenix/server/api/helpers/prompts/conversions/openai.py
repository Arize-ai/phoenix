from __future__ import annotations

from typing import TYPE_CHECKING, Union

from typing_extensions import assert_never

if TYPE_CHECKING:
    from openai.types.chat import (
        ChatCompletionNamedToolChoiceParam,
        ChatCompletionToolChoiceOptionParam,
    )
    from openai.types.chat.chat_completion_named_tool_choice_param import Function

    from phoenix.server.api.helpers.prompts.models import (
        PromptToolChoiceNone,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
        PromptToolChoiceZeroOrMore,
    )


class OpenAIToolChoiceConversion:
    @staticmethod
    def to_openai(
        obj: Union[
            PromptToolChoiceNone,
            PromptToolChoiceZeroOrMore,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
        ],
    ) -> ChatCompletionToolChoiceOptionParam:
        if obj.type == "none":
            return "none"
        if obj.type == "zero_or_more":
            return "auto"
        if obj.type == "one_or_more":
            return "required"
        if obj.type == "specific_function":
            choice_tool: ChatCompletionNamedToolChoiceParam = {
                "type": "function",
                "function": {"name": obj.function_name},
            }
            return choice_tool
        assert_never(obj)

    @staticmethod
    def from_openai(
        obj: ChatCompletionToolChoiceOptionParam,
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
            choice_none = PromptToolChoiceNone(type="none")
            return choice_none
        if obj == "auto":
            choice_zero_or_more = PromptToolChoiceZeroOrMore(type="zero_or_more")
            return choice_zero_or_more
        if obj == "required":
            choice_one_or_more = PromptToolChoiceOneOrMore(type="one_or_more")
            return choice_one_or_more
        if obj["type"] == "function":
            function: Function = obj["function"]
            choice_function_tool = PromptToolChoiceSpecificFunctionTool(
                type="specific_function",
                function_name=function["name"],
            )
            return choice_function_tool
        assert_never(obj["type"])
