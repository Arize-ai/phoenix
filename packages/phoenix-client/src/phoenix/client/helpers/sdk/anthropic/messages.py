from __future__ import annotations

import json
import logging
from os import PathLike
from types import MappingProxyType
from typing import (
    IO,
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

from phoenix.client.__generated__.v1 import (
    ImageContentPart,
    ImageContentValue,
    PromptFunctionToolV1,
    PromptMessage,
    PromptToolsV1,
    PromptVersion,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolCallContentValue,
    ToolCallFunction,
    ToolResultContentPart,
    ToolResultContentValue,
)
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
        ToolChoiceParam,
        ToolParam,
        ToolResultBlockParam,
        ToolUseBlock,
        ToolUseBlockParam,
    )
    from anthropic.types.image_block_param import Source

    _BlockParam: TypeAlias = Union[
        TextBlockParam,
        ImageBlockParam,
        ToolUseBlockParam,
        ToolResultBlockParam,
        DocumentBlockParam,
    ]
    _ContentPart: TypeAlias = Union[
        ImageContentPart,
        TextContentPart,
        ToolCallContentPart,
        ToolResultContentPart,
    ]

    class _ModelKwargs(TypedDict, total=False):
        max_tokens: Required[int]
        model: Required[ModelParam]
        stop_sequences: list[str]
        system: Union[str, list[TextBlockParam]]
        temperature: float
        tool_choice: ToolChoiceParam
        tools: list[ToolParam]
        top_k: int
        top_p: float

    def _(obj: PromptVersion) -> None:
        messages, kwargs = to_chat_messages_and_kwargs(obj)
        Anthropic().messages.create(messages=messages, **kwargs)


logger = logging.getLogger(__name__)


__all__ = [
    "to_chat_messages_and_kwargs",
]


def to_chat_messages_and_kwargs(
    obj: PromptVersion,
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
    if template["version"] == "chat-template-v1":
        for message in template["messages"]:
            if message["role"] == "SYSTEM":
                for block in _to_content(message["content"], variables, formatter):
                    if block["type"] == "text":
                        system_messages.append(block["text"])
            else:
                messages.extend(_to_messages(message, variables, formatter))
    elif template["version"] == "string-template-v1":
        content = formatter.format(template["template"], variables=variables)
        messages.append({"role": "user", "content": content})
    elif TYPE_CHECKING:
        assert_never(template)
    kwargs: _ModelKwargs = _to_model_kwargs(obj)
    if system_messages:
        if len(system_messages) == 1:
            kwargs["system"] = system_messages[0]
        else:
            kwargs["system"] = [{"type": "text", "text": text} for text in system_messages]
    return messages, kwargs


def _to_model_kwargs(
    obj: PromptVersion,
) -> _ModelKwargs:
    parameters: Mapping[str, Any] = (
        obj["invocation_parameters"] if "invocation_parameters" in obj else {}
    )
    max_tokens = 100
    if (v := parameters.get("max_tokens")) is not None:
        try:
            max_tokens = int(v)
        except (ValueError, TypeError):
            pass
    ans: _ModelKwargs = {
        "max_tokens": max_tokens,
        "model": obj["model_name"],
    }
    if (v := parameters.get("stop_sequences")) is not None:
        try:
            ans["stop_sequences"] = list(map(str, v))
        except (ValueError, TypeError):
            pass
    if (v := parameters.get("temperature")) is not None:
        try:
            ans["temperature"] = float(v)
        except (ValueError, TypeError):
            pass
    if (v := parameters.get("top_k")) is not None:
        try:
            ans["top_k"] = int(v)
        except (ValueError, TypeError):
            pass
    if (v := parameters.get("top_p")) is not None:
        try:
            ans["top_p"] = float(v)
        except (ValueError, TypeError):
            pass
    if "tools" in obj and obj["tools"] and (tools := list(_to_tools(obj["tools"]))):
        ans["tools"] = tools
        if (tool_choice := parameters.get("tool_choice")) is not None:
            if tool_choice == "any":
                ans["tool_choice"] = {"type": "any"}
            elif isinstance(tool_choice, str) and tool_choice != "auto":
                ans["tool_choice"] = {"type": "tool", "name": tool_choice}
        else:
            ans["tool_choice"] = {"type": "auto"}
    return ans


def _to_tools(
    obj: PromptToolsV1,
) -> Iterator[ToolParam]:
    for tool in obj["tools"]:
        input_schema: dict[str, Any] = dict(tool["schema"]) if "schema" in tool else {}
        param: ToolParam = {
            "name": tool["name"],
            "input_schema": input_schema,
        }
        if "description" in tool:
            param["description"] = tool["description"]
        yield param


def _from_tools(
    tools: Iterable[ToolParam],
) -> PromptToolsV1:
    functions: list[PromptFunctionToolV1] = []
    for tool in tools:
        function = PromptFunctionToolV1(
            type="function-tool-v1",
            name=tool["name"],
        )
        if "description" in tool:
            function["description"] = tool["description"]
        if "input_schema" in tool:
            function["schema"] = tool["input_schema"]
        functions.append(function)
    return PromptToolsV1(
        type="tools-v1",
        tools=functions,
    )


def _to_messages(
    obj: PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> Iterator[MessageParam]:
    blocks = list(_to_content(obj["content"], variables, formatter))
    role = _to_role(obj)
    if len(blocks) == 1 and blocks[0]["type"] == "text":
        yield {"role": role, "content": blocks[0]["text"]}
        return
    yield {"role": role, "content": blocks}


def _from_message(
    obj: MessageParam,
) -> PromptMessage:
    content = _from_content(obj["content"])
    role = _from_role(obj)
    return PromptMessage(role=role, content=content)


def _to_text(
    obj: TextContentPart,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> TextBlockParam:
    text = formatter.format(obj["text"]["text"], variables=variables)
    return {"type": "text", "text": text}


def _from_text_block(
    obj: TextBlock,
) -> TextContentPart:
    text = TextContentValue(text=obj.text)
    return TextContentPart(type="text", text=text)


def _from_text(
    obj: TextBlockParam,
) -> TextContentPart:
    text = TextContentValue(text=obj["text"])
    return TextContentPart(type="text", text=text)


def _to_image(
    obj: ImageContentPart,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> ImageBlockParam:
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "data": obj["image"]["url"],
            "media_type": "image/png",
        },
    }


def _from_image(
    obj: ImageBlockParam,
) -> ImageContentPart:
    source: Source = obj["source"]
    if isinstance(source["data"], str):
        url = source["data"]
    elif isinstance(source["data"], PathLike):
        url = str(source["data"])
    elif isinstance(source["data"], IO):
        raise NotImplementedError
    else:
        assert_never(source["data"])
    return ImageContentPart(
        type="image",
        image=ImageContentValue(
            url=url,
        ),
    )


def _to_tool_call(
    obj: ToolCallContentPart,
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


def _from_tool_use_block(
    obj: ToolUseBlock,
) -> ToolCallContentPart:
    if isinstance(obj.input, (dict, list)):
        arguments = json.dumps(obj.input)  # pyright: ignore[reportUnknownMemberType]
    else:
        arguments = str(obj.input)
    assert isinstance(arguments, str)
    return ToolCallContentPart(
        type="tool_call",
        tool_call=ToolCallContentValue(
            tool_call_id=obj.id,
            tool_call=ToolCallFunction(
                type="function",
                name=obj.name,
                arguments=arguments,
            ),
        ),
    )


def _from_tool_call(
    obj: ToolUseBlockParam,
) -> ToolCallContentPart:
    if isinstance(obj["input"], (dict, list)):
        arguments = json.dumps(obj["input"])
    else:
        arguments = str(obj["input"])
    assert isinstance(arguments, str)
    return ToolCallContentPart(
        type="tool_call",
        tool_call=ToolCallContentValue(
            tool_call_id=obj["id"],
            tool_call=ToolCallFunction(
                type="function",
                name=obj["name"],
                arguments=arguments,
            ),
        ),
    )


def _to_tool_result(
    obj: ToolResultContentPart,
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


def _from_tool_result(
    obj: ToolResultBlockParam,
) -> ToolResultContentPart:
    tool_result = ToolResultContentValue(
        tool_call_id=obj["tool_use_id"],
        result=None,
    )
    if "content" in obj:
        tool_result["result"] = str(obj["content"])
    return ToolResultContentPart(
        type="tool_result",
        tool_result=tool_result,
    )


@overload
def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
    *,
    text_only: Literal[True] = True,
) -> Iterator[TextBlockParam]: ...


@overload
def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
    *,
    text_only: Literal[False] = False,
) -> Iterator[_BlockParam]: ...


def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
    *,
    text_only: bool = False,
) -> Any:
    for part in parts:
        if part["type"] == "text":
            yield _to_text(part, variables, formatter)
        elif text_only:
            continue
        elif part["type"] == "image":
            yield _to_image(part, variables, formatter)
        elif part["type"] == "tool_result":
            yield _to_tool_result(part, variables, formatter)
        elif part["type"] == "tool_call":
            yield _to_tool_call(part, variables, formatter)
        else:
            assert_never(part)


def _from_content(
    obj: Optional[Union[str, Iterable[Union[_BlockParam, ContentBlock]]]],
) -> list[_ContentPart]:
    if isinstance(obj, str):
        return [
            TextContentPart(
                type="text",
                text=TextContentValue(text=obj),
            )
        ]
    content: list[_ContentPart] = []
    for block in obj or ():
        if isinstance(block, dict):
            if block["type"] == "text":
                content.append(_from_text(block))
            elif block["type"] == "image":
                content.append(_from_image(block))
            elif block["type"] == "tool_use":
                content.append(_from_tool_call(block))
            elif block["type"] == "tool_result":
                content.append(_from_tool_result(block))
            elif block["type"] == "document":
                raise NotImplementedError
            else:
                assert_never(block["type"])
        else:
            from anthropic.types import TextBlock, ToolUseBlock

            if isinstance(block, TextBlock):
                content.append(_from_text_block(block))
            elif isinstance(block, ToolUseBlock):
                content.append(_from_tool_use_block(block))
            else:
                assert_never(block)
    return content


def _to_role(
    obj: PromptMessage,
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


def _from_role(
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
