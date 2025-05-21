from __future__ import annotations

import importlib.metadata
import json
import logging
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
    Iterator,
    Literal,
    Mapping,
    Optional,
    Sequence,
    TypedDict,
    Union,
    cast,
    overload,
)

from typing_extensions import Required, TypeAlias, assert_never

from phoenix.client.__generated__ import v1
from phoenix.client.utils.template_formatters import TemplateFormatter, to_formatter

try:
    _anthropic_version = cast(
        tuple[int, int], tuple(map(int, importlib.metadata.version("anthropic").split(".")[:2]))
    )
except importlib.metadata.PackageNotFoundError:
    _anthropic_version = (0, 0)

if TYPE_CHECKING:
    from anthropic._client import Anthropic
    from anthropic.types import (
        ContentBlock,
        DocumentBlockParam,
        ImageBlockParam,
        MessageParam,
        ModelParam,
        RedactedThinkingBlockParam,
        TextBlock,
        TextBlockParam,
        ThinkingBlockParam,
        ThinkingConfigDisabledParam,
        ThinkingConfigEnabledParam,
        ToolChoiceAnyParam,
        ToolChoiceAutoParam,
        ToolChoiceParam,
        ToolChoiceToolParam,
        ToolParam,
        ToolResultBlockParam,
        ToolUnionParam,
        ToolUseBlock,
        ToolUseBlockParam,
    )
    from anthropic.types.message_create_params import MessageCreateParamsBase

    _BlockParam: TypeAlias = Union[
        TextBlockParam,
        ImageBlockParam,
        ToolUseBlockParam,
        ToolResultBlockParam,
        ThinkingBlockParam,
        RedactedThinkingBlockParam,
        DocumentBlockParam,
    ]
    _ContentPart: TypeAlias = Union[
        v1.TextContentPart,
        v1.ToolCallContentPart,
        v1.ToolResultContentPart,
    ]

    def _(obj: v1.PromptVersionData) -> None:
        messages, kwargs = to_chat_messages_and_kwargs(obj)
        Anthropic().messages.create(messages=messages, **kwargs)


class _ToolKwargs(TypedDict, total=False):
    tools: list[ToolParam]
    tool_choice: ToolChoiceParam


class _InvocationParameters(TypedDict, total=False):
    max_tokens: Required[int]
    stop_sequences: list[str]
    temperature: float
    top_p: float
    thinking: Union[ThinkingConfigEnabledParam, ThinkingConfigDisabledParam]


class AnthropicMessageModelKwargs(
    _InvocationParameters,
    _ToolKwargs,
    TypedDict,
    total=False,
):
    model: Required[ModelParam]
    system: Union[str, list[TextBlockParam]]


logger = logging.getLogger(__name__)


__all__ = [
    "create_prompt_version_from_anthropic",
    "to_chat_messages_and_kwargs",
]


def create_prompt_version_from_anthropic(
    obj: MessageCreateParamsBase,
    /,
    *,
    description: Optional[str] = None,
    template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
    model_provider: Literal["ANTHROPIC"] = "ANTHROPIC",
) -> v1.PromptVersionData:
    invocation_parameters = _InvocationParametersConversion.from_anthropic(
        obj,
        model_provider=model_provider,
    )
    messages: list[v1.PromptMessage] = []
    if "system" in obj:
        system = (
            obj["system"]
            if isinstance(obj["system"], str)
            else list(map(_TextContentPartConversion.from_anthropic, obj["system"]))
        )
        messages.append(v1.PromptMessage(role="system", content=system))
    messages.extend(map(_MessageConversion.from_anthropic, obj["messages"]))
    template: v1.PromptChatTemplate = {
        "type": "chat",
        "messages": messages,
    }
    ans = v1.PromptVersionData(
        model_provider=model_provider,
        model_name=obj["model"],
        template=template,
        template_type="CHAT",
        template_format=template_format,
        invocation_parameters=invocation_parameters,
    )
    tool_kwargs: _ToolKwargs = {}
    if "tools" in obj:
        tool_kwargs["tools"] = list(_get_tool_params(obj["tools"]))
    if "tool_choice" in obj:
        tool_kwargs["tool_choice"] = obj["tool_choice"]
    if (tools := _ToolKwargsConversion.from_anthropic(tool_kwargs)) is not None:
        ans["tools"] = tools
    if description:
        ans["description"] = description
    return ans


def to_chat_messages_and_kwargs(
    obj: v1.PromptVersionData,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
) -> tuple[list[MessageParam], AnthropicMessageModelKwargs]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    system_messages: list[str] = []
    messages: list[MessageParam] = []
    if template["type"] == "chat":
        for message in template["messages"]:
            if message["role"] == "system":
                if isinstance(message["content"], str):
                    system_messages.append(message["content"])
                    continue
                for block in _ContentConversion.to_anthropic(
                    message["content"], variables, formatter
                ):
                    if block["type"] == "text":
                        system_messages.append(block["text"])
            else:
                messages.extend(_MessageConversion.to_anthropic(message, variables, formatter))
    elif template["type"] == "string":
        raise NotImplementedError
    else:
        assert_never(template)
    kwargs: AnthropicMessageModelKwargs = _ModelKwargsConversion.to_anthropic(obj)
    if system_messages:
        if len(system_messages) == 1:
            kwargs["system"] = system_messages[0]
        else:
            kwargs["system"] = [{"type": "text", "text": text} for text in system_messages]
    return messages, kwargs


_DEFAULT_MAX_TOKENS = 100


class _ModelKwargsConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.PromptVersionData,
    ) -> AnthropicMessageModelKwargs:
        parameters: _InvocationParameters = (
            _InvocationParametersConversion.to_anthropic(obj["invocation_parameters"])
            if "invocation_parameters" in obj
            else _InvocationParameters(max_tokens=_DEFAULT_MAX_TOKENS)
        )
        ans: AnthropicMessageModelKwargs = {
            "model": obj["model_name"],
            **parameters,  # type: ignore[typeddict-item]
        }
        if "tools" in obj:
            tool_kwargs = _ToolKwargsConversion.to_anthropic(obj["tools"])
            if "tools" in tool_kwargs:
                ans["tools"] = tool_kwargs["tools"]
                if "tool_choice" in tool_kwargs:
                    ans["tool_choice"] = tool_kwargs["tool_choice"]
        return ans


class _InvocationParametersConversion:
    @staticmethod
    def to_anthropic(
        obj: Union[
            v1.PromptOpenAIInvocationParameters,
            v1.PromptAzureOpenAIInvocationParameters,
            v1.PromptAnthropicInvocationParameters,
            v1.PromptGoogleInvocationParameters,
        ],
    ) -> _InvocationParameters:
        ans: _InvocationParameters = _InvocationParameters(
            max_tokens=_DEFAULT_MAX_TOKENS,
        )
        if obj["type"] == "anthropic":
            anthropic_params: v1.PromptAnthropicInvocationParametersContent
            anthropic_params = obj["anthropic"]
            if "max_tokens" in anthropic_params:
                ans["max_tokens"] = anthropic_params["max_tokens"]
            if "temperature" in anthropic_params:
                ans["temperature"] = anthropic_params["temperature"]
            if "top_p" in anthropic_params:
                ans["top_p"] = anthropic_params["top_p"]
            if "stop_sequences" in anthropic_params:
                ans["stop_sequences"] = list(anthropic_params["stop_sequences"])
            if "thinking" in anthropic_params:
                thinking = anthropic_params["thinking"]
                if thinking["type"] == "disabled":
                    ans["thinking"] = {
                        "type": "disabled",
                    }
                elif thinking["type"] == "enabled":
                    ans["thinking"] = {
                        "type": "enabled",
                        "budget_tokens": thinking["budget_tokens"],
                    }
                elif TYPE_CHECKING:
                    assert_never(thinking["type"])
        elif obj["type"] == "openai":
            openai_params: v1.PromptOpenAIInvocationParametersContent
            openai_params = obj["openai"]
            if "max_tokens" in openai_params:
                ans["max_tokens"] = openai_params["max_tokens"]
            if "temperature" in openai_params:
                ans["temperature"] = openai_params["temperature"]
            if "top_p" in openai_params:
                ans["top_p"] = openai_params["top_p"]
        elif obj["type"] == "azure_openai":
            azure_params: v1.PromptAzureOpenAIInvocationParametersContent
            azure_params = obj["azure_openai"]
            if "max_tokens" in azure_params:
                ans["max_tokens"] = azure_params["max_tokens"]
            if "temperature" in azure_params:
                ans["temperature"] = azure_params["temperature"]
            if "top_p" in azure_params:
                ans["top_p"] = azure_params["top_p"]
        elif obj["type"] == "google":
            google_params: v1.PromptGoogleInvocationParametersContent
            google_params = obj["google"]
            if "max_output_tokens" in google_params:
                ans["max_tokens"] = google_params["max_output_tokens"]
            if "temperature" in google_params:
                ans["temperature"] = google_params["temperature"]
            if "top_p" in google_params:
                ans["top_p"] = google_params["top_p"]
        elif TYPE_CHECKING:
            assert_never(obj["type"])
        return ans

    @staticmethod
    def from_anthropic(
        obj: MessageCreateParamsBase,
        /,
        *,
        model_provider: Literal["ANTHROPIC"] = "ANTHROPIC",
    ) -> v1.PromptAnthropicInvocationParameters:
        content = v1.PromptAnthropicInvocationParametersContent(
            max_tokens=obj["max_tokens"],
        )
        if "temperature" in obj:
            content["temperature"] = obj["temperature"]
        if "top_p" in obj:
            content["top_p"] = obj["top_p"]
        if "stop_sequences" in obj:
            content["stop_sequences"] = list(obj["stop_sequences"])
        if "thinking" in obj:
            thinking = obj["thinking"]
            if thinking["type"] == "disabled":
                content["thinking"] = {
                    "type": "disabled",
                }
            elif thinking["type"] == "enabled":
                content["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": thinking["budget_tokens"],
                }
            elif TYPE_CHECKING:
                assert_never(thinking["type"])
        return v1.PromptAnthropicInvocationParameters(
            type="anthropic",
            anthropic=content,
        )


class _ToolKwargsConversion:
    @staticmethod
    def to_anthropic(
        obj: Optional[v1.PromptTools],
    ) -> _ToolKwargs:
        ans: _ToolKwargs = {}
        if not obj:
            return ans
        tools: list[ToolParam] = list(_ToolConversion.to_anthropic(obj["tools"]))
        ans["tools"] = tools
        if "tool_choice" in obj:
            if obj["tool_choice"]["type"] == "none":
                return {}
            disable_parallel_tool_use: Optional[bool] = (
                obj["disable_parallel_tool_calls"] if "disable_parallel_tool_calls" in obj else None
            )
            tool_choice: ToolChoiceParam = _ToolChoiceConversion.to_anthropic(
                obj["tool_choice"],
                disable_parallel_tool_use,
            )
            ans["tool_choice"] = tool_choice
        return ans

    @staticmethod
    def from_anthropic(
        obj: _ToolKwargs,
    ) -> Optional[v1.PromptTools]:
        if not obj or "tools" not in obj:
            return None
        tools: list[v1.PromptToolFunction] = list(_ToolConversion.from_anthropic(obj["tools"]))
        if not tools:
            return None
        ans = v1.PromptTools(
            type="tools",
            tools=tools,
        )
        if "tool_choice" in obj:
            tc: ToolChoiceParam = obj["tool_choice"]
            tool_choice, disable_parallel_tool_use = _ToolChoiceConversion.from_anthropic(tc)
            ans["tool_choice"] = tool_choice
            if disable_parallel_tool_use is not None:
                ans["disable_parallel_tool_calls"] = disable_parallel_tool_use
        return ans


class _ToolChoiceConversion:
    @staticmethod
    def to_anthropic(
        obj: Union[
            v1.PromptToolChoiceNone,
            v1.PromptToolChoiceZeroOrMore,
            v1.PromptToolChoiceOneOrMore,
            v1.PromptToolChoiceSpecificFunctionTool,
        ],
        disable_parallel_tool_use: Optional[bool] = None,
    ) -> ToolChoiceParam:
        if obj["type"] == "none":
            return {"type": "none"}
        if obj["type"] == "zero_or_more":
            choice_auto: ToolChoiceAutoParam = {"type": "auto"}
            if disable_parallel_tool_use is not None:
                choice_auto["disable_parallel_tool_use"] = disable_parallel_tool_use
            return choice_auto
        if obj["type"] == "one_or_more":
            choice_any: ToolChoiceAnyParam = {"type": "any"}
            if disable_parallel_tool_use is not None:
                choice_any["disable_parallel_tool_use"] = disable_parallel_tool_use
            return choice_any
        if obj["type"] == "specific_function":
            choice_tool: ToolChoiceToolParam = {"type": "tool", "name": obj["function_name"]}
            if disable_parallel_tool_use is not None:
                choice_tool["disable_parallel_tool_use"] = disable_parallel_tool_use
            return choice_tool
        assert_never(obj["type"])

    @staticmethod
    def from_anthropic(
        obj: ToolChoiceParam,
    ) -> tuple[
        Union[
            v1.PromptToolChoiceNone,
            v1.PromptToolChoiceZeroOrMore,
            v1.PromptToolChoiceOneOrMore,
            v1.PromptToolChoiceSpecificFunctionTool,
        ],
        Optional[bool],
    ]:
        if obj["type"] == "auto":
            disable_parallel_tool_use = (
                obj["disable_parallel_tool_use"] if "disable_parallel_tool_use" in obj else None
            )
            choice_zero_or_more: v1.PromptToolChoiceZeroOrMore = {"type": "zero_or_more"}
            return choice_zero_or_more, disable_parallel_tool_use
        if obj["type"] == "any":
            disable_parallel_tool_use = (
                obj["disable_parallel_tool_use"] if "disable_parallel_tool_use" in obj else None
            )
            choice_one_or_more: v1.PromptToolChoiceOneOrMore = {"type": "one_or_more"}
            return choice_one_or_more, disable_parallel_tool_use
        if obj["type"] == "tool":
            disable_parallel_tool_use = (
                obj["disable_parallel_tool_use"] if "disable_parallel_tool_use" in obj else None
            )
            choice_function_tool: v1.PromptToolChoiceSpecificFunctionTool = {
                "type": "specific_function",
                "function_name": obj["name"],
            }
            return choice_function_tool, disable_parallel_tool_use
        if obj["type"] == "none":
            return v1.PromptToolChoiceNone(type="none"), None
        assert_never(obj["type"])


class _ToolConversion:
    @staticmethod
    def to_anthropic(
        obj: Iterable[v1.PromptToolFunction],
    ) -> Iterator[ToolParam]:
        for tool in obj:
            function = tool["function"]
            input_schema: dict[str, Any] = (
                dict(function["parameters"]) if "parameters" in function else {}
            )
            param: ToolParam = {
                "name": function["name"],
                "input_schema": input_schema,
            }
            if "description" in function:
                param["description"] = function["description"]
            yield param

    @staticmethod
    def from_anthropic(
        obj: Iterable[ToolParam],
    ) -> Iterator[v1.PromptToolFunction]:
        for tool in obj:
            function = v1.PromptToolFunctionDefinition(
                name=tool["name"],
            )
            if "description" in tool:
                function["description"] = tool["description"]
            if "input_schema" in tool:
                function["parameters"] = tool["input_schema"]
            yield v1.PromptToolFunction(type="function", function=function)


class _MessageConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[MessageParam]:
        role = _RoleConversion.to_anthropic(obj)
        if isinstance(obj["content"], str):
            yield {"role": role, "content": formatter.format(obj["content"], variables=variables)}
            return
        blocks = list(_ContentConversion.to_anthropic(obj["content"], variables, formatter))
        if len(blocks) == 1 and blocks[0]["type"] == "text":
            yield {"role": role, "content": blocks[0]["text"]}
            return
        yield {"role": role, "content": blocks}

    @staticmethod
    def from_anthropic(
        obj: MessageParam,
    ) -> v1.PromptMessage:
        content = _ContentConversion.from_anthropic(obj["content"])
        role = _RoleConversion.from_anthropic(obj)
        return v1.PromptMessage(role=role, content=content)


class _TextContentPartConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.TextContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> TextBlockParam:
        text = formatter.format(obj["text"], variables=variables)
        return {"type": "text", "text": text}

    @staticmethod
    def from_anthropic_block(
        obj: TextBlock,
    ) -> v1.TextContentPart:
        return v1.TextContentPart(type="text", text=obj.text)

    @staticmethod
    def from_anthropic(
        obj: TextBlockParam,
    ) -> v1.TextContentPart:
        return v1.TextContentPart(type="text", text=obj["text"])


class _ToolCallContentPartConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.ToolCallContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> ToolUseBlockParam:
        id_ = obj["tool_call_id"]
        tool_call = obj["tool_call"]
        name = tool_call["name"]
        input_ = tool_call["arguments"] if "arguments" in tool_call else "{}"
        return {
            "type": "tool_use",
            "id": id_,
            "name": name,
            "input": input_,
        }

    @staticmethod
    def from_anthropic_block(
        obj: ToolUseBlock,
    ) -> v1.ToolCallContentPart:
        if isinstance(obj.input, (dict, list)):
            arguments = json.dumps(obj.input)  # pyright: ignore[reportUnknownMemberType]
        else:
            arguments = str(obj.input)
        assert isinstance(arguments, str)
        return v1.ToolCallContentPart(
            type="tool_call",
            tool_call_id=obj.id,
            tool_call=v1.ToolCallFunction(
                type="function",
                name=obj.name,
                arguments=arguments,
            ),
        )

    @staticmethod
    def from_anthropic(
        obj: ToolUseBlockParam,
    ) -> v1.ToolCallContentPart:
        if isinstance(obj["input"], (dict, list)):
            arguments = json.dumps(obj["input"])
        else:
            arguments = str(obj["input"])
        assert isinstance(arguments, str)
        return v1.ToolCallContentPart(
            type="tool_call",
            tool_call_id=obj["id"],
            tool_call=v1.ToolCallFunction(
                type="function",
                name=obj["name"],
                arguments=arguments,
            ),
        )


class _ToolResultContentPartConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.ToolResultContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> ToolResultBlockParam:
        id_ = obj["tool_call_id"]
        param: ToolResultBlockParam = {
            "type": "tool_result",
            "tool_use_id": id_,
        }
        if isinstance(obj["tool_result"], str):
            param["content"] = obj["tool_result"]
        elif isinstance(obj["tool_result"], Sequence):
            content: list[TextBlockParam] = []
            for result in obj["tool_result"]:
                if isinstance(result, dict):
                    if (
                        "type" in result
                        and result["type"] == "text"
                        and "text" in result
                        and isinstance(result["text"], str)
                        and set(result.keys()) == {"type", "text"}  # pyright: ignore[reportUnknownArgumentType]
                    ):
                        text = str(result["text"])
                    else:
                        text = json.dumps(result)
                else:
                    text = str(result)
                content.append({"type": "text", "text": text})
            param["content"] = content
        elif isinstance(obj["tool_result"], Mapping):
            param["content"] = json.dumps(obj["tool_result"])
        elif obj["tool_result"] is not None:
            param["content"] = str(obj["tool_result"])
        return param

    @staticmethod
    def from_anthropic(
        obj: ToolResultBlockParam,
    ) -> v1.ToolResultContentPart:
        ans = v1.ToolResultContentPart(
            type="tool_result",
            tool_call_id=obj["tool_use_id"],
            tool_result=None,
        )
        if "content" in obj:
            if isinstance(obj["content"], str):
                ans["tool_result"] = obj["content"]
            elif isinstance(obj["content"], Iterable):
                ans["tool_result"] = list(obj["content"])
            elif TYPE_CHECKING:
                assert_never(obj["content"])
        return ans


class _ContentConversion:
    @overload
    @staticmethod
    def to_anthropic(
        parts: Sequence[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: Literal[True] = True,
    ) -> Iterator[TextBlockParam]: ...

    @overload
    @staticmethod
    def to_anthropic(
        parts: Sequence[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: Literal[False] = False,
    ) -> Iterator[_BlockParam]: ...

    @staticmethod
    def to_anthropic(
        parts: Sequence[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: bool = False,
    ) -> Any:
        for part in parts:
            if part["type"] == "text":
                yield _TextContentPartConversion.to_anthropic(part, variables, formatter)
            elif text_only:
                continue
            elif part["type"] == "tool_result":
                yield _ToolResultContentPartConversion.to_anthropic(part, variables, formatter)
            elif part["type"] == "tool_call":
                yield _ToolCallContentPartConversion.to_anthropic(part, variables, formatter)
            else:
                assert_never(part)

    @staticmethod
    def from_anthropic(
        obj: Optional[Union[str, Iterable[Union[_BlockParam, ContentBlock]]]],
    ) -> list[_ContentPart]:
        if isinstance(obj, str):
            return [
                v1.TextContentPart(
                    type="text",
                    text=obj,
                )
            ]
        content: list[_ContentPart] = []
        for block in obj or ():
            if isinstance(block, dict):
                if block["type"] == "text":
                    content.append(_TextContentPartConversion.from_anthropic(block))
                elif block["type"] == "image":
                    raise NotImplementedError
                elif block["type"] == "tool_use":
                    content.append(_ToolCallContentPartConversion.from_anthropic(block))
                elif block["type"] == "tool_result":
                    content.append(_ToolResultContentPartConversion.from_anthropic(block))
                elif block["type"] == "document":
                    raise NotImplementedError
                elif block["type"] == "thinking":
                    raise NotImplementedError
                elif block["type"] == "redacted_thinking":
                    raise NotImplementedError
                else:
                    assert_never(block["type"])
            else:
                from anthropic.types import TextBlock, ToolUseBlock

                if isinstance(block, TextBlock):
                    content.append(_TextContentPartConversion.from_anthropic_block(block))
                    continue
                if isinstance(block, ToolUseBlock):
                    content.append(_ToolCallContentPartConversion.from_anthropic_block(block))
                    continue
                if _anthropic_version < (0, 47):
                    continue
                from anthropic.types import ThinkingBlock

                if isinstance(block, ThinkingBlock):
                    raise NotImplementedError
                from anthropic.types import RedactedThinkingBlock

                if isinstance(block, RedactedThinkingBlock):
                    raise NotImplementedError
        return content


class _RoleConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.PromptMessage,
    ) -> Literal["user", "assistant"]:
        role = obj["role"]
        if role == "user":
            return "user"
        if role == "assistant":
            return "assistant"
        if role == "model":
            return "assistant"
        if role == "ai":
            return "assistant"
        if role == "system":
            raise NotImplementedError
        if role == "developer":
            raise NotImplementedError
        if role == "tool":
            return "user"
        if TYPE_CHECKING:
            assert_never(role)
        return role

    @staticmethod
    def from_anthropic(
        obj: MessageParam,
    ) -> Literal["user", "assistant", "tool"]:
        if obj["role"] == "assistant":
            return "assistant"
        if obj["role"] == "user":
            if isinstance(obj["content"], list):
                for block in obj["content"]:
                    if isinstance(block, dict) and block["type"] == "tool_result":
                        return "tool"
                    else:
                        continue
            return "user"
        if TYPE_CHECKING:
            assert_never(obj["role"])
        return obj["role"]


def _get_tool_params(
    tools: Iterable[ToolUnionParam],
) -> Iterator[ToolParam]:
    for tool in tools:
        if "type" in tool:
            continue
        yield tool
