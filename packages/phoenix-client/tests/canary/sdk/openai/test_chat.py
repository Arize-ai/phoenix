from __future__ import annotations

import json
from enum import Enum
from typing import Any, Iterable, Mapping, Optional, Union, cast

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from openai.lib._parsing import type_to_response_format_param
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionContentPartImageParam,
    ChatCompletionContentPartParam,
    ChatCompletionContentPartTextParam,
    ChatCompletionMessageToolCallParam,
    ChatCompletionNamedToolChoiceParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionToolMessageParam,
    ChatCompletionToolParam,
    ChatCompletionUserMessageParam,
)
from openai.types.chat.chat_completion_assistant_message_param import ContentArrayOfContentPart
from openai.types.chat.chat_completion_content_part_image_param import ImageURL
from openai.types.chat.chat_completion_message_tool_call_param import Function
from openai.types.chat.completion_create_params import ResponseFormat
from openai.types.shared_params import FunctionDefinition
from pydantic import BaseModel, create_model

from phoenix.client.__generated__.v1 import (
    ImageContentPart,
    PromptMessage,
    PromptResponseFormatJSONSchema,
    PromptToolsV1,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
)
from phoenix.client.helpers.sdk.openai.chat import (
    _from_image,
    _from_message,
    _from_response_format,
    _from_text,
    _from_tool_call,
    _from_tool_kwargs,
    _from_tools,
    _to_image,
    _to_messages,
    _to_response_format_json_schema,
    _to_text,
    _to_tool_call,
    _to_tool_kwargs,
    _to_tools,
    _ToolKwargs,
)
from phoenix.client.utils.template_formatters import NO_OP_FORMATTER

fake = Faker()


def _dict() -> dict[str, Any]:
    return fake.pydict(3, value_types=(int, float, bool, str))  # pyright: ignore[reportUnknownMemberType]


def _str() -> str:
    return fake.pystr(8, 8)


def _user_msg(
    content: Union[str, Iterable[ChatCompletionContentPartParam]],
) -> ChatCompletionUserMessageParam:
    return ChatCompletionUserMessageParam(
        role="user",
        content=content,
    )


def _assistant_msg(
    content: Optional[Union[str, Iterable[ContentArrayOfContentPart]]] = None,
    tool_calls: Iterable[ChatCompletionMessageToolCallParam] = (),
) -> ChatCompletionAssistantMessageParam:
    if not tool_calls:
        return ChatCompletionAssistantMessageParam(
            role="assistant",
            content=content,
        )
    if content is None:
        return ChatCompletionAssistantMessageParam(
            role="assistant",
            tool_calls=tool_calls,
        )
    return ChatCompletionAssistantMessageParam(
        role="assistant",
        content=content,
        tool_calls=tool_calls,
    )


def _tool_msg(
    content: Union[str, Iterable[ChatCompletionContentPartTextParam]],
) -> ChatCompletionToolMessageParam:
    return ChatCompletionToolMessageParam(
        role="tool",
        content=content,
        tool_call_id=_str(),
    )


def _system_msg(
    content: Union[str, Iterable[ChatCompletionContentPartTextParam]],
) -> ChatCompletionSystemMessageParam:
    return ChatCompletionSystemMessageParam(
        role="system",
        content=content,
    )


def _text() -> ChatCompletionContentPartTextParam:
    return ChatCompletionContentPartTextParam(
        type="text",
        text=_str(),
    )


def _image() -> ChatCompletionContentPartImageParam:
    return ChatCompletionContentPartImageParam(
        type="image_url",
        image_url=ImageURL(
            url=fake.image_url(),
        ),
    )


def _tool_call() -> ChatCompletionMessageToolCallParam:
    return ChatCompletionMessageToolCallParam(
        id=_str(),
        type="function",
        function=Function(name=_str(), arguments=json.dumps(_dict())),
    )


def _tool(name: Optional[str] = None) -> ChatCompletionToolParam:
    return ChatCompletionToolParam(
        type="function",
        function=FunctionDefinition(
            name=name or _str(),
            description=_str(),
            parameters={
                "type": "object",
                "properties": {
                    "x": {"type": "int", "description": _str()},
                    "y": {"type": "string", "description": _str()},
                },
                "required": ["x", "y"],
                "additionalProperties": False,
            },
        ),
    )


class TestChatCompletionUserMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _user_msg(_str()),
            _user_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionUserMessageParam) -> None:
        x: PromptMessage = _from_message(obj)
        assert not DeepDiff([obj], list(_to_messages(x, {}, NO_OP_FORMATTER)))


class TestChatCompletionSystemMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _system_msg(_str()),
            _system_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionSystemMessageParam) -> None:
        x: PromptMessage = _from_message(obj)
        assert not DeepDiff([obj], list(_to_messages(x, {}, NO_OP_FORMATTER)))


class TestChatCompletionAssistantMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _assistant_msg(_str()),
            _assistant_msg([_text(), _text()]),
            _assistant_msg(None, [_tool_call(), _tool_call()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionAssistantMessageParam) -> None:
        x: PromptMessage = _from_message(obj)
        assert not DeepDiff([obj], list(_to_messages(x, {}, NO_OP_FORMATTER)))


class TestChatCompletionToolMessageParam:
    @pytest.mark.parametrize(
        "obj",
        [
            _tool_msg(_str()),
            _tool_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: ChatCompletionToolMessageParam) -> None:
        x: PromptMessage = _from_message(obj)
        assert not DeepDiff([obj], list(_to_messages(x, {}, NO_OP_FORMATTER)))


class TestChatCompletionToolParam:
    @pytest.mark.parametrize(
        "tools",
        [[_tool() for _ in range(3)]],
    )
    def test_round_trip(self, tools: Iterable[ChatCompletionToolParam]) -> None:
        new_tools = list(_to_tools(_from_tools(tools)))
        assert not DeepDiff(list(tools), new_tools)


class TestChatCompletionContentPartTextParam:
    def test_round_trip(self) -> None:
        obj: ChatCompletionContentPartTextParam = _text()
        x: TextContentPart = _from_text(obj)
        new_obj: ChatCompletionContentPartTextParam = _to_text(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)

    def test_formatter(self) -> None:
        x = TextContentPart(type="text", text=TextContentValue(text=_str()))
        formatter, variables = _MockFormatter(), _dict()
        ans: ChatCompletionContentPartTextParam = _to_text(x, variables, formatter)
        assert ans["text"] == formatter.format(x["text"]["text"], variables=variables)


class TestChatCompletionMessageToolCallParam:
    def test_round_trip(self) -> None:
        obj: ChatCompletionMessageToolCallParam = _tool_call()
        x: ToolCallContentPart = _from_tool_call(obj)
        new_obj: ChatCompletionMessageToolCallParam = _to_tool_call(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)


class TestChatCompletionContentPartImageParam:
    def test_round_trip(self) -> None:
        obj: ChatCompletionContentPartImageParam = _image()
        x: ImageContentPart = _from_image(obj)
        new_obj: ChatCompletionContentPartImageParam = _to_image(x, {}, NO_OP_FORMATTER)
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


class TestResponseFormat:
    @pytest.mark.parametrize(
        "type_",
        [
            create_model("Response", ui=(_UI, ...)),
        ],
    )
    def test_round_trip(self, type_: type[BaseModel]) -> None:
        obj = cast(ResponseFormat, type_to_response_format_param(type_))
        x: PromptResponseFormatJSONSchema = _from_response_format(obj)
        new_obj = _to_response_format_json_schema(x)
        assert not DeepDiff(obj, new_obj)


class TestToolKwargs:
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
                "tool_choice": ChatCompletionNamedToolChoiceParam(
                    type="function",
                    function={"name": "xyz"},
                ),
            },
            {
                "tools": [_tool(), _tool("xyz")],
                "tool_choice": ChatCompletionNamedToolChoiceParam(
                    type="function",
                    function={"name": "xyz"},
                ),
                "parallel_tool_calls": False,
            },
        ],
    )
    def test_round_trip(self, obj: _ToolKwargs) -> None:
        x: Optional[PromptToolsV1] = _from_tool_kwargs(obj)
        new_obj: _ToolKwargs = _to_tool_kwargs(x)
        assert not DeepDiff(obj, new_obj)


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
