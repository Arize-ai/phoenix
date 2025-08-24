from __future__ import annotations

from typing import Union

from typing_extensions import assert_never

# Lightweight conversion helpers to map Phoenix PromptToolChoice <-> Google ToolConfig
# We intentionally avoid importing server models at import time to prevent cycles.


class GoogleToolChoiceConversion:
    @staticmethod
    def to_google(
        obj: Union[
            "PromptToolChoiceNone",
            "PromptToolChoiceZeroOrMore",
            "PromptToolChoiceOneOrMore",
            "PromptToolChoiceSpecificFunctionTool",
        ],
    ):
        # Returns an instance of google.generativeai.protos.ToolConfig
        from google.generativeai import protos
        from google.generativeai.types import content_types

        tool_config: protos.ToolConfig = protos.ToolConfig()  # type: ignore[no-untyped-call]
        fcc = tool_config.function_calling_config
        if obj.type == "none":
            fcc.mode = content_types.FunctionCallingMode.NONE
            return tool_config
        if obj.type == "zero_or_more":
            fcc.mode = content_types.FunctionCallingMode.AUTO
            return tool_config
        if obj.type == "one_or_more":
            fcc.mode = content_types.FunctionCallingMode.ANY
            return tool_config
        if obj.type == "specific_function":
            fcc.mode = content_types.FunctionCallingMode.ANY
            fcc.allowed_function_names = [obj.function_name]
            return tool_config
        assert_never(obj)

    @staticmethod
    def from_google(tool_config):
        # Accepts either a dict-like or google.generativeai.protos.ToolConfig
        # Returns a Phoenix PromptToolChoice variant
        from google.generativeai.types import content_types
        from phoenix.server.api.helpers.prompts.models import (
            PromptToolChoiceNone,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
            PromptToolChoiceZeroOrMore,
        )

        # If "tool_config" comes as a plain dict from GraphQL/UI, map fields
        try:
            fcc = tool_config["function_calling_config"]
            mode = fcc.get("mode")
            allowed = fcc.get("allowed_function_names") or []
        except Exception:
            # Otherwise assume a ToolConfig proto
            fcc = tool_config.function_calling_config
            mode = fcc.mode
            allowed = list(getattr(fcc, "allowed_function_names", []) or [])

        if mode in ("NONE", content_types.FunctionCallingMode.NONE):
            return PromptToolChoiceNone(type="none"), None
        if mode in ("AUTO", content_types.FunctionCallingMode.AUTO):
            return PromptToolChoiceZeroOrMore(type="zero_or_more"), None
        if mode in ("ANY", content_types.FunctionCallingMode.ANY):
            if allowed:
                return (
                    PromptToolChoiceSpecificFunctionTool(type="specific_function", function_name=allowed[0]),
                    None,
                )
            else:
                return PromptToolChoiceOneOrMore(type="one_or_more"), None
        raise ValueError("Unsupported Google ToolConfig mode: {mode}")
