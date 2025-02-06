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
    JSONSchemaDraft7ObjectSchema,
    PromptFunctionToolV1,
    PromptMessage,
    PromptToolChoiceNone,
    PromptToolChoiceOneOrMore,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolChoiceZeroOrMore,
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
    from openai._client import OpenAI
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
        ChatCompletionNamedToolChoiceParam,
        ChatCompletionReasoningEffort,
        ChatCompletionRole,
        ChatCompletionSystemMessageParam,
        ChatCompletionToolChoiceOptionParam,
        ChatCompletionToolMessageParam,
        ChatCompletionToolParam,
        ChatCompletionUserMessageParam,
    )
    from openai.types.chat.chat_completion_assistant_message_param import ContentArrayOfContentPart
    from openai.types.chat.chat_completion_named_tool_choice_param import Function
    from openai.types.chat.completion_create_params import (
        ResponseFormat,
    )
    from openai.types.shared_params import FunctionDefinition

    def _(obj: PromptVersion) -> None:
        messages, kwargs = to_chat_messages_and_kwargs(obj)
        OpenAI().chat.completions.create(messages=messages, **kwargs)


class _ToolKwargs(TypedDict, total=False):
    parallel_tool_calls: bool
    tool_choice: ChatCompletionToolChoiceOptionParam
    tools: list[ChatCompletionToolParam]


class _ModelKwargs(_ToolKwargs, TypedDict, total=False):
    model: Required[str]
    frequency_penalty: float
    max_tokens: int
    presence_penalty: float
    reasoning_effort: ChatCompletionReasoningEffort
    response_format: ResponseFormat
    seed: int
    stop: list[str]
    temperature: float
    top_p: float


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
    if (v := parameters.get("reasoning_effort")) is not None:
        if v in ("low", "medium", "high"):
            ans["reasoning_effort"] = v
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


def _to_tool_kwargs(
    obj: Optional[PromptToolsV1],
) -> _ToolKwargs:
    ans: _ToolKwargs = {}
    if not obj or not (tools := list(_to_tools(obj))):
        return ans
    ans["tools"] = tools
    if "tool_choice" in obj:
        tool_choice: ChatCompletionToolChoiceOptionParam = _to_tool_choice(obj["tool_choice"])
        ans["tool_choice"] = tool_choice
    if "disable_parallel_tool_calls" in obj:
        v: bool = obj["disable_parallel_tool_calls"]
        ans["parallel_tool_calls"] = not v
    return ans


def _from_tool_kwargs(
    obj: _ToolKwargs,
) -> Optional[PromptToolsV1]:
    if not obj or "tools" not in obj:
        return None
    ans: PromptToolsV1 = _from_tools(obj["tools"])
    if not ans["tools"]:
        return None
    if "tool_choice" in obj:
        tc: ChatCompletionToolChoiceOptionParam = obj["tool_choice"]
        ans["tool_choice"] = _from_tool_choice(tc)
    if "parallel_tool_calls" in obj:
        v: bool = obj["parallel_tool_calls"]
        ans["disable_parallel_tool_calls"] = not v
    return ans


def _to_tool_choice(
    obj: Union[
        PromptToolChoiceNone,
        PromptToolChoiceZeroOrMore,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
    ],
) -> ChatCompletionToolChoiceOptionParam:
    if obj["type"] == "none":
        return "none"
    if obj["type"] == "zero-or-more":
        return "auto"
    if obj["type"] == "one-or-more":
        return "required"
    if obj["type"] == "specific-function-tool":
        choice_tool: ChatCompletionNamedToolChoiceParam = {
            "type": "function",
            "function": {"name": obj["function_name"]},
        }
        return choice_tool
    assert_never(obj["type"])


def _from_tool_choice(
    obj: ChatCompletionToolChoiceOptionParam,
) -> Union[
    PromptToolChoiceNone,
    PromptToolChoiceZeroOrMore,
    PromptToolChoiceOneOrMore,
    PromptToolChoiceSpecificFunctionTool,
]:
    if obj == "none":
        choice_none: PromptToolChoiceNone = {"type": "none"}
        return choice_none
    if obj == "auto":
        choice_zero_or_more: PromptToolChoiceZeroOrMore = {"type": "zero-or-more"}
        return choice_zero_or_more
    if obj == "required":
        choice_one_or_more: PromptToolChoiceOneOrMore = {"type": "one-or-more"}
        return choice_one_or_more
    if obj["type"] == "function":
        function: Function = obj["function"]
        choice_function_tool: PromptToolChoiceSpecificFunctionTool = {
            "type": "specific-function-tool",
            "function_name": function["name"],
        }
        return choice_function_tool
    assert_never(obj["type"])


def _to_tools(
    obj: PromptToolsV1,
) -> Iterable[ChatCompletionToolParam]:
    for tool in obj["tools"]:
        function: FunctionDefinition = {"name": tool["name"]}
        if "description" in tool:
            function["description"] = tool["description"]
        if "schema" in tool:
            function["parameters"] = dict(tool["schema"]["json"])
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
            function["schema"] = JSONSchemaDraft7ObjectSchema(
                type="json-schema-draft-7-object-schema",
                json=definition["parameters"],
            )
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
    if obj["role"] == "developer":
        raise NotImplementedError
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
    content: list[ContentArrayOfContentPart] = []
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
            text = formatter.format(part["text"]["text"], variables=variables)
            content.append({"type": "text", "text": text})
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
        elif TYPE_CHECKING:
            assert_never(part)
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
            raise NotImplementedError
        elif TYPE_CHECKING:
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
    content: Sequence[ContentArrayOfContentPart],
) -> ChatCompletionAssistantMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {
            "role": "assistant",
            "content": content[0]["text"],
        }
    return {
        "role": "assistant",
        "content": content,
    }


def _system_msg(
    content: Sequence[ChatCompletionContentPartTextParam],
) -> ChatCompletionSystemMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {
            "role": "system",
            "content": content[0]["text"],
        }
    return {
        "role": "system",
        "content": content,
    }


def _tool_msg(
    tool_call_id: str,
    content: Sequence[ChatCompletionContentPartTextParam],
) -> ChatCompletionToolMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {
            "role": "tool",
            "tool_call_id": tool_call_id,
            "content": content[0]["text"],
        }
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": content,
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
    if obj["role"] == "developer":
        raise NotImplementedError
    if obj["role"] == "assistant":
        return "AI"
    if obj["role"] == "tool":
        return "TOOL"
    if obj["role"] == "function":
        return "TOOL"
    if TYPE_CHECKING:
        assert_never(obj["role"])
    return obj["role"]
