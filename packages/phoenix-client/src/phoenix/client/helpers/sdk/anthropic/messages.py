from __future__ import annotations

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
    TypedDict,
    Union,
    overload,
)

from typing_extensions import Required, TypeAlias, assert_never

from phoenix.client.__generated__ import v1
from phoenix.client.utils.template_formatters import (
    TemplateFormatter,
    to_formatter,
)

if TYPE_CHECKING:
    from anthropic._client import Anthropic
    from anthropic.types import (
        ContentBlock,
        DocumentBlockParam,
        ImageBlockParam,
        MessageParam,
        ModelParam,
        TextBlock,
        TextBlockParam,
        ToolChoiceAnyParam,
        ToolChoiceAutoParam,
        ToolChoiceParam,
        ToolChoiceToolParam,
        ToolParam,
        ToolResultBlockParam,
        ToolUseBlock,
        ToolUseBlockParam,
    )

    _BlockParam: TypeAlias = Union[
        TextBlockParam,
        ImageBlockParam,
        ToolUseBlockParam,
        ToolResultBlockParam,
        DocumentBlockParam,
    ]
    _ContentPart: TypeAlias = Union[
        v1.TextContentPart,
        v1.ToolCallContentPart,
        v1.ToolResultContentPart,
    ]

    def _(obj: v1.PromptVersion) -> None:
        messages, kwargs = to_chat_messages_and_kwargs(obj)
        Anthropic().messages.create(messages=messages, **kwargs)


class _ToolKwargs(TypedDict, total=False):
    tools: list[ToolParam]
    tool_choice: ToolChoiceParam


class _ModelKwargs(_ToolKwargs, TypedDict, total=False):
    max_tokens: Required[int]
    model: Required[ModelParam]
    stop_sequences: list[str]
    system: Union[str, list[TextBlockParam]]
    temperature: float
    top_p: float


logger = logging.getLogger(__name__)


__all__ = [
    "to_chat_messages_and_kwargs",
]


def to_chat_messages_and_kwargs(
    obj: v1.PromptVersion,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
    **_: Any,
) -> tuple[list[MessageParam], _ModelKwargs]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    system_messages: list[str] = []
    messages: list[MessageParam] = []
    if template["type"] == "chat":
        for message in template["messages"]:
            if message["role"] == "SYSTEM":
                for block in _ContentConversion.to_anthropic(
                    message["content"], variables, formatter
                ):
                    if block["type"] == "text":
                        system_messages.append(block["text"])
            else:
                messages.extend(_MessageConversion.to_anthropic(message, variables, formatter))
    elif template["type"] == "string":
        content = formatter.format(template["template"], variables=variables)
        messages.append({"role": "user", "content": content})
    elif TYPE_CHECKING:
        assert_never(template)
    kwargs: _ModelKwargs = _ModelKwargsConversion.to_anthropic(obj)
    if system_messages:
        if len(system_messages) == 1:
            kwargs["system"] = system_messages[0]
        else:
            kwargs["system"] = [{"type": "text", "text": text} for text in system_messages]
    return messages, kwargs


class _ModelKwargsConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.PromptVersion,
    ) -> _ModelKwargs:
        parameters: v1.PromptAnthropicInvocationParametersContent = (
            obj["invocation_parameters"]["anthropic"]
            if "invocation_parameters" in obj
            and obj["invocation_parameters"]["type"] == "anthropic"
            else {"max_tokens": 100}
        )
        ans: _ModelKwargs = {
            "max_tokens": parameters["max_tokens"],
            "model": obj["model_name"],
        }
        if "stop_sequences" in parameters:
            ans["stop_sequences"] = list(parameters["stop_sequences"])
        if "temperature" in parameters:
            ans["temperature"] = parameters["temperature"]
        if "top_p" in parameters:
            ans["top_p"] = parameters["top_p"]
        if "tools" in obj:
            tool_kwargs = _ToolKwargsConversion.to_anthropic(obj["tools"])
            if "tools" in tool_kwargs:
                ans["tools"] = tool_kwargs["tools"]
                if "tool_choice" in tool_kwargs:
                    ans["tool_choice"] = tool_kwargs["tool_choice"]
        return ans


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
        tools: list[v1.PromptFunctionTool] = list(_ToolConversion.from_anthropic(obj["tools"]))
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
            v1.PromptToolChoiceZeroOrMore,
            v1.PromptToolChoiceOneOrMore,
            v1.PromptToolChoiceSpecificFunctionTool,
        ],
        disable_parallel_tool_use: Optional[bool] = None,
    ) -> ToolChoiceParam:
        if obj["type"] == "zero-or-more":
            choice_auto: ToolChoiceAutoParam = {"type": "auto"}
            if disable_parallel_tool_use is not None:
                choice_auto["disable_parallel_tool_use"] = disable_parallel_tool_use
            return choice_auto
        if obj["type"] == "one-or-more":
            choice_any: ToolChoiceAnyParam = {"type": "any"}
            if disable_parallel_tool_use is not None:
                choice_any["disable_parallel_tool_use"] = disable_parallel_tool_use
            return choice_any
        if obj["type"] == "specific-function-tool":
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
            choice_zero_or_more: v1.PromptToolChoiceZeroOrMore = {"type": "zero-or-more"}
            return choice_zero_or_more, disable_parallel_tool_use
        if obj["type"] == "any":
            disable_parallel_tool_use = (
                obj["disable_parallel_tool_use"] if "disable_parallel_tool_use" in obj else None
            )
            choice_one_or_more: v1.PromptToolChoiceOneOrMore = {"type": "one-or-more"}
            return choice_one_or_more, disable_parallel_tool_use
        if obj["type"] == "tool":
            disable_parallel_tool_use = (
                obj["disable_parallel_tool_use"] if "disable_parallel_tool_use" in obj else None
            )
            choice_function_tool: v1.PromptToolChoiceSpecificFunctionTool = {
                "type": "specific-function-tool",
                "function_name": obj["name"],
            }
            return choice_function_tool, disable_parallel_tool_use
        assert_never(obj["type"])


class _ToolConversion:
    @staticmethod
    def to_anthropic(
        obj: Iterable[v1.PromptFunctionTool],
    ) -> Iterator[ToolParam]:
        for ft in obj:
            input_schema: dict[str, Any] = dict(ft["schema"]["json"]) if "schema" in ft else {}
            param: ToolParam = {
                "name": ft["name"],
                "input_schema": input_schema,
            }
            if "description" in ft:
                param["description"] = ft["description"]
            yield param

    @staticmethod
    def from_anthropic(
        obj: Iterable[ToolParam],
    ) -> Iterator[v1.PromptFunctionTool]:
        for tp in obj:
            function = v1.PromptFunctionTool(
                type="function-tool",
                name=tp["name"],
            )
            if "description" in tp:
                function["description"] = tp["description"]
            if "input_schema" in tp:
                function["schema"] = v1.JSONSchemaDraft7ObjectSchema(
                    type="json-schema-draft-7-object-schema",
                    json=tp["input_schema"],
                )
            yield function


class _MessageConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[MessageParam]:
        blocks = list(_ContentConversion.to_anthropic(obj["content"], variables, formatter))
        role = _RoleConversion.to_anthropic(obj)
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
        text = formatter.format(obj["text"]["text"], variables=variables)
        return {"type": "text", "text": text}

    @staticmethod
    def from_anthropic_block(
        obj: TextBlock,
    ) -> v1.TextContentPart:
        text = v1.TextContentValue(text=obj.text)
        return v1.TextContentPart(type="text", text=text)

    @staticmethod
    def from_anthropic(
        obj: TextBlockParam,
    ) -> v1.TextContentPart:
        text = v1.TextContentValue(text=obj["text"])
        return v1.TextContentPart(type="text", text=text)


class _ToolCallContentPartConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.ToolCallContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> ToolUseBlockParam:
        id_ = obj["tool_call"]["tool_call_id"] if "tool_call_id" in obj["tool_call"] else ""
        tool_call = obj["tool_call"]["tool_call"]
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
            tool_call=v1.ToolCallContentValue(
                tool_call_id=obj.id,
                tool_call=v1.ToolCallFunction(
                    type="function",
                    name=obj.name,
                    arguments=arguments,
                ),
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
            tool_call=v1.ToolCallContentValue(
                tool_call_id=obj["id"],
                tool_call=v1.ToolCallFunction(
                    type="function",
                    name=obj["name"],
                    arguments=arguments,
                ),
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
        id_ = obj["tool_result"]["tool_call_id"] if "tool_call_id" in obj["tool_result"] else ""
        param: ToolResultBlockParam = {
            "type": "tool_result",
            "tool_use_id": id_,
        }
        if "result" in obj["tool_result"]:
            param["content"] = str(obj["tool_result"]["result"])
        return param

    @staticmethod
    def from_anthropic(
        obj: ToolResultBlockParam,
    ) -> v1.ToolResultContentPart:
        tool_result = v1.ToolResultContentValue(
            tool_call_id=obj["tool_use_id"],
            result=None,
        )
        if "content" in obj:
            tool_result["result"] = str(obj["content"])
        return v1.ToolResultContentPart(
            type="tool_result",
            tool_result=tool_result,
        )


class _ContentConversion:
    @overload
    @staticmethod
    def to_anthropic(
        parts: Iterable[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: Literal[True] = True,
    ) -> Iterator[TextBlockParam]: ...

    @overload
    @staticmethod
    def to_anthropic(
        parts: Iterable[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: Literal[False] = False,
    ) -> Iterator[_BlockParam]: ...

    @staticmethod
    def to_anthropic(
        parts: Iterable[_ContentPart],
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
                    text=v1.TextContentValue(text=obj),
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
                else:
                    assert_never(block["type"])
            else:
                from anthropic.types import TextBlock, ToolUseBlock

                if isinstance(block, TextBlock):
                    content.append(_TextContentPartConversion.from_anthropic_block(block))
                elif isinstance(block, ToolUseBlock):
                    content.append(_ToolCallContentPartConversion.from_anthropic_block(block))
                else:
                    assert_never(block)
        return content


class _RoleConversion:
    @staticmethod
    def to_anthropic(
        obj: v1.PromptMessage,
    ) -> Literal["user", "assistant"]:
        role = obj["role"]
        if role == "USER":
            return "user"
        if role == "AI":
            return "assistant"
        if role == "SYSTEM":
            raise NotImplementedError
        if role == "TOOL":
            return "user"
        if TYPE_CHECKING:
            assert_never(role)
        return role

    @staticmethod
    def from_anthropic(
        obj: MessageParam,
    ) -> Literal["USER", "AI", "TOOL"]:
        if obj["role"] == "assistant":
            return "AI"
        if obj["role"] == "user":
            if isinstance(obj["content"], list):
                for block in obj["content"]:
                    if isinstance(block, dict) and block["type"] == "tool_result":
                        return "TOOL"
                    else:
                        continue
            return "USER"
        if TYPE_CHECKING:
            assert_never(obj["role"])
        return obj["role"]
