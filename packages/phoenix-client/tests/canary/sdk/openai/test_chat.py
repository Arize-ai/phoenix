import json
from typing import Any, Iterable, Mapping, Optional, Union

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionContentPartImageParam,
    ChatCompletionContentPartParam,
    ChatCompletionContentPartTextParam,
    ChatCompletionMessageParam,
    ChatCompletionMessageToolCallParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionToolMessageParam,
    ChatCompletionToolParam,
    ChatCompletionUserMessageParam,
)
from openai.types.chat.chat_completion_assistant_message_param import ContentArrayOfContentPart
from openai.types.chat.chat_completion_content_part_image_param import ImageURL
from openai.types.chat.chat_completion_message_tool_call_param import Function
from openai.types.shared_params import FunctionDefinition

from phoenix.client.__generated__.v1 import (
    ImageContentPart,
    PromptMessage,
    PromptToolsV1,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
)
from phoenix.client.helpers.sdk.openai.chat import (
    _from_image_param,
    _from_message_param,
    _from_text_param,
    _from_tool_call,
    _from_tools,
    _to_image_param,
    _to_message_params,
    _to_text_param,
    _to_tool_call,
    _to_tools,
)

fake = Faker()


def _dict() -> dict[str, Any]:
    return fake.pydict(3, value_types=(int, float, bool, str))


def _str() -> str:
    return fake.pystr(8, 8)


def _user_msg(
    content: Union[str, Iterable[ChatCompletionContentPartParam]],
) -> ChatCompletionUserMessageParam:
    return ChatCompletionUserMessageParam(role="user", content=content)


def _assistant_msg(
    content: Optional[Union[str, Iterable[ContentArrayOfContentPart]]] = None,
    tool_calls: Iterable[ChatCompletionMessageToolCallParam] = (),
) -> ChatCompletionAssistantMessageParam:
    if not tool_calls:
        return ChatCompletionAssistantMessageParam(role="assistant", content=content)
    if content is None:
        return ChatCompletionAssistantMessageParam(role="assistant", tool_calls=tool_calls)
    return ChatCompletionAssistantMessageParam(
        role="assistant", content=content, tool_calls=tool_calls
    )


def _tool_msg(
    content: Union[str, Iterable[ChatCompletionContentPartTextParam]],
) -> ChatCompletionToolMessageParam:
    return ChatCompletionToolMessageParam(role="tool", content=content, tool_call_id=_str())


def _system_msg(
    content: Union[str, Iterable[ChatCompletionContentPartTextParam]],
) -> ChatCompletionSystemMessageParam:
    return ChatCompletionSystemMessageParam(role="system", content=content)


def _text() -> ChatCompletionContentPartTextParam:
    return ChatCompletionContentPartTextParam(type="text", text=_str())


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


def _tool() -> ChatCompletionToolParam:
    return ChatCompletionToolParam(
        type="function",
        function=FunctionDefinition(
            name=_str(),
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
            strict=True,
        ),
    )


class TestChatCompletionMessageParam:
    @pytest.mark.parametrize(
        "msg",
        [
            _system_msg(_str()),
            _system_msg([_text(), _text()]),
            _user_msg(_str()),
            _user_msg([_text(), _text()]),
            _assistant_msg(_str()),
            _assistant_msg([_text(), _text()]),
            _assistant_msg(None, [_tool_call(), _tool_call()]),
            _tool_msg(_str()),
            _tool_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, msg: ChatCompletionMessageParam) -> None:
        assert isinstance(x := _from_message_param(msg), PromptMessage)
        assert not DeepDiff([msg], list(_to_message_params(x)))


class TestChatCompletionToolParam:
    @pytest.mark.parametrize(
        "tools",
        [[_tool() for _ in range(3)]],
    )
    def test_round_trip(self, tools: Iterable[ChatCompletionToolParam]) -> None:
        assert isinstance(x := _from_tools(tools), PromptToolsV1)
        new_tools = list(_to_tools(x))
        assert not DeepDiff(list(tools), new_tools)


class TestChatCompletionContentPartTextParam:
    def test_round_trip(self) -> None:
        part: ChatCompletionContentPartTextParam = _text()
        assert isinstance(x := _from_text_param(part), TextContentPart)
        new_part: ChatCompletionContentPartTextParam = _to_text_param(x)
        assert not DeepDiff(part, new_part)

    def test_formatter(self) -> None:
        obj = TextContentPart(text=TextContentValue(text=_str()))
        variables = Faker().pydict(value_types=(str, int, float, bool))
        part: ChatCompletionContentPartTextParam = _to_text_param(obj, variables, _MockFormatter())
        assert part["text"] == json.dumps(variables)


class TestChatCompletionMessageToolCallParam:
    def test_round_trip(self) -> None:
        call: ChatCompletionMessageToolCallParam = _tool_call()
        assert isinstance(x := _from_tool_call(call), ToolCallContentPart)
        new_call: ChatCompletionMessageToolCallParam = _to_tool_call(x)
        assert not DeepDiff(call, new_call)


class TestChatCompletionContentPartImageParam:
    def test_round_trip(self) -> None:
        block: ChatCompletionContentPartImageParam = _image()
        assert isinstance(x := _from_image_param(block), ImageContentPart)
        new_block: ChatCompletionContentPartImageParam = _to_image_param(x)
        assert not DeepDiff(block, new_block)


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
