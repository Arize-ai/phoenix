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

from phoenix.client.__generated__ import v1
from phoenix.client.utils.template_formatters import TemplateFormatter, to_formatter

if TYPE_CHECKING:
    from openai._client import OpenAI
    from openai.types.chat import (
        ChatCompletionAssistantMessageParam,
        ChatCompletionContentPartImageParam,
        ChatCompletionContentPartInputAudioParam,
        ChatCompletionContentPartParam,
        ChatCompletionContentPartRefusalParam,
        ChatCompletionContentPartTextParam,
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
    from openai.types.chat.completion_create_params import ResponseFormat
    from openai.types.shared_params import FunctionDefinition, ResponseFormatJSONSchema
    from openai.types.shared_params.response_format_json_schema import JSONSchema

    def _(obj: v1.PromptVersion) -> None:
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
    v1.ImageContentPart,
    v1.TextContentPart,
    v1.ToolCallContentPart,
    v1.ToolResultContentPart,
]

__all__ = [
    "to_chat_messages_and_kwargs",
]

logger = logging.getLogger(__name__)


def to_chat_messages_and_kwargs(
    obj: v1.PromptVersion,
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
    obj: v1.PromptVersion,
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
    if "tools" in obj:
        tool_kwargs = _ToolKwargsConversion.to_openai(obj["tools"])
        if "tools" in tool_kwargs:
            ans["tools"] = tool_kwargs["tools"]
            if "tool_choice" in tool_kwargs:
                ans["tool_choice"] = tool_kwargs["tool_choice"]
    if "response_format" in obj:
        response_format = obj["response_format"]
        if response_format["type"] == "response-format-json-schema":
            ans["response_format"] = _ResponseFormatJSONSchemaConversion.to_openai(response_format)
        elif TYPE_CHECKING:
            assert_never(response_format)
    return ans


def _to_chat_completion_messages(
    obj: v1.PromptVersion,
    variables: Mapping[str, str],
    formatter: Optional[TemplateFormatter] = None,
    /,
) -> Iterator[ChatCompletionMessageParam]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    if template["type"] == "chat":
        for message in template["messages"]:
            yield from _MessageConversion.to_openai(message, variables, formatter)
    elif template["type"] == "string":
        content = formatter.format(template["template"], variables=variables)
        yield {"role": "user", "content": content}
    elif TYPE_CHECKING:
        assert_never(template)


class _ToolKwargsConversion:
    @staticmethod
    def to_openai(
        obj: Optional[v1.PromptTools],
    ) -> _ToolKwargs:
        ans: _ToolKwargs = {}
        if not obj:
            return ans
        tools: list[ChatCompletionToolParam] = []
        for ft in obj["tools"]:
            if ft["type"] == "function-tool":
                tools.append(_FunctionToolConversion.to_openai(ft))
        if not tools:
            return ans
        ans["tools"] = tools
        if "tool_choice" in obj:
            tool_choice: ChatCompletionToolChoiceOptionParam = _to_tool_choice(obj["tool_choice"])
            ans["tool_choice"] = tool_choice
        if "disable_parallel_tool_calls" in obj:
            v: bool = obj["disable_parallel_tool_calls"]
            ans["parallel_tool_calls"] = not v
        return ans

    @staticmethod
    def from_openai(
        obj: _ToolKwargs,
    ) -> Optional[v1.PromptTools]:
        if not obj or "tools" not in obj:
            return None
        tools: list[v1.PromptFunctionTool] = []
        for tp in obj["tools"]:
            if tp["type"] == "function":
                tools.append(_FunctionToolConversion.from_openai(tp))
        if not tools:
            return None
        ans = v1.PromptTools(type="tools", tools=tools)
        if "tool_choice" in obj:
            tc: ChatCompletionToolChoiceOptionParam = obj["tool_choice"]
            ans["tool_choice"] = _from_tool_choice(tc)
        if "parallel_tool_calls" in obj:
            v: bool = obj["parallel_tool_calls"]
            ans["disable_parallel_tool_calls"] = not v
        return ans


def _to_tool_choice(
    obj: Union[
        v1.PromptToolChoiceNone,
        v1.PromptToolChoiceZeroOrMore,
        v1.PromptToolChoiceOneOrMore,
        v1.PromptToolChoiceSpecificFunctionTool,
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
    v1.PromptToolChoiceNone,
    v1.PromptToolChoiceZeroOrMore,
    v1.PromptToolChoiceOneOrMore,
    v1.PromptToolChoiceSpecificFunctionTool,
]:
    if obj == "none":
        choice_none: v1.PromptToolChoiceNone = {"type": "none"}
        return choice_none
    if obj == "auto":
        choice_zero_or_more: v1.PromptToolChoiceZeroOrMore = {"type": "zero-or-more"}
        return choice_zero_or_more
    if obj == "required":
        choice_one_or_more: v1.PromptToolChoiceOneOrMore = {"type": "one-or-more"}
        return choice_one_or_more
    if obj["type"] == "function":
        function: Function = obj["function"]
        choice_function_tool: v1.PromptToolChoiceSpecificFunctionTool = {
            "type": "specific-function-tool",
            "function_name": function["name"],
        }
        return choice_function_tool
    assert_never(obj["type"])


class _FunctionToolConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptFunctionTool,
    ) -> ChatCompletionToolParam:
        definition: FunctionDefinition = {"name": obj["name"]}
        if "description" in obj:
            definition["description"] = obj["description"]
        if "schema" in obj:
            definition["parameters"] = dict(obj["schema"]["json"])
        if "extra_parameters" in obj:
            extra_parameters = obj["extra_parameters"]
            if "strict" in extra_parameters and (
                isinstance(v := extra_parameters["strict"], bool) or v is None
            ):
                definition["strict"] = v
        ans: ChatCompletionToolParam = {"type": "function", "function": definition}
        return ans

    @staticmethod
    def from_openai(
        obj: ChatCompletionToolParam,
    ) -> v1.PromptFunctionTool:
        definition: FunctionDefinition = obj["function"]
        name = definition["name"]
        function = v1.PromptFunctionTool(type="function-tool", name=name)
        if "description" in definition:
            function["description"] = definition["description"]
        if "parameters" in definition:
            function["schema"] = v1.JSONSchemaDraft7ObjectSchema(
                type="json-schema-draft-7-object-schema",
                json=definition["parameters"],
            )
        if "strict" in definition:
            function["extra_parameters"] = {"strict": definition["strict"]}
        return function


class _ResponseFormatJSONSchemaConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptResponseFormatJSONSchema,
    ) -> ResponseFormat:
        json_schema: JSONSchema = {
            "name": obj["name"],
        }
        schema = obj["schema"]
        if schema["type"] == "json-schema-draft-7-object-schema":
            json_schema["schema"] = dict(schema["json"])
        elif TYPE_CHECKING:
            assert_never(schema["type"])
        if "description" in obj:
            json_schema["description"] = obj["description"]
        if "extra_parameters" in obj:
            extra_parameters = obj["extra_parameters"]
            if "strict" in extra_parameters and (
                isinstance(v := extra_parameters["strict"], bool) or v is None
            ):
                json_schema["strict"] = v
        ans: ResponseFormatJSONSchema = {
            "type": "json_schema",
            "json_schema": json_schema,
        }
        return ans

    @staticmethod
    def from_openai(
        obj: ResponseFormat,
    ) -> v1.PromptResponseFormatJSONSchema:
        if obj["type"] == "json_schema":
            json_schema: JSONSchema = obj["json_schema"]
            extra_parameters: dict[str, Any] = {}
            if "strict" in json_schema:
                extra_parameters["strict"] = json_schema["strict"]
            ans = v1.PromptResponseFormatJSONSchema(
                type="response-format-json-schema",
                extra_parameters=extra_parameters,
                name=json_schema["name"],
                schema=v1.JSONSchemaDraft7ObjectSchema(
                    type="json-schema-draft-7-object-schema",
                    json=json_schema["schema"] if "schema" in json_schema else {},
                ),
            )
            if "description" in json_schema:
                ans["description"] = json_schema["description"]
            return ans
        elif obj["type"] == "text":
            raise NotImplementedError
        elif obj["type"] == "json_object":
            raise NotImplementedError
        else:
            assert_never(obj)


class _MessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionMessageParam]:
        if obj["role"] == "USER":
            yield from _UserMessageConversion.to_openai(obj, variables, formatter)
        elif obj["role"] == "SYSTEM":
            yield from _SystemMessageConversion.to_openai(obj, variables, formatter)
        elif obj["role"] == "AI":
            yield from _AssistantMessageConversion.to_openai(obj, variables, formatter)
        elif obj["role"] == "TOOL":
            yield from _ToolMessageConversion.to_openai(obj, variables, formatter)
        elif TYPE_CHECKING:
            assert_never(obj["role"])
        else:
            content = list(_ContentPartConversion.to_openai(obj["content"], variables, formatter))
            yield {"role": obj["role"], "content": content}

    @staticmethod
    def from_openai(
        obj: ChatCompletionMessageParam,
    ) -> v1.PromptMessage:
        if obj["role"] == "user":
            return _UserMessageConversion.from_openai(obj)
        if obj["role"] == "system":
            return _SystemMessageConversion.from_openai(obj)
        if obj["role"] == "developer":
            raise NotImplementedError
        if obj["role"] == "assistant":
            return _AssistantMessageConversion.from_openai(obj)
        if obj["role"] == "tool":
            return _ToolMessageConversion.from_openai(obj)
        if obj["role"] == "function":
            raise NotImplementedError
        if TYPE_CHECKING:
            assert_never(obj["role"])
        content = list(_ContentPartConversion.from_openai(obj["content"]))
        return v1.PromptMessage(role=obj["role"], content=content)


class _UserMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionUserMessageParam]:
        content = list(_ContentPartConversion.to_openai(obj["content"], variables, formatter))
        yield _user_msg(content)

    @staticmethod
    def from_openai(
        obj: ChatCompletionUserMessageParam,
        /,
        *,
        role: Literal["USER"] = "USER",
    ) -> v1.PromptMessage:
        content = list(_ContentPartConversion.from_openai(obj["content"]))
        return v1.PromptMessage(role=role, content=content)


class _SystemMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionSystemMessageParam]:
        content = list(
            _ContentPartConversion.to_openai(obj["content"], variables, formatter, text_only=True)
        )
        yield _system_msg(content)

    @staticmethod
    def from_openai(
        obj: ChatCompletionSystemMessageParam,
        /,
        *,
        role: Literal["SYSTEM"] = "SYSTEM",
    ) -> v1.PromptMessage:
        content = list(_ContentPartConversion.from_openai(obj["content"]))
        return v1.PromptMessage(role=role, content=content)


class _AssistantMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
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
                tool_calls.append(
                    _ToolCallContentPartConversion.to_openai(part, variables, formatter)
                )
                continue
            elif tool_calls:
                yield {"role": "assistant", "tool_calls": tool_calls}
                tool_calls.clear()
            if part["type"] == "text":
                content.append(_TextContentPartConversion.to_openai(part, variables, formatter))
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

    @staticmethod
    def from_openai(
        obj: ChatCompletionAssistantMessageParam,
        /,
        *,
        role: Literal["AI"] = "AI",
    ) -> v1.PromptMessage:
        content: list[_ContentPart] = []
        if "content" in obj:
            content.extend(_ContentPartConversion.from_openai(obj["content"]))
        if "tool_calls" in obj and (tool_calls := obj["tool_calls"]):
            content.extend(map(_ToolCallContentPartConversion.from_openai, tool_calls))
        return v1.PromptMessage(role=role, content=content)


class _ToolMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
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

    @staticmethod
    def from_openai(
        obj: ChatCompletionToolMessageParam,
        /,
        *,
        role: Literal["TOOL"] = "TOOL",
    ) -> v1.PromptMessage:
        if isinstance(obj["content"], str):
            return v1.PromptMessage(
                role="TOOL",
                content=[
                    v1.ToolResultContentPart(
                        type="tool_result",
                        tool_result=v1.ToolResultContentValue(
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
                    v1.ToolResultContentPart(
                        type="tool_result",
                        tool_result=v1.ToolResultContentValue(
                            tool_call_id=obj["tool_call_id"],
                            result=part["text"],
                        ),
                    )
                )
            elif TYPE_CHECKING:
                assert_never(part)
        return v1.PromptMessage(role=role, content=content)


def _str_tool_result(
    obj: Any,
) -> str:
    if isinstance(obj, (dict, list)):
        return json.dumps(obj)
    return str(obj)


class _ToolCallContentPartConversion:
    @staticmethod
    def to_openai(
        obj: v1.ToolCallContentPart,
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

    @staticmethod
    def from_openai(
        obj: ChatCompletionMessageToolCallParam,
    ) -> v1.ToolCallContentPart:
        return v1.ToolCallContentPart(
            type="tool_call",
            tool_call=v1.ToolCallContentValue(
                tool_call_id=obj["id"],
                tool_call=v1.ToolCallFunction(
                    type="function",
                    name=obj["function"]["name"],
                    arguments=obj["function"]["arguments"],
                ),
            ),
        )


class _ContentPartConversion:
    @overload
    @staticmethod
    def to_openai(
        parts: Iterable[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: Literal[True] = True,
    ) -> Iterator[ChatCompletionContentPartTextParam]: ...

    @overload
    @staticmethod
    def to_openai(
        parts: Iterable[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: bool,
    ) -> Iterator[ChatCompletionContentPartParam]: ...

    @staticmethod
    def to_openai(
        parts: Iterable[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: bool = False,
    ) -> Iterator[Any]:
        for part in parts:
            if part["type"] == "text":
                yield _TextContentPartConversion.to_openai(part, variables, formatter)
            elif text_only:
                continue
            elif part["type"] == "image":
                continue
            elif part["type"] == "tool_call":
                continue
            elif part["type"] == "tool_result":
                continue
            elif TYPE_CHECKING:
                assert_never(part)

    @staticmethod
    def from_openai(
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
            text = v1.TextContentValue(text=obj)
            yield v1.TextContentPart(type="text", text=text)
            return
        for part in obj or ():
            if part["type"] == "text":
                yield _TextContentPartConversion.from_openai(part)
            elif part["type"] == "image_url":
                continue
            elif part["type"] == "input_audio":
                continue
            elif part["type"] == "refusal":
                continue
            elif TYPE_CHECKING:
                assert_never(part["type"])


class _TextContentPartConversion:
    @staticmethod
    def to_openai(
        obj: v1.TextContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> ChatCompletionContentPartTextParam:
        text = formatter.format(obj["text"]["text"], variables=variables)
        return {"type": "text", "text": text}

    @staticmethod
    def from_openai(
        obj: ChatCompletionContentPartTextParam,
    ) -> v1.TextContentPart:
        text = v1.TextContentValue(text=obj["text"])
        return v1.TextContentPart(type="text", text=text)


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


class _RoleConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
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

    @staticmethod
    def from_openai(
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
