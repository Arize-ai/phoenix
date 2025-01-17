from __future__ import annotations

import json
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
    Union,
    overload,
)

from typing_extensions import TypeAlias, assert_never

from phoenix.client.types.v1 import (
    ImageContentPart,
    ImageContentValue,
    PromptChatTemplateV1,
    PromptMessage,
    PromptToolsV1,
    PromptVersion,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolCallContentValue,
    ToolCallFunction,
    ToolResultContentPart,
)
from phoenix.client.utils.template_formatters import (
    F_STRING_TEMPLATE_FORMATTER,
    MUSTACHE_TEMPLATE_FORMATTER,
    NO_OP_FORMATER,
    TemplateFormatter,
)

if TYPE_CHECKING:
    from anthropic.types import (
        ContentBlock,
        DocumentBlockParam,
        ImageBlockParam,
        MessageParam,
        TextBlock,
        TextBlockParam,
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
        ContentBlock,
    ]
    _ContentPart: TypeAlias = Union[
        ImageContentPart,
        TextContentPart,
        ToolCallContentPart,
        ToolResultContentPart,
    ]


def to_kwargs(
    obj: PromptVersion,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
) -> dict[str, Any]:
    formatter: TemplateFormatter
    if obj.template_format is None:
        formatter = MUSTACHE_TEMPLATE_FORMATTER
    elif obj.template_format == "MUSTACHE":
        formatter = MUSTACHE_TEMPLATE_FORMATTER
    elif obj.template_format == "FSTRING":
        formatter = F_STRING_TEMPLATE_FORMATTER
    elif obj.template_format == "NONE":
        formatter = NO_OP_FORMATER
    else:
        assert_never(obj.template_format)
    assert isinstance(obj.template, PromptChatTemplateV1)
    system_messages: list[str] = []
    messages: list[MessageParam] = []
    for message in obj.template.messages:
        if message.role in ("SYSTEM",):
            for block in to_content(message.content, variables, formatter):
                if isinstance(block, dict) and block["type"] == "text":
                    system_messages.append(block["text"])
                elif isinstance(block, TextBlock) and block.text:
                    system_messages.append(block.text)
        else:
            messages.extend(to_message_params(message, variables, formatter))
    model = obj.model_name
    system = "\n\n".join(system_messages)
    kwargs: dict[str, Any] = {
        "messages": messages,
        "model": model,
        "system": system,
    }
    for k, v in (obj.invocation_parameters or {}).items():
        kwargs[k] = v
    tools: list[ToolParam] = to_tools(obj)
    if tools:
        kwargs["tools"] = tools
        if tool_choice := kwargs.get("tool_choice"):
            kwargs["tool_choice"] = {"type": tool_choice}
    else:
        kwargs.pop("tool_choice", None)
    if "max_tokens" not in kwargs:
        kwargs["max_tokens"] = 100
    return kwargs


def from_kwargs(
    kwargs: Mapping[str, Any],
) -> PromptVersion:
    raise NotImplementedError


def to_tools(
    obj: PromptVersion,
) -> list[ToolParam]:
    tools: list[ToolParam] = []
    if isinstance(obj.tools, PromptToolsV1):
        for tool_definition in obj.tools.tool_definitions:
            definition = tool_definition.definition
            if "name" in definition and "input_schema" in definition:
                tool: ToolParam = {
                    "name": definition["name"],
                    "input_schema": definition["input_schema"],
                }
                if "description" in definition:
                    tool["description"] = definition["description"]
                tools.append(tool)
    return tools


def to_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[MessageParam]:
    blocks = to_content(obj.content, variables, formatter)
    role = to_role(obj)
    if len(blocks) == 1 and blocks[0]["type"] == "text":
        yield {"role": role, "content": blocks[0]["text"]}
        return
    yield {"role": role, "content": blocks}


def from_message_param(
    obj: MessageParam,
) -> PromptMessage:
    content = from_content(obj["content"])
    role = from_role(obj)
    return PromptMessage(role=role, content=content)


def to_text_block_param(
    obj: TextContentPart,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> TextBlockParam:
    text = formatter.format(obj.text.text, variables)
    return {"type": "text", "text": text}


def from_text_block(
    obj: TextBlock,
) -> TextContentPart:
    return TextContentPart(
        type="text",
        text=TextContentValue(text=obj.text),
    )


def from_text_block_param(
    obj: TextBlockParam,
) -> TextContentPart:
    return TextContentPart(
        text=TextContentValue(
            text=obj["text"],
        ),
    )


def to_image_block_param(
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


def from_image_block(
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


def to_tool_use_block_param(
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


def from_tool_use_block(
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


def from_tool_use_block_param(
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


def to_tool_result_block_param(
    obj: ToolResultContentPart,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    str_content: bool = False,
) -> ToolResultBlockParam:
    raise NotImplementedError


def from_tool_result_block_param(
    obj: ToolResultBlockParam,
) -> ToolResultContentPart:
    raise NotImplementedError


@overload
def to_content(
    obj: list[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: Literal[True] = True,
) -> list[TextBlockParam]: ...


@overload
def to_content(
    obj: list[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: Literal[False] = False,
) -> list[_BlockParam]: ...


def to_content(
    obj: list[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: bool = False,
) -> Any:
    content: list[_BlockParam] = []
    for part in obj:
        if isinstance(part, TextContentPart):
            content.append(to_text_block_param(part, variables, formatter))
        elif text_only:
            continue
        elif isinstance(part, ImageContentPart):
            content.append(to_image_block_param(part, variables, formatter))
        elif isinstance(part, ToolResultContentPart):
            content.append(to_tool_result_block_param(part, variables, formatter))
        elif isinstance(part, ToolCallContentPart):
            content.append(to_tool_use_block_param(part, variables, formatter))
        else:
            assert_never(part)
    return content


def from_content(
    obj: Optional[Union[str, Iterable[_BlockParam]]],
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
        if isinstance(block, TextBlock):
            content.append(from_text_block(block))
        elif isinstance(block, ToolUseBlock):
            content.append(from_tool_use_block(block))
        elif block["type"] == "text":
            content.append(from_text_block_param(block))
        elif block["type"] == "image":
            content.append(from_image_block(block))
        elif block["type"] == "tool_use":
            content.append(from_tool_use_block_param(block))
        elif block["type"] == "tool_result":
            content.append(from_tool_result_block_param(block))
        elif block["type"] == "document":
            raise NotImplementedError
        else:
            assert_never(block["type"])
    return content


def to_role(
    obj: PromptMessage,
) -> Literal["user", "assistant"]:
    if obj.role == "AI":
        return "assistant"
    if obj.role == "USER":
        return "user"
    if obj.role == "TOOL":
        return "user"
    if obj.role == "SYSTEM":
        raise ValueError
    assert_never(obj.role)


def from_role(
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
