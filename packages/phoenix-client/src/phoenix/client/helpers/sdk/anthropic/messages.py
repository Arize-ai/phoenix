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
    PromptChatTemplateV1,
    PromptMessage,
    PromptToolDefinition,
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
    MUSTACHE_TEMPLATE_FORMATTER,
    TemplateFormatter,
    to_formatter,
)

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
    assert isinstance(obj.template, PromptChatTemplateV1)
    system_messages: list[str] = []
    messages: list[MessageParam] = []
    for message in obj.template.messages:
        if message.role in ("SYSTEM",):
            for block in _to_content(message.content, variables, formatter):
                if isinstance(block, dict) and block["type"] == "text":
                    system_messages.append(block["text"])
        else:
            messages.extend(_to_message_params(message, variables, formatter))
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
    parameters = obj.invocation_parameters or {}

    max_tokens = 100
    if (v := parameters.get("max_tokens")) is not None:
        try:
            max_tokens = int(v)
        except (ValueError, TypeError):
            pass
    ans: _ModelKwargs = {
        "max_tokens": max_tokens,
        "model": obj.model_name,
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

    if obj.tools and (tools := list(_to_tools(obj.tools))):
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
    for tool_definition in obj.tool_definitions:
        definition = tool_definition.definition
        if "name" in definition and "input_schema" in definition:
            tool: ToolParam = {
                "name": definition["name"],
                "input_schema": definition["input_schema"],
            }
            if "description" in definition:
                tool["description"] = definition["description"]
            yield tool


def _from_tools(
    tools: Iterable[ToolParam],
) -> PromptToolsV1:
    return PromptToolsV1(
        tool_definitions=[
            PromptToolDefinition(
                definition={
                    "name": tool["name"],
                    "input_schema": tool["input_schema"],
                    **(
                        {"description": description}
                        if (description := tool.get("description"))
                        else {}
                    ),
                }
            )
            for tool in tools
        ]
    )


def _to_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[MessageParam]:
    blocks = list(_to_content(obj.content, variables, formatter))
    role = _to_role(obj)
    if len(blocks) == 1 and blocks[0]["type"] == "text":
        yield {"role": role, "content": blocks[0]["text"]}
        return
    yield {"role": role, "content": blocks}


def _from_message_param(
    obj: MessageParam,
) -> PromptMessage:
    content = _from_content(obj["content"])
    role = _from_role(obj)
    return PromptMessage(role=role, content=content)


def _to_text_block_param(
    obj: TextContentPart,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> TextBlockParam:
    text = formatter.format(obj.text.text, variables=variables)
    return {"type": "text", "text": text}


def _from_text_block(
    obj: TextBlock,
) -> TextContentPart:
    return TextContentPart(
        type="text",
        text=TextContentValue(text=obj.text),
    )


def _from_text_block_param(
    obj: TextBlockParam,
) -> TextContentPart:
    return TextContentPart(
        text=TextContentValue(
            text=obj["text"],
        ),
    )


def _to_image_block_param(
    obj: ImageContentPart,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> ImageBlockParam:
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "data": obj.image.url,
            "media_type": "image/png",
        },
    }


def _from_image_block_param(
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
        image=ImageContentValue(
            url=url,
        ),
    )


def _to_tool_use_block_param(
    obj: ToolCallContentPart,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> ToolUseBlockParam:
    assert obj.tool_call.tool_call_id is not None
    return {
        "type": "tool_use",
        "id": obj.tool_call.tool_call_id,
        "name": obj.tool_call.tool_call.name,
        "input": obj.tool_call.tool_call.arguments,
    }


def _from_tool_use_block(
    obj: ToolUseBlock,
) -> ToolCallContentPart:
    if isinstance(obj.input, (dict, list)):
        arguments = json.dumps(obj.input)
    else:
        arguments = str(obj.input)
    assert isinstance(arguments, str)
    return ToolCallContentPart(
        tool_call=ToolCallContentValue(
            tool_call_id=obj.id,
            tool_call=ToolCallFunction(
                name=obj.name,
                arguments=arguments,
            ),
        )
    )


def _from_tool_use_block_param(
    obj: ToolUseBlockParam,
) -> ToolCallContentPart:
    if isinstance(obj["input"], (dict, list)):
        arguments = json.dumps(obj["input"])
    else:
        arguments = str(obj["input"])
    assert isinstance(arguments, str)
    return ToolCallContentPart(
        tool_call=ToolCallContentValue(
            tool_call_id=obj["id"],
            tool_call=ToolCallFunction(
                name=obj["name"],
                arguments=arguments,
            ),
        )
    )


def _to_tool_result_block_param(
    obj: ToolResultContentPart,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> ToolResultBlockParam:
    content = str(obj.tool_result.result)  # TODO: relax this
    return {
        "type": "tool_result",
        "tool_use_id": obj.tool_result.tool_call_id,
        "content": content,
    }


def _from_tool_result_block_param(
    obj: ToolResultBlockParam,
) -> ToolResultContentPart:
    result = str(obj["content"]) if "content" in obj else None  # TODO: relax this
    return ToolResultContentPart(
        tool_result=ToolResultContentValue(
            tool_call_id=obj["tool_use_id"],
            result=result,
        )
    )


@overload
def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: Literal[True] = True,
) -> Iterator[TextBlockParam]: ...


@overload
def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: Literal[False] = False,
) -> Iterator[_BlockParam]: ...


def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: bool = False,
) -> Any:
    for part in parts:
        if isinstance(part, TextContentPart):
            yield _to_text_block_param(part, variables, formatter)
        elif text_only:
            continue
        elif isinstance(part, ImageContentPart):
            yield _to_image_block_param(part, variables, formatter)
        elif isinstance(part, ToolResultContentPart):
            yield _to_tool_result_block_param(part, variables, formatter)
        elif isinstance(part, ToolCallContentPart):
            yield _to_tool_use_block_param(part, variables, formatter)
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
                content.append(_from_text_block_param(block))
            elif block["type"] == "image":
                content.append(_from_image_block_param(block))
            elif block["type"] == "tool_use":
                content.append(_from_tool_use_block_param(block))
            elif block["type"] == "tool_result":
                content.append(_from_tool_result_block_param(block))
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
    return content


def _to_role(
    obj: PromptMessage,
) -> Literal["user", "assistant"]:
    if obj.role == "USER":
        return "user"
    if obj.role == "AI":
        return "assistant"
    if obj.role == "TOOL":
        return "user"
    if obj.role == "SYSTEM":
        raise ValueError
    assert_never(obj.role)


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
    assert_never(obj["role"])


if TYPE_CHECKING:
    from anthropic import Anthropic
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
    from anthropic.types.message_create_params import MessageCreateParamsBase

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
        MessageCreateParamsBase(messages=messages, **kwargs)
        Anthropic().messages.create(messages=messages, **kwargs)
