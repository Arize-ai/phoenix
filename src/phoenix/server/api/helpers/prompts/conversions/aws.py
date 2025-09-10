from __future__ import annotations

from typing import TYPE_CHECKING, Optional, Union

from typing_extensions import assert_never

if TYPE_CHECKING:
    from anthropic.types import (
        ToolChoiceAnyParam,
        ToolChoiceAutoParam,
        ToolChoiceParam,
        ToolChoiceToolParam,
    )

    from phoenix.server.api.helpers.prompts.models import (
        PromptToolChoiceNone,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
        PromptToolChoiceZeroOrMore,
    )


class AwsToolChoiceConversion:
    @staticmethod
    def to_aws(
        obj: Union[
            PromptToolChoiceNone,
            PromptToolChoiceZeroOrMore,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
        ],
        disable_parallel_tool_use: Optional[bool] = None,
    ) -> ToolChoiceParam:
        if obj.type == "zero_or_more":
            choice_auto: ToolChoiceAutoParam = {"type": "auto"}
            if disable_parallel_tool_use is not None:
                choice_auto["disable_parallel_tool_use"] = disable_parallel_tool_use
            return choice_auto
        if obj.type == "one_or_more":
            choice_any: ToolChoiceAnyParam = {"type": "any"}
            if disable_parallel_tool_use is not None:
                choice_any["disable_parallel_tool_use"] = disable_parallel_tool_use
            return choice_any
        if obj.type == "specific_function":
            choice_tool: ToolChoiceToolParam = {"type": "tool", "name": obj.function_name}
            if disable_parallel_tool_use is not None:
                choice_tool["disable_parallel_tool_use"] = disable_parallel_tool_use
            return choice_tool
        if obj.type == "none":
            return {"type": "none"}
        assert_never(obj.type)

    @staticmethod
    def from_aws(
        obj: ToolChoiceParam,
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

        if obj["type"] == "auto":
            choice_zero_or_more = PromptToolChoiceZeroOrMore(type="zero_or_more")
            return choice_zero_or_more
        if obj["type"] == "any":
            choice_one_or_more = PromptToolChoiceOneOrMore(type="one_or_more")
            return choice_one_or_more
        if obj["type"] == "tool":
            choice_function_tool = PromptToolChoiceSpecificFunctionTool(
                type="specific_function",
                function_name=obj["name"],
            )
            return choice_function_tool
        if obj["type"] == "none":
            return PromptToolChoiceNone(type="none")
        assert_never(obj)
