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
    Sequence,
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
    from groq._client import Groq
    from groq.types.chat import (
        ChatCompletionAssistantMessageParam,
        ChatCompletionContentPartImageParam,
        ChatCompletionContentPartParam,
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
    from groq.types.chat.completion_create_params import (
        ResponseFormat,
    )
    from groq.types.shared_params import FunctionDefinition

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
        Groq().chat.completions.create(messages=messages, **kwargs)


_ContentPart: TypeAlias = Union[
    ImageContentPart,
    TextContentPart,
    ToolCallContentPart,
    ToolResultContentPart,
]

__all__ = [
    "to_chat_messages_and_kwargs",
]

logger = logging.getLogger(__name__)


def to_chat_messages_and_kwargs(
    obj: PromptVersion,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
    **_: Any,
) -> tuple[list[ChatCompletionMessageParam], _ModelKwargs]:
    return (
        list(_to_chat_completion_messages(obj, variables, formatter)),
        _to_model_kwargs(obj),
    )


def _to_model_kwargs(
    obj: PromptVersion,
) -> _ModelKwargs:
    ans: _ModelKwargs = {
        "model": obj["model_name"],
    }
    parameters: Mapping[str, Any] = (
        obj["invocation_parameters"] if "invocation_parameters" in obj else {}
    )
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
    if "tools" in obj and obj["tools"] and (tools := list(_to_tools(obj["tools"]))):
        ans["tools"] = tools
    return ans


def _to_chat_completion_messages(
    obj: PromptVersion,
    variables: Mapping[str, str],
    formatter: Optional[TemplateFormatter] = None,
    /,
) -> Iterator[ChatCompletionMessageParam]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    if template["version"] == "chat-template-v1":
        for message in template["messages"]:
            yield from _to_messages(message, variables, formatter)
    elif template["version"] == "string-template-v1":
        content = formatter.format(template["template"], variables=variables)
        yield {"role": "user", "content": content}
    elif TYPE_CHECKING:
        assert_never(template)


def _to_tools(
    obj: PromptToolsV1,
) -> Iterable[ChatCompletionToolParam]:
    for tool in obj["tools"]:
        function: FunctionDefinition = {"name": tool["name"]}
        if "description" in tool:
            function["description"] = tool["description"]
        if "schema" in tool and tool["schema"]:
            function["parameters"] = dict(tool["schema"])
        yield {"type": "function", "function": function}


def _from_tools(
    tools: Iterable[ChatCompletionToolParam],
) -> PromptToolsV1:
    functions: list[PromptFunctionToolV1] = []
    for tool in tools:
        if tool["type"] != "function":
            continue
        definition: FunctionDefinition = tool["function"]
        name = definition["name"]
        function = PromptFunctionToolV1(type="function-tool-v1", name=name)
        if "description" in definition:
            function["description"] = definition["description"]
        if "parameters" in definition:
            function["schema"] = definition["parameters"]
        functions.append(function)
    return PromptToolsV1(type="tools-v1", tools=functions)


def _to_messages(
    obj: PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> Iterator[ChatCompletionMessageParam]:
    if obj["role"] == "USER":
        yield from _to_user_messages(obj, variables, formatter)
    elif obj["role"] == "SYSTEM":
        yield from _to_system_messages(obj, variables, formatter)
    elif obj["role"] == "AI":
        yield from _to_assistant_messages(obj, variables, formatter)
    elif obj["role"] == "TOOL":
        yield from _to_tool_messages(obj, variables, formatter)
    elif TYPE_CHECKING:
        assert_never(obj["role"])
    else:
        content = list(_to_content(obj["content"], variables, formatter))
        yield {"role": obj["role"], "content": content}


def _from_message(
    obj: ChatCompletionMessageParam,
) -> PromptMessage:
    if obj["role"] == "user":
        return _from_user_message(obj)
    if obj["role"] == "system":
        return _from_system_message(obj)
    if obj["role"] == "assistant":
        return _from_assistant_message(obj)
    if obj["role"] == "tool":
        return _from_tool_message(obj)
    if obj["role"] == "function":
        return _from_function_message(obj)
    if TYPE_CHECKING:
        assert_never(obj["role"])
    content = list(_from_content(obj["content"]))
    return PromptMessage(role=obj["role"], content=content)


def _to_user_messages(
    obj: PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> Iterator[ChatCompletionUserMessageParam]:
    content = list(_to_content(obj["content"], variables, formatter))
    yield _user_msg(content)


def _from_user_message(
    obj: ChatCompletionUserMessageParam,
    /,
    *,
    role: Literal["USER"] = "USER",
) -> PromptMessage:
    content = list(_from_content(obj["content"]))
    return PromptMessage(role=role, content=content)


def _to_system_messages(
    obj: PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> Iterator[ChatCompletionSystemMessageParam]:
    content = list(_to_content(obj["content"], variables, formatter, text_only=True))
    yield _system_msg(content)


def _from_system_message(
    obj: ChatCompletionSystemMessageParam,
    /,
    *,
    role: Literal["SYSTEM"] = "SYSTEM",
) -> PromptMessage:
    content = list(_from_content(obj["content"]))
    return PromptMessage(role=role, content=content)


def _to_assistant_messages(
    obj: PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> Iterator[ChatCompletionAssistantMessageParam]:
    content: list[ChatCompletionContentPartTextParam] = []
    tool_calls: list[ChatCompletionMessageToolCallParam] = []
    for part in obj["content"]:
        if part["type"] == "tool_call":
            if content:
                yield _assistant_msg(content)
                content.clear()
            tool_calls.append(_to_tool_call(part, variables, formatter))
            continue
        elif tool_calls:
            yield {"role": "assistant", "tool_calls": tool_calls}
            tool_calls.clear()
        if part["type"] == "text":
            content.append(_to_text(part, variables, formatter))
        elif part["type"] == "tool_result":
            continue
        elif part["type"] == "image":
            continue
        elif TYPE_CHECKING:
            assert_never(part)
    if content:
        yield _assistant_msg(content)
    if tool_calls:
        yield {"role": "assistant", "tool_calls": tool_calls}


def _from_assistant_message(
    obj: ChatCompletionAssistantMessageParam,
    /,
    *,
    role: Literal["AI"] = "AI",
) -> PromptMessage:
    content: list[_ContentPart] = []
    if "content" in obj:
        content.extend(_from_content(obj["content"]))
    if "tool_calls" in obj and (tool_calls := obj["tool_calls"]):
        content.extend(map(_from_tool_call, tool_calls))
    return PromptMessage(role=role, content=content)


def _to_tool_messages(
    obj: PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> Iterator[ChatCompletionToolMessageParam]:
    current_tool_call_id: Optional[str] = None
    current_content: list[ChatCompletionContentPartTextParam] = []
    for part in obj["content"]:
        if part["type"] == "tool_result":
            tool_result = part["tool_result"]
            tool_call_id = tool_result["tool_call_id"] if "tool_call_id" in tool_result else ""
            if (
                current_tool_call_id is not None
                and current_tool_call_id != tool_call_id
                and current_content
            ):
                yield _tool_msg(tool_call_id=current_tool_call_id, content=current_content)
                current_content = []
            current_tool_call_id = tool_call_id
            if "result" in tool_result:
                current_content.append(
                    {
                        "type": "text",
                        "text": _str_tool_result(part["tool_result"]["result"]),
                    }
                )
        elif part["type"] == "text":
            continue
        elif part["type"] == "image":
            continue
        elif part["type"] == "tool_call":
            continue
        elif TYPE_CHECKING:
            assert_never(part)
    if current_tool_call_id is not None and current_content:
        yield _tool_msg(tool_call_id=current_tool_call_id, content=current_content)


def _str_tool_result(
    obj: Any,
) -> str:
    if isinstance(obj, (dict, list)):
        return json.dumps(obj)
    return str(obj)


def _from_tool_message(
    obj: ChatCompletionToolMessageParam,
    /,
    *,
    role: Literal["TOOL"] = "TOOL",
) -> PromptMessage:
    content = [
        ToolResultContentPart(
            type="tool_result",
            tool_result=ToolResultContentValue(
                tool_call_id=obj["tool_call_id"],
                result=obj["content"],
            ),
        )
    ]
    return PromptMessage(role=role, content=content)


def _from_function_message(
    obj: ChatCompletionFunctionMessageParam,
    /,
    *,
    role: Literal["TOOL"] = "TOOL",
) -> PromptMessage:
    content = list(_from_content(obj["content"]))
    return PromptMessage(role=role, content=content)


def _to_tool_call(
    obj: ToolCallContentPart,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> ChatCompletionMessageToolCallParam:
    id_ = obj["tool_call"]["tool_call_id"] if "tool_call_id" in obj["tool_call"] else ""
    tool_call = obj["tool_call"]["tool_call"]
    name = tool_call["name"]
    arguments = tool_call["arguments"] if "arguments" in tool_call else "{}"
    return {
        "id": id_,
        "function": {
            "name": name,
            "arguments": arguments,
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


@overload
def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
    *,
    text_only: Literal[True] = True,
) -> Iterator[ChatCompletionContentPartTextParam]: ...


@overload
def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
    *,
    text_only: bool,
) -> Iterator[ChatCompletionContentPartParam]: ...


def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
    *,
    text_only: bool = False,
) -> Iterator[Any]:
    for part in parts:
        if part["type"] == "text":
            yield _to_text(part, variables, formatter)
        elif text_only:
            continue
        elif part["type"] == "image":
            yield _to_image(part, variables, formatter)
        elif part["type"] == "tool_call":
            continue
        elif part["type"] == "tool_result":
            continue
        elif TYPE_CHECKING:
            assert_never(part)


def _from_content(
    obj: Union[
        str,
        Iterable[
            Union[
                ChatCompletionContentPartTextParam,
                ChatCompletionContentPartImageParam,
            ]
        ],
        None,
    ],
) -> Iterator[_ContentPart]:
    if isinstance(obj, str):
        text = TextContentValue(text=obj)
        yield TextContentPart(type="text", text=text)
        return
    for part in obj or ():
        if part["type"] == "text":
            yield _from_text(part)
        elif part["type"] == "image_url":
            yield _from_image(part)
        elif part["type"] == "input_audio":
            continue
        elif part["type"] == "refusal":
            continue
        elif TYPE_CHECKING:
            assert_never(part["type"])


def _to_text(
    obj: TextContentPart,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> ChatCompletionContentPartTextParam:
    text = formatter.format(obj["text"]["text"], variables=variables)
    return {
        "type": "text",
        "text": text,
    }


def _from_text(
    obj: ChatCompletionContentPartTextParam,
) -> TextContentPart:
    text = TextContentValue(text=obj["text"])
    return TextContentPart(type="text", text=text)


def _to_image(
    obj: ImageContentPart,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> ChatCompletionContentPartImageParam:
    return {
        "type": "image_url",
        "image_url": {
            "url": obj["image"]["url"],
        },
    }


def _from_image(
    obj: ChatCompletionContentPartImageParam,
) -> ImageContentPart:
    image = ImageContentValue(url=obj["image_url"]["url"])
    return ImageContentPart(
        type="image",
        image=image,
    )


def _user_msg(
    content: Sequence[ChatCompletionContentPartParam],
) -> ChatCompletionUserMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {
            "role": "user",
            "content": content[0]["text"],
        }
    return {
        "role": "user",
        "content": content,
    }


def _assistant_msg(
    content: Sequence[ChatCompletionContentPartTextParam],
) -> ChatCompletionAssistantMessageParam:
    return {
        "role": "assistant",
        "content": _SEP.join(part["text"] for part in content),
    }


def _system_msg(
    content: Sequence[ChatCompletionContentPartTextParam],
) -> ChatCompletionSystemMessageParam:
    return {
        "role": "system",
        "content": _SEP.join(part["text"] for part in content),
    }


def _tool_msg(
    tool_call_id: str,
    content: Sequence[ChatCompletionContentPartTextParam],
) -> ChatCompletionToolMessageParam:
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": _SEP.join(part["text"] for part in content),
    }


def _to_role(
    obj: PromptMessage,
) -> ChatCompletionRole:
    role = obj["role"]
    if role == "USER":
        return "user"
    if role == "AI":
        return "assistant"
    if role == "SYSTEM":
        return "system"
    if role == "TOOL":
        return "tool"
    if TYPE_CHECKING:
        assert_never(role)
    return role


def _from_role(
    obj: ChatCompletionMessageParam,
) -> Literal["USER", "AI", "TOOL", "SYSTEM"]:
    if obj["role"] == "user":
        return "USER"
    if obj["role"] == "system":
        return "SYSTEM"
    if obj["role"] == "assistant":
        return "AI"
    if obj["role"] == "tool":
        return "TOOL"
    if obj["role"] == "function":
        return "TOOL"
    if TYPE_CHECKING:
        assert_never(obj["role"])
    return obj["role"]


_SEP = "\n\n"
