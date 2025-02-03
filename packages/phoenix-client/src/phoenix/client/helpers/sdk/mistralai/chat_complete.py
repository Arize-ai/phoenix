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
    from mistralai.models import (
        AssistantMessageTypedDict,
        ChatCompletionRequestToolChoiceTypedDict,
        ContentChunkTypedDict,
        FunctionTypedDict,
        ImageURLChunkTypedDict,
        MessagesTypedDict,
        ReferenceChunkTypedDict,
        ResponseFormatTypedDict,
        StopTypedDict,
        SystemMessageTypedDict,
        TextChunkTypedDict,
        ToolCallTypedDict,
        ToolMessageTypedDict,
        ToolTypedDict,
        UserMessageTypedDict,
    )
    from mistralai.sdk import Mistral

    class _ModelKwargs(TypedDict, total=False):
        model: Required[str]
        temperature: float
        top_p: float
        max_tokens: int
        stream: bool
        stop: StopTypedDict
        random_seed: int
        response_format: ResponseFormatTypedDict
        tools: list[ToolTypedDict]
        tool_choice: ChatCompletionRequestToolChoiceTypedDict
        safe_prompt: bool

    def _(obj: PromptVersion) -> None:
        messages, kwargs = to_chat_messages_and_kwargs(obj)
        Mistral().chat.complete(messages=messages, **kwargs)  # pyright: ignore[reportUnknownMemberType]


_ContentPart: TypeAlias = Union[
    TextContentPart,
    ImageContentPart,
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
) -> tuple[list[MessagesTypedDict], _ModelKwargs]:
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
    if "tools" in obj and obj["tools"] and (tools := list(_to_tools(obj["tools"]))):
        ans["tools"] = tools
    return ans


def _to_chat_completion_messages(
    obj: PromptVersion,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
    /,
) -> Iterator[MessagesTypedDict]:
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
) -> Iterable[ToolTypedDict]:
    for tool in obj["tools"]:
        function: FunctionTypedDict = {
            "name": tool["name"],
            "parameters": {},
        }
        if "description" in tool:
            function["description"] = tool["description"]
        if "schema" in tool and tool["schema"]:
            function["parameters"] = dict(tool["schema"])
        yield {"type": "function", "function": function}


def _from_tools(
    tools: Iterable[ToolTypedDict],
) -> PromptToolsV1:
    functions: list[PromptFunctionToolV1] = []
    for tool in tools:
        if "function" not in tool:
            continue
        definition: FunctionTypedDict = tool["function"]
        name = definition["name"]
        function = PromptFunctionToolV1(
            type="function-tool-v1",
            name=name,
            schema=definition["parameters"],
        )
        if "description" in definition:
            function["description"] = definition["description"]
        functions.append(function)
    return PromptToolsV1(type="tools-v1", tools=functions)


def _to_messages(
    obj: PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> Iterator[MessagesTypedDict]:
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
    obj: MessagesTypedDict,
) -> PromptMessage:
    if "role" not in obj:
        raise ValueError("role is unknown")
    if obj["role"] == "user":
        return _from_user_message(obj)
    if obj["role"] == "system":
        return _from_system_message(obj)
    if obj["role"] == "assistant":
        return _from_assistant_message(obj)
    if obj["role"] == "tool":
        return _from_tool_message(obj)
    assert_never(obj["role"])


def _to_user_messages(
    obj: PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> Iterator[UserMessageTypedDict]:
    content = list(_to_content(obj["content"], variables, formatter))
    yield _user_msg(content)


def _from_user_message(
    obj: UserMessageTypedDict,
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
) -> Iterator[SystemMessageTypedDict]:
    content = list(_to_content(obj["content"], variables, formatter, text_only=True))
    yield _system_msg(content)


def _from_system_message(
    obj: SystemMessageTypedDict,
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
) -> Iterator[AssistantMessageTypedDict]:
    content: list[ContentChunkTypedDict] = []
    tool_calls: list[ToolCallTypedDict] = []
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
    obj: AssistantMessageTypedDict,
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
) -> Iterator[ToolMessageTypedDict]:
    current_tool_call_id: Optional[str] = None
    current_content: list[ContentChunkTypedDict] = []
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
    obj: ToolMessageTypedDict,
    /,
    *,
    role: Literal["TOOL"] = "TOOL",
) -> PromptMessage:
    id_ = obj["tool_call_id"] if "tool_call_id" in obj else ""
    if isinstance(obj["content"], str):
        tool_result = ToolResultContentValue(
            tool_call_id="",
            result=obj["content"],
        )
        if id_:
            tool_result["tool_call_id"] = id_
        return PromptMessage(
            role="TOOL",
            content=[
                ToolResultContentPart(
                    type="tool_result",
                    tool_result=tool_result,
                )
            ],
        )
    content: list[_ContentPart] = []
    for part in obj["content"] or ():
        if "type" in part and part["type"] == "text" or "text" in part:
            tool_result = ToolResultContentValue(
                result=part["text"],  # type: ignore[typeddict-item]
            )
            if id_:
                tool_result["tool_call_id"] = id_
            content.append(
                ToolResultContentPart(
                    type="tool_result",
                    tool_result=tool_result,
                )
            )
        elif "type" in part and part["type"] == "image_url" or "image_url" in part:
            continue
        elif "type" in part and part["type"] == "reference" or "reference_ids" in part:
            continue
        elif TYPE_CHECKING:
            assert_never(part)
    return PromptMessage(role=role, content=content)


def _to_tool_call(
    obj: ToolCallContentPart,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> ToolCallTypedDict:
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
    obj: ToolCallTypedDict,
) -> ToolCallContentPart:
    arguments = obj["function"]["arguments"]
    if isinstance(arguments, Mapping):
        arguments = json.dumps(arguments)
    assert isinstance(arguments, str)
    name = obj["function"]["name"]
    return ToolCallContentPart(
        type="tool_call",
        tool_call=ToolCallContentValue(
            tool_call_id=obj["id"] if "id" in obj else "",
            tool_call=ToolCallFunction(
                type="function",
                name=name,
                arguments=arguments,
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
) -> Iterator[TextChunkTypedDict]: ...


@overload
def _to_content(
    parts: Iterable[_ContentPart],
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
    *,
    text_only: bool,
) -> Iterator[ContentChunkTypedDict]: ...


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
                TextChunkTypedDict,
                ImageURLChunkTypedDict,
                ReferenceChunkTypedDict,
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
        if "type" not in part:
            if "text" in part:
                yield _from_text(part)  # type: ignore[arg-type]
            elif "image_url" in part:
                yield _from_image(part)  # type: ignore[arg-type]
            elif "reference_ids" in part:
                continue
            elif TYPE_CHECKING:
                assert_never(part)
        elif part["type"] == "text":
            yield _from_text(part)
        elif part["type"] == "image_url":
            yield _from_image(part)
        elif part["type"] == "reference":
            continue
        elif TYPE_CHECKING:
            assert_never(part)


def _to_text(
    obj: TextContentPart,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> TextChunkTypedDict:
    text = formatter.format(obj["text"]["text"], variables=variables)
    return {"type": "text", "text": text}


def _from_text(
    obj: TextChunkTypedDict,
) -> TextContentPart:
    text = TextContentValue(text=obj["text"])
    return TextContentPart(
        type="text",
        text=text,
    )


def _to_image(
    obj: ImageContentPart,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
    /,
) -> ImageURLChunkTypedDict:
    return {
        "type": "image_url",
        "image_url": {
            "url": obj["image"]["url"],
        },
    }


def _from_image(
    obj: ImageURLChunkTypedDict,
) -> ImageContentPart:
    url = obj["image_url"]["url"] if isinstance(obj["image_url"], dict) else obj["image_url"]
    image = ImageContentValue(url=url)
    return ImageContentPart(
        type="image",
        image=image,
    )


def _user_msg(
    content: Sequence[ContentChunkTypedDict],
) -> UserMessageTypedDict:
    if len(content) == 1 and (
        "type" in content[0] and content[0]["type"] == "text" or "text" in content[0]
    ):
        return {
            "role": "user",
            "content": content[0]["text"],  # type: ignore[typeddict-item]
        }
    return {
        "role": "user",
        "content": list(content),
    }


def _assistant_msg(
    content: Sequence[ContentChunkTypedDict],
) -> AssistantMessageTypedDict:
    if len(content) == 1 and (
        "type" in content[0] and content[0]["type"] == "text" or "text" in content[0]
    ):
        return {
            "role": "assistant",
            "content": content[0]["text"],  # type: ignore[typeddict-item]
        }
    return {
        "role": "assistant",
        "content": list(content),
    }


def _system_msg(
    content: Sequence[TextChunkTypedDict],
) -> SystemMessageTypedDict:
    if len(content) == 1:
        return {
            "role": "system",
            "content": content[0]["text"],
        }
    return {
        "role": "system",
        "content": list(content),
    }


def _tool_msg(
    tool_call_id: str,
    content: Sequence[ContentChunkTypedDict],
) -> ToolMessageTypedDict:
    if len(content) == 1 and (
        "type" in content[0] and content[0]["type"] == "text" or "text" in content[0]
    ):
        return {
            "role": "tool",
            "tool_call_id": tool_call_id,
            "content": content[0]["text"],  # type: ignore[typeddict-item]
        }
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": list(content),
    }


def _to_role(
    obj: PromptMessage,
) -> Literal["user", "system", "assistant", "tool"]:
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
    obj: MessagesTypedDict,
) -> Literal["USER", "AI", "TOOL", "SYSTEM"]:
    if "role" not in obj:
        raise ValueError("role is unknown")
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
