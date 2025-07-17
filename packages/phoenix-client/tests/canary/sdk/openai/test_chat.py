from __future__ import annotations

import json
from enum import Enum
from random import randint, random
from secrets import token_hex
from typing import TYPE_CHECKING, Any, Iterable, Mapping, Optional, Union, cast

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from openai.lib._parsing import type_to_response_format_param
from openai.lib._tools import pydantic_function_tool
from pydantic import BaseModel, create_model

from phoenix.client.__generated__ import v1
from phoenix.client.helpers.sdk.openai.chat import (
    _FunctionToolConversion,
    _MessageConversion,
    _ResponseFormatConversion,
    _TextContentPartConversion,
    _ToolCallContentPartConversion,
    _ToolKwargs,
    _ToolKwargsConversion,
    create_prompt_version_from_openai,
    to_chat_messages_and_kwargs,
)
from phoenix.client.utils.template_formatters import NO_OP_FORMATTER

if TYPE_CHECKING:
    from openai.types.chat import (
        ChatCompletionAssistantMessageParam,
        ChatCompletionContentPartParam,
        ChatCompletionContentPartTextParam,
        ChatCompletionDeveloperMessageParam,
        ChatCompletionMessageToolCallParam,
        ChatCompletionSystemMessageParam,
        ChatCompletionToolMessageParam,
        ChatCompletionToolParam,
        ChatCompletionUserMessageParam,
    )
    from openai.types.chat.chat_completion_assistant_message_param import ContentArrayOfContentPart
    from openai.types.chat.completion_create_params import (
        CompletionCreateParamsBase,
        ResponseFormat,
    )

fake = Faker()


def _dict() -> dict[str, Any]:
    return fake.pydict(3, value_types=(int, float, bool, str))  # pyright: ignore[reportUnknownMemberType]


def _str() -> str:
    return fake.pystr(8, 8)


def _user_msg(
    content: Union[str, Iterable[ChatCompletionContentPartParam]],
) -> ChatCompletionUserMessageParam:
    return {
        "role": "user",
        "content": content,
    }


def _assistant_msg(
    content: Optional[Union[str, Iterable[ContentArrayOfContentPart]]] = None,
    tool_calls: Iterable[ChatCompletionMessageToolCallParam] = (),
) -> ChatCompletionAssistantMessageParam:
    if not tool_calls:
        return {
            "role": "assistant",
            "content": content,
        }
    if content is None:
        return {
            "role": "assistant",
            "tool_calls": tool_calls,
        }
    return {
        "role": "assistant",
        "content": content,
        "tool_calls": tool_calls,
    }


def _tool_msg(
    content: Union[str, Iterable[ChatCompletionContentPartTextParam]],
) -> ChatCompletionToolMessageParam:
    return {
        "role": "tool",
        "content": content,
        "tool_call_id": _str(),
    }


def _system_msg(
    content: Union[str, Iterable[ChatCompletionContentPartTextParam]],
) -> ChatCompletionSystemMessageParam:
    return {
        "role": "system",
        "content": content,
    }


def _developer_msg(
    content: Union[str, Iterable[ChatCompletionContentPartTextParam]],
) -> ChatCompletionDeveloperMessageParam:
    return {
        "role": "developer",
        "content": content,
    }


def _text() -> ChatCompletionContentPartTextParam:
    return {
        "type": "text",
        "text": _str(),
    }


def _tool_call() -> ChatCompletionMessageToolCallParam:
    return {
        "id": _str(),
        "type": "function",
        "function": {"name": _str(), "arguments": json.dumps(_dict())},
    }


def _tool(name: Optional[str] = None) -> ChatCompletionToolParam:
    strict = fake.pybool()
    return {
        "type": "function",
        "function": {
            "name": name or _str(),
            "description": _str(),
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "int", "description": _str()},
                    "y": {"type": "string", "description": _str()},
                },
                "required": ["x", "y"],
                "additionalProperties": strict or fake.pybool(),
            },
            "strict": strict,
        },
    }


class TestChatCompletionUserMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _user_msg(_str()),
            _user_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionUserMessageParam) -> None:
        x: v1.PromptMessage = _MessageConversion.from_openai(obj)
        assert not DeepDiff(obj, next(_MessageConversion.to_openai(x, {}, NO_OP_FORMATTER)))


class TestChatCompletionSystemMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _system_msg(_str()),
            _system_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionSystemMessageParam) -> None:
        x: v1.PromptMessage = _MessageConversion.from_openai(obj)
        assert not DeepDiff([obj], list(_MessageConversion.to_openai(x, {}, NO_OP_FORMATTER)))


class TestChatCompletionDeveloperMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _developer_msg(_str()),
            _developer_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionSystemMessageParam) -> None:
        x: v1.PromptMessage = _MessageConversion.from_openai(obj)
        assert not DeepDiff([obj], list(_MessageConversion.to_openai(x, {}, NO_OP_FORMATTER)))


class TestChatCompletionAssistantMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _assistant_msg(_str()),
            _assistant_msg([_text(), _text()]),
            _assistant_msg(None, [_tool_call(), _tool_call()]),
            _assistant_msg(_str(), [_tool_call(), _tool_call()]),
            _assistant_msg([_text(), _text()], [_tool_call(), _tool_call()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionAssistantMessageParam) -> None:
        x: v1.PromptMessage = _MessageConversion.from_openai(obj)
        assert not DeepDiff([obj], list(_MessageConversion.to_openai(x, {}, NO_OP_FORMATTER)))


class TestChatCompletionToolMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _tool_msg(_str()),
            _tool_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionToolMessageParam) -> None:
        x: v1.PromptMessage = _MessageConversion.from_openai(obj)
        assert not DeepDiff([obj], list(_MessageConversion.to_openai(x, {}, NO_OP_FORMATTER)))


class TestFunctionToolConversion:
    @pytest.mark.parametrize(
        "obj",
        [_tool()],
    )
    def test_round_trip(self, obj: ChatCompletionToolParam) -> None:
        new_obj = _FunctionToolConversion.to_openai(_FunctionToolConversion.from_openai(obj))
        assert not DeepDiff(obj, new_obj)


class TestTextContentPartConversion:
    def test_round_trip(self) -> None:
        obj: ChatCompletionContentPartTextParam = _text()
        x: v1.TextContentPart = _TextContentPartConversion.from_openai(obj)
        new_obj: ChatCompletionContentPartTextParam = _TextContentPartConversion.to_openai(
            x, {}, NO_OP_FORMATTER
        )
        assert not DeepDiff(obj, new_obj)

    def test_formatter(self) -> None:
        x = v1.TextContentPart(type="text", text=_str())
        formatter, variables = _MockFormatter(), _dict()
        ans: ChatCompletionContentPartTextParam = _TextContentPartConversion.to_openai(
            x, variables, formatter
        )
        assert ans["text"] == formatter.format(x["text"], variables=variables)


class _GetWeather(BaseModel):
    city: str


class _GetPopulation(BaseModel):
    country: str
    year: Optional[int] = None


_TOOLS: list[ChatCompletionToolParam] = [
    cast(
        "ChatCompletionToolParam",
        json.loads(json.dumps(pydantic_function_tool(t))),
    )
    for t in cast(Iterable[type[BaseModel]], [_GetWeather, _GetPopulation])
]


class TestToolCallContentPartConversion:
    def test_round_trip(self) -> None:
        obj: ChatCompletionMessageToolCallParam = _tool_call()
        x: v1.ToolCallContentPart = _ToolCallContentPartConversion.from_openai(obj)
        new_obj: ChatCompletionMessageToolCallParam = _ToolCallContentPartConversion.to_openai(
            x, {}, NO_OP_FORMATTER
        )
        assert not DeepDiff(obj, new_obj)


class _UIType(str, Enum):
    div = "div"
    button = "button"
    header = "header"
    section = "section"
    field = "field"
    form = "form"


class _Attribute(BaseModel):
    name: str
    value: str


class _UI(BaseModel):
    type: _UIType
    label: str
    children: list[_UI]
    attributes: list[_Attribute]


_UI.model_rebuild()


class TestResponseFormatJSONSchemaConversion:
    @pytest.mark.parametrize(
        "type_",
        [
            create_model("Response", ui=(_UI, ...)),
        ],
    )
    def test_round_trip(self, type_: type[BaseModel]) -> None:
        obj = cast("ResponseFormat", type_to_response_format_param(type_))
        x: v1.PromptResponseFormatJSONSchema = _ResponseFormatConversion.from_openai(obj)
        new_obj = _ResponseFormatConversion.to_openai(x)
        assert not DeepDiff(obj, new_obj)


class TestToolKwargsConversion:
    @pytest.mark.parametrize(
        "obj",
        [
            {},
            {
                "tools": [_tool(), _tool()],
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": "none",
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": "none",
                "parallel_tool_calls": False,
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": "auto",
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": "auto",
                "parallel_tool_calls": False,
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": "required",
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": "required",
                "parallel_tool_calls": False,
            },
            {
                "tools": [_tool(), _tool("xyz")],
                "tool_choice": {
                    "type": "function",
                    "function": {"name": "xyz"},
                },
            },
            {
                "tools": [_tool(), _tool("xyz")],
                "tool_choice": {
                    "type": "function",
                    "function": {"name": "xyz"},
                },
                "parallel_tool_calls": False,
            },
        ],
    )
    def test_round_trip(self, obj: _ToolKwargs) -> None:
        x: Optional[v1.PromptTools] = _ToolKwargsConversion.from_openai(obj)
        new_obj: _ToolKwargs = _ToolKwargsConversion.to_openai(x)
        assert not DeepDiff(obj, new_obj)


class TestCompletionCreateParamsBase:
    @pytest.mark.parametrize(
        "obj",
        [
            {
                "model": token_hex(8),
                "messages": [
                    {
                        "role": "system",
                        "content": "You will be provided with statements, and your task is"
                        "to convert them to standard English.",
                    },
                    {"role": "user", "content": "{{ statement }}"},
                ],
                "temperature": random(),
                "max_completion_tokens": randint(1, 256),
                "top_p": random(),
            },
            {
                "model": token_hex(8),
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a UI generator. Convert the user input into a UI.",
                    },
                    {
                        "role": "user",
                        "content": "Make a form for {{ feature }}.",
                    },
                ],
                "response_format": cast(
                    "ResponseFormat",
                    type_to_response_format_param(
                        create_model("Response", ui=(_UI, ...)),
                    ),
                ),
                "temperature": random(),
                "max_completion_tokens": randint(1, 256),
                "top_p": random(),
            },
            {
                "model": token_hex(8),
                "messages": [
                    {
                        "role": "user",
                        "content": "What is the latest population estimate for {{ location }}?",
                    }
                ],
                "tools": _TOOLS,
                "tool_choice": "required",
                "temperature": random(),
                "max_completion_tokens": randint(1, 256),
                "top_p": random(),
            },
            {
                "model": token_hex(8),
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a UI generator. Convert the user input into a UI.",
                    },
                    {
                        "role": "user",
                        "content": "Make a form for {{ feature }}.",
                    },
                ],
                "response_format": cast(
                    "ResponseFormat",
                    type_to_response_format_param(
                        create_model("Response", ui=(_UI, ...)),
                    ),
                ),
                "temperature": random(),
                "max_tokens": randint(1, 256),
                "top_p": random(),
            },
            {
                "model": token_hex(8),
                "messages": [
                    {
                        "role": "user",
                        "content": "What is the latest population estimate for {{ location }}?",
                    }
                ],
                "tools": _TOOLS,
                "tool_choice": "required",
                "temperature": random(),
                "max_tokens": randint(1, 256),
                "top_p": random(),
            },
        ],
    )
    def test_round_trip(self, obj: CompletionCreateParamsBase) -> None:
        pv: v1.PromptVersionData = create_prompt_version_from_openai(obj)
        messages, kwargs = to_chat_messages_and_kwargs(pv, formatter=NO_OP_FORMATTER)
        new_obj: CompletionCreateParamsBase = {"messages": messages, **kwargs}  # type: ignore[typeddict-item]
        assert not DeepDiff(obj, new_obj)


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
