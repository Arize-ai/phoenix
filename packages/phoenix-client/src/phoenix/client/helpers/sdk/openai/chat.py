from __future__ import annotations

import json
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
    overload,
)

from typing_extensions import Required, TypeAlias, assert_never

from phoenix.client.__generated__.v1 import (
    ImageContentPart,
    ImageContentValue,
    PromptChatTemplateV1,
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
    MUSTACHE_TEMPLATE_FORMATTER,
    TemplateFormatter,
    to_formatter,
)

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
) -> tuple[list[ChatCompletionMessageParam], _ModelKwargs]:
    return (
        list(_to_chat_completion_message_params(obj, variables, formatter)),
        _to_model_kwargs(obj),
    )


def _to_chat_completion_message_params(
    obj: PromptVersion,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
    /,
) -> Iterator[ChatCompletionMessageParam]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    assert isinstance(obj.template, PromptChatTemplateV1)
    for message in obj.template.messages:
        yield from _to_message_params(message, variables, formatter)


def _to_model_kwargs(
    obj: PromptVersion,
) -> _ModelKwargs:
    ans: _ModelKwargs = {
        "model": obj.model_name,
    }
    if obj.tools and (tools := list(_to_tools(obj.tools))):
        ans["tools"] = tools
    parameters = obj.invocation_parameters or {}
    if (v := parameters.get("temperature")) is not None:
        try:
            ans["temperature"] = float(v)
        except (ValueError, TypeError):
            pass
    if (v := parameters.get("top_p")) is not None:
        try:
            ans["top_p"] = float(v)
        except (ValueError, TypeError):
            pass
    if (v := parameters.get("stop")) is not None:
        try:
            ans["stop"] = list(map(str, v))
        except (ValueError, TypeError):
            pass
    if (v := parameters.get("presence_penalty")) is not None:
        try:
            ans["presence_penalty"] = float(v)
        except (ValueError, TypeError):
            pass
    if (v := parameters.get("frequency_penalty")) is not None:
        try:
            ans["frequency_penalty"] = float(v)
        except (ValueError, TypeError):
            pass
    if (v := parameters.get("seed")) is not None:
        try:
            ans["seed"] = int(v)
        except (ValueError, TypeError):
            pass
    return ans


def _to_tools(
    obj: PromptToolsV1,
) -> Iterable[ChatCompletionToolParam]:
    for t in obj.tools:
        function: FunctionDefinition = {"name": t.name}
        if t.description:
            function["description"] = t.description
        if t.schema_:
            function["parameters"] = dict(t.schema_)
        if t.strict is not None:
            function["strict"] = t.strict
        yield {"type": "function", "function": function}


def _from_tools(
    tools: Iterable[ChatCompletionToolParam],
) -> PromptToolsV1:
    return PromptToolsV1(
        type="tools-v1",
        tools=[
            PromptFunctionToolV1(
                type="function-tool-v1",
                name=tool["function"]["name"],
                description=tool["function"].get("description"),
                schema=tool["function"].get("parameters"),  # type: ignore[call-arg]
                strict=tool["function"].get("strict"),
            )
            for tool in tools
            if tool["type"] == "function"
        ],
    )


def _to_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionMessageParam]:
    if obj.role == "USER":
        yield from _to_user_message_params(obj, variables, formatter)
    elif obj.role == "SYSTEM":
        yield from _to_system_message_params(obj, variables, formatter)
    elif obj.role == "AI":
        yield from _to_assistant_message_params(obj, variables, formatter)
    elif obj.role == "TOOL":
        yield from _to_tool_message_params(obj, variables, formatter)
    else:
        assert_never(obj.role)


def _from_message_param(
    obj: ChatCompletionMessageParam,
) -> PromptMessage:
    if obj["role"] == "user":
        return _from_user_message_param(obj)
    if obj["role"] == "system":
        return _from_system_message_param(obj)
    if obj["role"] == "developer":
        raise NotImplementedError
    if obj["role"] == "assistant":
        return _from_assistant_message_param(obj)
    if obj["role"] == "tool":
        return _from_tool_message_param(obj)
    if obj["role"] == "function":
        return _from_function_message_param(obj)
    assert_never(obj["role"])


def _to_user_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionUserMessageParam]:
    content = list(_to_content(obj.content, variables, formatter))
    yield _user_content_msg(content)


def _from_user_message_param(
    obj: ChatCompletionUserMessageParam,
) -> PromptMessage:
    return PromptMessage(role="USER", content=list(_from_content(obj["content"])))


def _to_system_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionSystemMessageParam]:
    content = list(_to_content(obj.content, variables, formatter, text_only=True))
    yield _system_content_msg(content)


def _from_system_message_param(
    obj: ChatCompletionSystemMessageParam,
) -> PromptMessage:
    return PromptMessage(role="SYSTEM", content=list(_from_content(obj["content"])))


def _to_assistant_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionAssistantMessageParam]:
    content: list[ContentArrayOfContentPart] = []
    tool_calls: list[ChatCompletionMessageToolCallParam] = []
    for part in obj.content:
        if isinstance(part, ToolCallContentPart):
            if content:
                yield _assistant_content_msg(content)
                content = []
            tool_calls.append(_to_tool_call(part))
            continue
        elif tool_calls:
            yield {"role": "assistant", "tool_calls": tool_calls}
            tool_calls = []
        if isinstance(part, TextContentPart):
            text = formatter.format(part.text.text, variables=variables)
            content.append({"type": "text", "text": text})
        elif isinstance(part, ToolResultContentPart):
            raise NotImplementedError
        elif isinstance(part, ImageContentPart):
            continue
        else:
            assert_never(part)
    if content:
        yield _assistant_content_msg(content)
    if tool_calls:
        yield {"role": "assistant", "tool_calls": tool_calls}


def _from_assistant_message_param(
    obj: ChatCompletionAssistantMessageParam,
) -> PromptMessage:
    content: list[_ContentPart] = []
    if "content" in obj:
        content.extend(_from_content(obj["content"]))
    if "tool_calls" in obj:
        content.extend(map(_from_tool_call, obj["tool_calls"]))
    return PromptMessage(role="AI", content=content)


def _to_tool_message_params(
    obj: PromptMessage,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> Iterator[ChatCompletionToolMessageParam]:
    current_tool_call_id: Optional[str] = None
    current_content: list[ChatCompletionContentPartTextParam] = []
    for part in obj.content:
        if isinstance(part, ToolResultContentPart):
            tool_call_id = part.tool_result.tool_call_id
            if (
                current_tool_call_id is not None
                and current_tool_call_id != tool_call_id
                and current_content
            ):
                yield _tool_content_msg(tool_call_id=current_tool_call_id, content=current_content)
                current_content = []
            current_tool_call_id = tool_call_id
            current_content.append(
                {"type": "text", "text": _str_tool_result(part.tool_result.result)}
            )
    if current_tool_call_id is not None and current_content:
        yield _tool_content_msg(tool_call_id=current_tool_call_id, content=current_content)


def _str_tool_result(
    obj: Any,
) -> str:
    if isinstance(obj, (dict, list)):
        return json.dumps(obj)
    return str(obj)


def _from_tool_message_param(
    obj: ChatCompletionToolMessageParam,
) -> PromptMessage:
    if isinstance(obj["content"], str):
        return PromptMessage(
            role="TOOL",
            content=[
                ToolResultContentPart(
                    type="tool_result",
                    tool_result=ToolResultContentValue(
                        tool_call_id=obj["tool_call_id"],
                        result=obj["content"],
                    ),
                )
            ],
        )
    content: list[_ContentPart] = []
    for part in obj["content"]:
        if part["type"] == "text":
            content.append(
                ToolResultContentPart(
                    type="tool_result",
                    tool_result=ToolResultContentValue(
                        tool_call_id=obj["tool_call_id"],
                        result=part["text"],
                    ),
                )
            )
        else:
            assert_never(part["type"])
    return PromptMessage(role="TOOL", content=content)


def _from_function_message_param(
    obj: ChatCompletionFunctionMessageParam,
) -> PromptMessage:
    return PromptMessage(role="TOOL", content=list(_from_content(obj["content"])))


def _to_tool_call(
    obj: ToolCallContentPart,
) -> ChatCompletionMessageToolCallParam:
    return {
        "id": obj.tool_call.tool_call_id,
        "function": {
            "name": obj.tool_call.tool_call.name,
            "arguments": obj.tool_call.tool_call.arguments,
        },
        "type": "function",
    }


def _from_tool_call(
    obj: ChatCompletionMessageToolCallParam,
) -> ToolCallContentPart:
    return ToolCallContentPart(
        type="tool_call",
        tool_call=ToolCallContentValue(
            tool_call_id=obj["id"],
            tool_call=ToolCallFunction(
                type="function",
                name=obj["function"]["name"],
                arguments=obj["function"]["arguments"],
            ),
        ),
    )


def _to_role(
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


def _from_role(
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


@overload
def _to_content(
    obj: Iterable[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: Literal[True] = True,
) -> Iterator[ChatCompletionContentPartTextParam]: ...


@overload
def _to_content(
    obj: Iterable[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: bool,
) -> Iterator[ChatCompletionContentPartParam]: ...


def _to_content(
    obj: Iterable[_ContentPart],
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
    *,
    text_only: bool = False,
) -> Iterator[Any]:
    for part in obj:
        if isinstance(part, TextContentPart):
            text = formatter.format(part.text.text, variables=variables)
            yield {"type": "text", "text": text}
        elif text_only:
            continue
        elif isinstance(part, ImageContentPart):
            yield {
                "type": "image_url",
                "image_url": {
                    "url": part.image.url,
                },
            }
        elif isinstance(part, ToolCallContentPart):
            continue
        elif isinstance(part, ToolResultContentPart):
            raise NotImplementedError
        else:
            assert_never(part)


def _from_content(
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
) -> Iterator[_ContentPart]:
    if isinstance(obj, str):
        yield TextContentPart(type="text", text=TextContentValue(text=obj))
        return
    for part in obj or ():
        if part["type"] == "text":
            yield _from_text_param(part)
        elif part["type"] == "image_url":
            yield _from_image_param(part)
        elif part["type"] == "input_audio":
            raise NotImplementedError
        elif part["type"] == "refusal":
            raise NotImplementedError
        else:
            assert_never(part["type"])


def _to_text_param(
    obj: TextContentPart,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> ChatCompletionContentPartTextParam:
    return {"type": "text", "text": formatter.format(obj.text.text, variables=variables)}


def _from_text_param(
    obj: ChatCompletionContentPartTextParam,
) -> TextContentPart:
    return TextContentPart(type="text", text=TextContentValue(text=obj["text"]))


def _to_image_param(
    obj: ImageContentPart,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: TemplateFormatter = MUSTACHE_TEMPLATE_FORMATTER,
    /,
) -> ChatCompletionContentPartImageParam:
    return {"type": "image_url", "image_url": {"url": obj.image.url}}


def _from_image_param(
    obj: ChatCompletionContentPartImageParam,
) -> ImageContentPart:
    return ImageContentPart(type="image", image=ImageContentValue(url=obj["image_url"]["url"]))


def _user_content_msg(
    content: Sequence[ChatCompletionContentPartParam],
) -> ChatCompletionUserMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {"role": "user", "content": content[0]["text"]}
    return {"role": "user", "content": content}


def _assistant_content_msg(
    content: Sequence[ContentArrayOfContentPart],
) -> ChatCompletionAssistantMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {"role": "assistant", "content": content[0]["text"]}
    return {"role": "assistant", "content": content}


def _system_content_msg(
    content: Sequence[ChatCompletionContentPartTextParam],
) -> ChatCompletionSystemMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {"role": "system", "content": content[0]["text"]}
    return {"role": "system", "content": content}


def _tool_content_msg(
    tool_call_id: str,
    content: Sequence[ChatCompletionContentPartTextParam],
) -> ChatCompletionToolMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {"role": "tool", "tool_call_id": tool_call_id, "content": content[0]["text"]}
    return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


if TYPE_CHECKING:
    from openai import OpenAI
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
        ChatCompletionToolChoiceOptionParam,
        ChatCompletionToolMessageParam,
        ChatCompletionToolParam,
        ChatCompletionUserMessageParam,
    )
    from openai.types.chat.chat_completion_assistant_message_param import ContentArrayOfContentPart
    from openai.types.chat.completion_create_params import (
        CompletionCreateParamsBase,
        ResponseFormat,
    )
    from openai.types.shared_params import FunctionDefinition

    _ContentPart: TypeAlias = Union[
        ImageContentPart,
        TextContentPart,
        ToolCallContentPart,
        ToolResultContentPart,
    ]

    class _ModelKwargs(TypedDict, total=False):
        model: Required[str]
        response_format: ResponseFormat
        tool_choice: ChatCompletionToolChoiceOptionParam
        tools: list[ChatCompletionToolParam]
        parallel_tool_calls: bool
        frequency_penalty: float
        max_tokens: int
        presence_penalty: float
        seed: int
        stop: list[str]
        temperature: float
        top_p: float

    def _(obj: PromptVersion) -> None:
        messages, kwargs = to_chat_messages_and_kwargs(obj)
        CompletionCreateParamsBase(messages=messages, **kwargs)
        OpenAI().chat.completions.create(messages=messages, **kwargs)
