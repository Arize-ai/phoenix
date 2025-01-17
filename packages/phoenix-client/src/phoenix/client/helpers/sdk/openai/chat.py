from __future__ import annotations

from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
    Iterator,
    Literal,
    Mapping,
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
    from openai.types.chat import (
        ChatCompletionAssistantMessageParam,
        ChatCompletionContentPartImageParam,
        ChatCompletionContentPartInputAudioParam,
        ChatCompletionContentPartParam,
        ChatCompletionContentPartRefusalParam,
        ChatCompletionContentPartTextParam,
        ChatCompletionFunctionMessageParam,
        ChatCompletionMessageParam,
        ChatCompletionMessageToolCallParam,
        ChatCompletionRole,
        ChatCompletionSystemMessageParam,
        ChatCompletionToolMessageParam,
        ChatCompletionToolParam,
        ChatCompletionUserMessageParam,
    )
    from openai.types.shared_params import FunctionDefinition

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
    messages: list[ChatCompletionMessageParam] = []
    for message in obj.template.messages:
        messages.extend(to_message_params(message, variables, formatter))
    kwargs: dict[str, Any] = {
        "model": obj.model_name,
        "messages": messages,
    }
    tools: list[ChatCompletionToolParam] = to_tools(obj)
    if tools:
        kwargs["tools"] = tools
    for k, v in (obj.invocation_parameters or {}).items():
        kwargs[k] = v
    if "tools" not in kwargs and "tool_choice" in kwargs:
        kwargs.pop("tool_choice")
    return kwargs


def to_tools(
    obj: PromptVersion,
) -> list[ChatCompletionToolParam]:
    tools: list[ChatCompletionToolParam] = []
    if isinstance(obj.tools, PromptToolsV1):
        for tool_definition in obj.tools.tool_definitions:
            if "function" in tool_definition.definition:
                definition = tool_definition.definition["function"]
                if "name" in definition:
                    function: FunctionDefinition = {"name": definition["name"]}
                    if "parameters" in definition:
                        function["parameters"] = definition["parameters"]
                    if "description" in definition:
                        function["description"] = definition["description"]
                    tools.append({"type": "function", "function": function})
    return tools


def to_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionMessageParam]:
    if obj.role == "USER":
        yield from to_user_message_params(obj, variables, formatter)
    elif obj.role == "SYSTEM":
        yield from to_system_message_params(obj, variables, formatter)
    elif obj.role == "AI":
        yield from to_assistant_message_params(obj, variables, formatter)
    elif obj.role == "TOOL":
        yield from to_tool_message_params(obj, variables, formatter)
    else:
        assert_never(obj.role)


def from_message_param(
    obj: ChatCompletionMessageParam,
) -> PromptMessage:
    if obj["role"] == "user":
        return from_user_message_param(obj)
    if obj["role"] == "system":
        return from_system_message_param(obj)
    if obj["role"] == "developer":
        raise NotImplementedError
    if obj["role"] == "assistant":
        return from_assistant_message_param(obj)
    if obj["role"] == "tool":
        return from_tool_message_param(obj)
    if obj["role"] == "function":
        return from_function_message_param(obj)
    assert_never(obj["role"])


def to_user_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionUserMessageParam]:
    content = to_content(obj.content, variables, formatter)
    if len(content) == 1 and content[0]["type"] == "text":
        yield {"role": "user", "content": content[0]["text"]}
        return
    yield {"role": "user", "content": content}


def from_user_message_param(
    obj: ChatCompletionUserMessageParam,
) -> PromptMessage:
    return PromptMessage(
        role="USER",
        content=from_content(obj["content"]),
    )


def to_system_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionSystemMessageParam]:
    content: list[ChatCompletionContentPartTextParam] = to_content(
        obj.content, variables, formatter, text_only=True
    )
    if len(content) == 1 and content[0]["type"] == "text":
        yield {"role": "system", "content": content[0]["text"]}
        return
    yield {"role": "system", "content": content}


def from_system_message_param(
    obj: ChatCompletionSystemMessageParam,
) -> PromptMessage:
    return PromptMessage(
        role="SYSTEM",
        content=from_content(obj["content"]),
    )


def to_assistant_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionAssistantMessageParam]:
    tool_calls: list[ChatCompletionMessageToolCallParam] = []
    if len(obj.content) == 1:
        part = obj.content[0]
        if isinstance(part, TextContentPart):
            ...
        elif isinstance(part, ImageContentPart):
            raise NotImplementedError
        elif isinstance(part, ToolCallContentPart):
            tool_call = part.tool_call.tool_call
            if isinstance(tool_call, ToolCallFunction) and part.tool_call.tool_call_id:
                name = tool_call.name
                arguments = tool_call.arguments
                assert isinstance(arguments, str)
                tool_calls.append(
                    {
                        "type": "function",
                        "id": part.tool_call.tool_call_id,
                        "function": {"name": name, "arguments": arguments},
                    }
                )
        elif isinstance(part, ToolResultContentPart):
            raise NotImplementedError
        else:
            assert_never(part)
    content = to_content(obj.content, variables, formatter)
    if len(content) == 1 and content[0]["type"] == "text":
        yield {"role": "assistant", "content": content[0]["text"]}
    yield {
        "role": "assistant",
        "content": content,
    }


def from_assistant_message_param(
    obj: ChatCompletionAssistantMessageParam,
) -> PromptMessage:
    return PromptMessage(
        role="AI",
        content=from_content(obj["content"]),
    )


def to_tool_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionToolMessageParam]:
    raise NotImplementedError


def from_tool_message_param(
    obj: ChatCompletionToolMessageParam,
) -> PromptMessage:
    return PromptMessage(
        role="TOOL",
        content=from_content(obj["content"]),
    )


def from_function_message_param(
    obj: ChatCompletionFunctionMessageParam,
) -> PromptMessage:
    return PromptMessage(
        role="TOOL",
        content=from_content(obj["content"]),
    )


@overload
def to_content(
    obj: list[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: Literal[True] = True,
) -> list[ChatCompletionContentPartTextParam]: ...


@overload
def to_content(
    obj: list[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: bool,
) -> list[ChatCompletionContentPartParam]: ...


def to_content(
    obj: list[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: bool = False,
) -> Any:
    content: list[ChatCompletionContentPartParam] = []
    for part in obj:
        if isinstance(part, TextContentPart):
            text = formatter.format(part.text.text, variables)
            content.append({"type": "text", "text": text})
        elif text_only:
            continue
        elif isinstance(part, ImageContentPart):
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": part.image.url,
                    },
                }
            )
        elif isinstance(part, ToolResultContentPart):
            raise NotImplementedError
        elif isinstance(part, ToolCallContentPart):
            continue
        else:
            assert_never(part)
    return content


def from_content(
    obj: Union[
        str,
        Iterable[
            Union[
                ChatCompletionContentPartTextParam,
                ChatCompletionContentPartImageParam,
                ChatCompletionContentPartInputAudioParam,
                ChatCompletionContentPartRefusalParam,
            ]
        ],
        None,
    ],
) -> list[_ContentPart]:
    if isinstance(obj, str):
        return [
            TextContentPart(
                type="text",
                text=TextContentValue(text=obj),
            ),
        ]
    content: list[_ContentPart] = []
    for part in obj or ():
        if part["type"] == "text":
            content.append(
                TextContentPart(
                    type="text",
                    text=TextContentValue(text=part["text"]),
                )
            )
        elif part["type"] == "image_url":
            content.append(
                ImageContentPart(
                    type="image",
                    image=ImageContentValue(
                        url=part["image_url"]["url"],
                    ),
                )
            )
        elif part["type"] == "input_audio":
            raise NotImplementedError
        elif part["type"] == "refusal":
            raise NotImplementedError
        else:
            assert_never(part["type"])
    return content


def to_role(
    obj: PromptMessage,
) -> ChatCompletionRole:
    if obj.role == "AI":
        return "assistant"
    if obj.role == "USER":
        return "user"
    if obj.role == "TOOL":
        return "user"
    if obj.role == "SYSTEM":
        return "system"
    assert_never(obj.role)


def from_role(
    obj: ChatCompletionMessageParam,
) -> Literal["USER", "AI", "TOOL", "SYSTEM"]:
    if obj["role"] == "user":
        return "USER"
    if obj["role"] == "system":
        return "SYSTEM"
    if obj["role"] == "developer":
        raise NotImplementedError
    if obj["role"] == "assistant":
        return "AI"
    if obj["role"] == "tool":
        return "TOOL"
    if obj["role"] == "function":
        return "TOOL"
    assert_never(obj["role"])
